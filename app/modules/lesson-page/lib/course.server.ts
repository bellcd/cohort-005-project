import { eq, or } from "drizzle-orm";
import { categories, courses, lessons, modules, users } from "~/db/schema";
import type { Db } from "./db";

function getCourseRow(db: Db, id: number) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      instructorBio: users.bio,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.id, id))
    .get();
}

function getCourseModules(db: Db, courseId: number) {
  const courseModules = db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)
    .all();

  const moduleIds = courseModules.map((m) => m.id);

  const courseLessons =
    moduleIds.length > 0
      ? db
          .select()
          .from(lessons)
          .where(or(...moduleIds.map((mid) => eq(lessons.moduleId, mid))))
          .orderBy(lessons.position)
          .all()
      : [];

  return courseModules.map((mod) => ({
    ...mod,
    lessons: courseLessons.filter((l) => l.moduleId === mod.id),
  }));
}

export function getCourseWithDetails(db: Db, id: number) {
  const course = getCourseRow(db, id);
  if (!course) return null;
  return { ...course, modules: getCourseModules(db, id) };
}

export type CourseWithDetails = NonNullable<
  ReturnType<typeof getCourseWithDetails>
>;

export function getLessonById(db: Db, id: number) {
  return db.select().from(lessons).where(eq(lessons.id, id)).get();
}

export function getModuleById(db: Db, id: number) {
  return db.select().from(modules).where(eq(modules.id, id)).get();
}

export function getUserById(db: Db, id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}
