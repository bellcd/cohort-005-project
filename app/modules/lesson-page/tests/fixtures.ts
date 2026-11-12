import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLessonPage, type LessonPageRequest } from "../index.server";

/** A course with two modules: lessons One and Two, then Three. */
export function setUpCourse() {
  const db = createTestDb();
  const base = seedBaseData(db);
  const addModule = (title: string, position: number) =>
    db
      .insert(schema.modules)
      .values({ courseId: base.course.id, title, position })
      .returning()
      .get().id;
  const addLesson = (moduleId: number, title: string, position: number) =>
    db
      .insert(schema.lessons)
      .values({ moduleId, title, position, content: markdown("# Hello") })
      .returning()
      .get().id;
  const first = addModule("Basics", 1);
  const second = addModule("Advanced", 2);
  const lessonIds = [
    addLesson(first, "One", 1),
    addLesson(first, "Two", 2),
    addLesson(second, "Three", 1),
  ];
  const request = (
    overrides: Partial<LessonPageRequest> = {}
  ): LessonPageRequest => ({
    courseId: base.course.id,
    instructorId: base.instructor.id,
    lessonId: lessonIds[1],
    currentUserId: base.user.id,
    enrolled: true,
    lockedReason: null,
    canTake: true,
    canModerate: false,
    ...overrides,
  });
  return {
    db,
    base,
    lessonIds,
    request,
    lessonPage: createLessonPage(db),
  };
}

/** Loads the page and fails the test unless it is the full view. */
export async function loadFull(
  course: ReturnType<typeof setUpCourse>,
  overrides: Partial<LessonPageRequest> = {}
) {
  const page = await course.lessonPage.load(course.request(overrides));
  if (page?.view !== "full") throw new Error("expected the full page");
  return page;
}
