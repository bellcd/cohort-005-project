import { db } from "~/db";
import type { Db } from "./lib/db";
import { loadLessonPage, type LessonPageRequest } from "./lib/load.server";
import { markLessonComplete } from "./lib/progress.server";
import { getQuizById } from "./lib/quiz.server";
import { parseQuizAnswers } from "./lib/quiz-grading";
import { scoreQuizAttempt } from "./lib/quiz-scoring.server";
import { getCommentById } from "./lib/thread.server";
import { createLessonWrites } from "./lib/writes.server";

export type { LessonPageData, LessonPageRequest } from "./lib/load.server";
export type QuizResult = NonNullable<ReturnType<typeof scoreQuizAttempt>>;

/**
 * The lesson page's data and actions, bound to a database. The app uses
 * `lessonPage`, which reads the app database; tests build their own against
 * a test database. Permission checks stay in the route: every function here
 * assumes the caller has already been allowed.
 */
export function createLessonPage(database: Db) {
  return {
    ...createLessonWrites(database),

    /** Everything the page shows, locked or full; null if the lesson is gone. */
    load(request: LessonPageRequest) {
      return loadLessonPage(database, request);
    },

    /** The comment, to check it belongs to this lesson before acting on it. */
    getComment(commentId: number) {
      return getCommentById(database, commentId);
    },

    /** The quiz, to check it belongs to this lesson before scoring it. */
    getQuiz(quizId: number) {
      return getQuizById(database, quizId);
    },

    markComplete(userId: number, lessonId: number, now: Date) {
      return markLessonComplete(database, { userId, lessonId }, now);
    },

    /** Scores a submitted quiz form and records the attempt; null on failure. */
    submitQuiz(userId: number, quizId: number, formData: FormData) {
      return scoreQuizAttempt(database, {
        userId,
        quizId,
        selectedAnswers: parseQuizAnswers(formData),
      });
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonPage = /* @__PURE__ */ createLessonPage(db);
