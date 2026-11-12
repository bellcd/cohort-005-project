import { and, eq, inArray } from "drizzle-orm";
import {
  quizAnswers,
  quizAttempts,
  quizOptions,
  quizQuestions,
} from "~/db/schema";
import type { Db } from "./db";
import { calculateGrade } from "./quiz-grading";
import { getQuizById } from "./quiz.server";

type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

type Question = typeof quizQuestions.$inferSelect;

/** Each question's first correct option, read in one query. */
function correctOptionIds(db: Db, questions: Question[]) {
  const ids = questions.map((q) => q.id);
  const correct = db
    .select({ id: quizOptions.id, questionId: quizOptions.questionId })
    .from(quizOptions)
    .where(
      and(inArray(quizOptions.questionId, ids), eq(quizOptions.isCorrect, true))
    )
    .orderBy(quizOptions.id)
    .all();
  const byQuestion = new Map<number, number>();
  for (const option of correct) {
    if (!byQuestion.has(option.questionId)) {
      byQuestion.set(option.questionId, option.id);
    }
  }
  return byQuestion;
}

function scoreQuestion(
  q: Question,
  selected: number | undefined,
  correctOptions: Map<number, number>
): QuestionResult {
  if (!selected) {
    return {
      questionId: q.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    };
  }
  const correctOptionId = correctOptions.get(q.id) ?? null;
  return {
    questionId: q.id,
    correct: selected === correctOptionId,
    selectedOptionId: selected,
    correctOptionId,
  };
}

function saveAttempt(
  db: Db,
  attempt: { userId: number; quizId: number; score: number; passed: boolean },
  questionResults: QuestionResult[]
) {
  return db.transaction((tx) => {
    const saved = tx.insert(quizAttempts).values(attempt).returning().get();
    const answers = questionResults.flatMap((result) =>
      result.selectedOptionId === null
        ? []
        : [
            {
              attemptId: saved.id,
              questionId: result.questionId,
              selectedOptionId: result.selectedOptionId,
            },
          ]
    );
    if (answers.length > 0) tx.insert(quizAnswers).values(answers).run();
    return saved;
  });
}

export type QuizSubmission = {
  userId: number;
  quizId: number;
  selectedAnswers: Record<number, number>;
};

/** Scores the submission and records the attempt; null if it could not. */
export function scoreQuizAttempt(db: Db, submission: QuizSubmission) {
  const { userId, quizId, selectedAnswers } = submission;
  try {
    if (!getQuizById(db, quizId)) {
      console.error("quiz not found");
      return null;
    }

    const questions = db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.position)
      .all();

    const correctOptions = correctOptionIds(db, questions);
    const questionResults = questions.map((q) =>
      scoreQuestion(q, selectedAnswers[q.id], correctOptions)
    );
    const correct = questionResults.filter((r) => r.correct).length;
    const total = questions.length;

    const scoreValue = total > 0 ? correct / total : 0;
    const passed = scoreValue > 0.7;
    const attempt = saveAttempt(
      db,
      { userId, quizId, score: scoreValue, passed },
      questionResults
    );

    return {
      attemptId: attempt.id,
      score: scoreValue,
      passed,
      grade: calculateGrade(scoreValue),
      totalCorrect: correct,
      totalQuestions: total,
      questionResults,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}
