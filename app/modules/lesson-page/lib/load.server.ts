import { getNote } from "~/lib/notes.server";
import { isBookmarked } from "~/lib/bookmarks.server";
import { renderMarkdown } from "~/lib/markdown.server";
import type { DenialReason } from "~/modules/permissions/course-permissions.server";
import {
  getCourseWithDetails,
  getLessonById,
  getModuleById,
  getUserById,
} from "./course.server";
import type { lessons } from "~/db/schema";
import type { Db } from "./db";

type Lesson = typeof lessons.$inferSelect;
import { neighbouringLessons, toCurriculum } from "./navigation";
import { loadLessonProgress } from "./load-progress.server";
import { getLessonQuiz } from "./quiz.server";
import { getRenderedLessonThread } from "./thread.server";

export type LessonPageRequest = {
  courseId: number;
  instructorId: number;
  lessonId: number;
  currentUserId: number | null;
  enrolled: boolean;
  /** Why the person may not view the content; null when they may. */
  lockedReason: DenialReason | null;
  canTake: boolean;
  canModerate: boolean;
};

function loadLessonContext(db: Db, request: LessonPageRequest) {
  const courseWithDetails = getCourseWithDetails(db, request.courseId);
  const lesson = getLessonById(db, request.lessonId);
  const mod = lesson ? getModuleById(db, lesson.moduleId) : undefined;
  if (!courseWithDetails || !lesson || !mod) return null;
  return {
    courseWithDetails,
    lesson,
    mod,
    page: {
      course: {
        id: courseWithDetails.id,
        title: courseWithDetails.title,
        slug: courseWithDetails.slug,
      },
      curriculum: toCurriculum(courseWithDetails),
      module: { id: mod.id, title: mod.title },
      enrolled: request.enrolled,
    },
  };
}

async function loadConfidential(
  db: Db,
  request: LessonPageRequest,
  content: Lesson["content"]
) {
  const { lessonId, currentUserId } = request;
  const note = currentUserId ? getNote(db, currentUserId, lessonId) : undefined;
  return {
    comments: await getRenderedLessonThread(db, lessonId),
    instructorName:
      getUserById(db, request.instructorId)?.name ?? "your instructor",
    bookmarked: currentUserId
      ? isBookmarked(db, currentUserId, lessonId)
      : false,
    note: note ? { body: note.body, updatedAt: note.updatedAt } : null,
    // Render lesson content from Markdown to HTML server-side
    contentHtml: content ? await renderMarkdown(content) : null,
  };
}

/**
 * Everything the lesson page shows. Someone who can't view the content gets
 * the lesson's title, its module and the course outline — never the body,
 * video or quiz — plus the reason, so the page can show the right call to
 * action. Null when the lesson or its module is missing.
 */
export async function loadLessonPage(db: Db, request: LessonPageRequest) {
  const context = loadLessonContext(db, request);
  if (!context) return null;
  const { courseWithDetails, lesson, page } = context;

  if (request.lockedReason) {
    return {
      view: "locked" as const,
      ...page,
      lesson: { id: lesson.id, title: lesson.title },
      lockedReason: request.lockedReason,
    };
  }

  // Everything from here on is behind the can-view-content bar above:
  // comments, Bookmarks and Notes are confidential to the course.
  return {
    view: "full" as const,
    ...page,
    lesson,
    currentUserId: request.currentUserId,
    ...loadLessonProgress(db, request, lesson),
    ...neighbouringLessons(courseWithDetails, request.lessonId),
    ...getLessonQuiz(db, request.lessonId, request.currentUserId),
    ...(await loadConfidential(db, request, lesson.content)),
    canModerate: request.canModerate,
  };
}

export type LessonPageData = NonNullable<
  Awaited<ReturnType<typeof loadLessonPage>>
>;
