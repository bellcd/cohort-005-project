type FlatLesson = {
  id: number;
  title: string;
  moduleId: number;
  moduleTitle: string;
};

type CourseOutline = {
  modules: Array<{
    id: number;
    title: string;
    lessons: Array<{ id: number; title: string; moduleId?: number }>;
  }>;
};

function flattenCourseLessons(course: CourseOutline): FlatLesson[] {
  const flat: FlatLesson[] = [];
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      flat.push({
        id: lesson.id,
        title: lesson.title,
        moduleId: mod.id,
        moduleTitle: mod.title,
      });
    }
  }
  return flat;
}

/** The lessons either side of this one, in course order, across modules. */
export function neighbouringLessons(course: CourseOutline, lessonId: number) {
  const allLessons = flattenCourseLessons(course);
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  return { prevLesson, nextLesson };
}

/** The course outline the curriculum sidebar shows: titles only. */
export function toCurriculum(course: CourseOutline) {
  return course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
    })),
  }));
}
