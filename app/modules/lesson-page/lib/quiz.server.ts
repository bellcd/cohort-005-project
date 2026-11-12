import { and, desc, eq, inArray } from "drizzle-orm";
import { quizAttempts, quizOptions, quizQuestions, quizzes } from "~/db/schema";
import type { Db } from "./db";

export function getQuizById(db: Db, quizId: number) {
  return db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
}

function getQuizByLessonId(db: Db, lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

function getQuizWithQuestions(db: Db, quizId: number) {
  const quiz = getQuizById(db, quizId);
  if (!quiz) return null;

  const questions = db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();

  const options = db
    .select()
    .from(quizOptions)
    .where(
      inArray(
        quizOptions.questionId,
        questions.map((q) => q.id)
      )
    )
    .orderBy(quizOptions.id)
    .all();
  const questionsWithOptions = questions.map((question) => ({
    ...question,
    options: options.filter((o) => o.questionId === question.id),
  }));

  return { ...quiz, questions: questionsWithOptions };
}

function getBestAttempt(db: Db, userId: number, quizId: number) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}

type QuizWithQuestions = NonNullable<ReturnType<typeof getQuizWithQuestions>>;

// Strip isCorrect from options so answers aren't leaked to the client
function toClientQuiz(quizData: QuizWithQuestions) {
  return {
    id: quizData.id,
    title: quizData.title,
    passingScore: quizData.passingScore,
    questions: quizData.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      position: q.position,
      options: q.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
      })),
    })),
  };
}

/** The lesson's quiz without its answers, and this Student's best attempt. */
export function getLessonQuiz(
  db: Db,
  lessonId: number,
  currentUserId: number | null
) {
  const quizRecord = getQuizByLessonId(db, lessonId);
  if (!quizRecord) return { quiz: null, bestAttempt: null };

  const quizData = getQuizWithQuestions(db, quizRecord.id);
  const quiz = quizData ? toClientQuiz(quizData) : null;

  const best = currentUserId
    ? getBestAttempt(db, currentUserId, quizRecord.id)
    : undefined;
  const bestAttempt = best ? { score: best.score, passed: best.passed } : null;

  return { quiz, bestAttempt };
}
