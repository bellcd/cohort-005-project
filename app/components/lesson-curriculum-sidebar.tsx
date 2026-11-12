import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ChevronDown, Circle, PlayCircle } from "lucide-react";
import { LessonProgressStatus } from "~/db/schema";
import { cn } from "~/lib/utils";
import type {
  CurriculumModule,
  LessonCourse,
} from "~/components/lesson-page-data";

export function CurriculumSidebar({
  course,
  curriculum,
  currentLessonId,
  lessonProgressMap,
  enrolled,
}: {
  course: LessonCourse;
  curriculum: CurriculumModule[];
  currentLessonId: number;
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
}) {
  const [expandedModules, toggleModule] = useExpandedModules(
    curriculum,
    currentLessonId
  );

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border lg:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
        <div className="border-b border-border p-4">
          <Link
            to={`/courses/${course.slug}`}
            className="text-sm font-semibold hover:text-primary"
          >
            {course.title}
          </Link>
        </div>

        <nav className="flex-1 p-2">
          {curriculum.map((mod) => (
            <SidebarModule
              key={mod.id}
              mod={mod}
              isExpanded={expandedModules.has(mod.id)}
              onToggle={() => toggleModule(mod.id)}
              lessonLink={{
                courseSlug: course.slug,
                currentLessonId,
                lessonProgressMap,
                enrolled,
              }}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function useExpandedModules(
  curriculum: CurriculumModule[],
  currentLessonId: number
) {
  // Find which module the current lesson belongs to
  const currentModuleId = curriculum.find((m) =>
    m.lessons.some((l) => l.id === currentLessonId)
  )?.id;

  const [expandedModules, setExpandedModules] = useState<Set<number>>(() => {
    // Start with current module expanded
    const initial = new Set<number>();
    if (currentModuleId) initial.add(currentModuleId);
    return initial;
  });

  function toggleModule(moduleId: number) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  return [expandedModules, toggleModule] as const;
}

type LessonLinkContext = {
  courseSlug: string;
  currentLessonId: number;
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
};

function SidebarModule({
  mod,
  isExpanded,
  onToggle,
  lessonLink,
}: {
  mod: CurriculumModule;
  isExpanded: boolean;
  onToggle: () => void;
  lessonLink: LessonLinkContext;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            !isExpanded && "-rotate-90"
          )}
        />
        <span className="flex-1 text-left">{mod.title}</span>
      </button>

      {isExpanded && (
        <ul className="ml-4 space-y-0.5 py-1">
          {mod.lessons.map((l) => (
            <SidebarLesson key={l.id} lesson={l} context={lessonLink} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarLesson({
  lesson: l,
  context,
}: {
  lesson: { id: number; title: string };
  context: LessonLinkContext;
}) {
  const isCurrent = l.id === context.currentLessonId;
  const status = context.lessonProgressMap[l.id];

  return (
    <li>
      <Link
        to={`/courses/${context.courseSlug}/lessons/${l.id}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
          isCurrent
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <LessonStatusIcon enrolled={context.enrolled} status={status} />
        <span className="truncate">{l.title}</span>
      </Link>
    </li>
  );
}

function LessonStatusIcon({
  enrolled,
  status,
}: {
  enrolled: boolean;
  status: string | undefined;
}) {
  if (enrolled && status === LessonProgressStatus.Completed) {
    return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
  }
  if (enrolled && status === LessonProgressStatus.InProgress) {
    return <PlayCircle className="size-3.5 shrink-0 text-blue-500" />;
  }
  return <Circle className="size-3.5 shrink-0" />;
}
