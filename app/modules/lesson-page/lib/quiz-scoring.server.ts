import { and, eq } from "drizzle-orm";
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

function findCorrectOptionId(db: Db, q: Question): number | null {
  if (q.questionType === "multiple_choice") {
    const opts = db
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, q.id))
      .all();
    const correctOpt = opts.find((o) => o.isCorrect === true);
    return correctOpt ? correctOpt.id : null;
  }
  if (q.questionType === "true_false") {
    const correctOpt = db
      .select()
      .from(quizOptions)
      .where(
        and(eq(quizOptions.questionId, q.id), eq(quizOptions.isCorrect, true))
      )
      .get();
    return correctOpt ? correctOpt.id : null;
  }
  return null;
}

function scoreQuestion(
  db: Db,
  q: Question,
  selected: number | undefined
): QuestionResult {
  if (!selected) {
    return {
      questionId: q.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    };
  }
  const correctOptionId = findCorrectOptionId(db, q);
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
  const saved = db.insert(quizAttempts).values(attempt).returning().get();

  for (const result of questionResults) {
    if (result.selectedOptionId !== null) {
      db.insert(quizAnswers)
        .values({
          attemptId: saved.id,
          questionId: result.questionId,
          selectedOptionId: result.selectedOptionId,
        })
        .run();
    }
  }
  return saved;
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

    const questionResults = questions.map((q) =>
      scoreQuestion(db, q, selectedAnswers[q.id])
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
