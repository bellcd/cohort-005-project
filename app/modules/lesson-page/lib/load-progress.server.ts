import type { lessons } from "~/db/schema";
import type { Db } from "./db";
import {
  calculateWatchProgress,
  getLastWatchPosition,
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonInProgress,
} from "./progress.server";

type Lesson = typeof lessons.$inferSelect;

function videoProgress(db: Db, userId: number, lesson: Lesson) {
  if (!lesson.videoUrl) return { lastWatchPosition: 0, watchProgress: 0 };
  const lastWatchPosition = getLastWatchPosition(db, userId, lesson.id);
  const videoDurationSeconds = (lesson.durationMinutes ?? 0) * 60;
  const watchProgress =
    videoDurationSeconds > 0
      ? calculateWatchProgress(db, {
          userId,
          lessonId: lesson.id,
          videoDurationSeconds,
        })
      : 0;
  return { lastWatchPosition, watchProgress };
}

/**
 * Marks the lesson in progress and reads the Student's progress through the
 * course and the video. Progress is recorded only for people who can take the
 * course, so a Student under a Country Lock gets none.
 */
export function loadLessonProgress(
  db: Db,
  request: { currentUserId: number | null; courseId: number; canTake: boolean },
  lesson: Lesson
) {
  const lessonProgressMap: Record<number, string> = {};
  const { currentUserId: userId, courseId } = request;
  if (!userId || !request.canTake) {
    return {
      lessonStatus: null,
      lastWatchPosition: 0,
      watchProgress: 0,
      lessonProgressMap,
    };
  }

  markLessonInProgress(db, userId, lesson.id);
  const progress = getLessonProgress(db, userId, lesson.id);

  for (const record of getLessonProgressForCourse(db, userId, courseId)) {
    lessonProgressMap[record.lessonId] = record.status;
  }

  return {
    lessonStatus: (progress?.status ?? null) as string | null,
    ...videoProgress(db, userId, lesson),
    lessonProgressMap,
  };
}
