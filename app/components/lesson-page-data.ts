import type {
  LessonPageData,
  QuizResult,
} from "~/modules/lesson-page/index.server";

export type LockedLessonData = Extract<LessonPageData, { view: "locked" }>;
export type FullLessonData = Extract<LessonPageData, { view: "full" }>;

export type LessonCourse = FullLessonData["course"];
export type CurriculumModule = FullLessonData["curriculum"][number];
export type NeighbourLesson = NonNullable<FullLessonData["nextLesson"]>;
export type LessonQuiz = NonNullable<FullLessonData["quiz"]>;
export type LessonQuizBestAttempt = NonNullable<FullLessonData["bestAttempt"]>;
export type LessonQuizResult = QuizResult;
export type LessonQuizQuestionResult = QuizResult["questionResults"][number];
