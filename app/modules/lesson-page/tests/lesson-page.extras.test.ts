import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { QuestionType, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { loadFull, setUpCourse } from "./fixtures";

let course: ReturnType<typeof setUpCourse>;

beforeEach(() => {
  course = setUpCourse();
});

function addComment(
  userId: number,
  body: string,
  extra: { parentId?: number; deletedAt?: string; editedAt?: string } = {}
) {
  return course.db
    .insert(schema.comments)
    .values({
      lessonId: course.lessonIds[1],
      userId,
      body: markdown(body),
      ...extra,
    })
    .returning()
    .get().id;
}

describe("the discussion thread", () => {
  it("nests replies under their question and marks the instructor", async () => {
    const { user, instructor } = course.base;
    const question = addComment(user.id, "Why *types*?");
    addComment(instructor.id, "Safety", { parentId: question });

    const { comments } = await loadFull(course);
    expect(comments).toHaveLength(1);
    expect(comments[0].bodyHtml).toContain("<em>types</em>");
    expect(comments[0].author).toMatchObject({
      name: "Test User",
      isInstructor: false,
      isPlatformAdmin: false,
    });
    expect(comments[0].replies[0].author.isInstructor).toBe(true);
  });

  it("marks a Platform Admin's comment", async () => {
    const admin = course.db
      .insert(schema.users)
      .values({ name: "Admin", email: "a@x.com", role: UserRole.Admin })
      .returning()
      .get();
    addComment(admin.id, "Hi");
    const { comments } = await loadFull(course);
    expect(comments[0].author.isPlatformAdmin).toBe(true);
  });

  it("blanks a deleted question but keeps its replies", async () => {
    const at = new Date().toISOString();
    const question = addComment(course.base.user.id, "secret", {
      deletedAt: at,
      editedAt: at,
    });
    addComment(course.base.instructor.id, "answer", { parentId: question });
    addComment(course.base.user.id, "gone", { deletedAt: at });
    addComment(course.base.user.id, "hidden reply", {
      parentId: question,
      deletedAt: at,
    });

    const { comments } = await loadFull(course);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      deleted: true,
      bodyHtml: "",
      editedAt: null,
    });
    expect(comments[0].replies.map((r) => r.bodyHtml)).toEqual([
      expect.stringContaining("answer"),
    ]);
  });
});

function addVideoLesson(durationMinutes: number | null) {
  course.db
    .update(schema.lessons)
    .set({ videoUrl: "https://youtu.be/x", durationMinutes })
    .run();
}

function watchTo(positionSeconds: number, createdAt: string) {
  course.db
    .insert(schema.videoWatchEvents)
    .values({
      userId: course.base.user.id,
      lessonId: course.lessonIds[1],
      eventType: "progress",
      positionSeconds,
      createdAt,
    })
    .run();
}

describe("video progress", () => {
  it("resumes from the latest position and reports the furthest point", async () => {
    addVideoLesson(10);
    watchTo(450, "2026-01-01T00:00:00.000Z");
    watchTo(120, "2026-01-02T00:00:00.000Z");
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(120);
    expect(page.watchProgress).toBe(75);
  });

  it("caps progress at 100%", async () => {
    addVideoLesson(1);
    watchTo(90, "2026-01-01T00:00:00.000Z");
    expect((await loadFull(course)).watchProgress).toBe(100);
  });

  it("reports no progress without a duration or without a video", async () => {
    addVideoLesson(null);
    watchTo(90, "2026-01-01T00:00:00.000Z");
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(90);
    expect(page.watchProgress).toBe(0);

    const other = await loadFull(course, { lessonId: course.lessonIds[0] });
    expect(other.lastWatchPosition).toBe(0);
  });
});

function addMultipleChoiceQuiz(questionCount: number) {
  const quiz = course.db
    .insert(schema.quizzes)
    .values({ lessonId: course.lessonIds[1], title: "Q", passingScore: 0.7 })
    .returning()
    .get();
  const questions = Array.from({ length: questionCount }, (_, i) => {
    const question = course.db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Q${i}`,
        questionType: QuestionType.MultipleChoice,
        position: i,
      })
      .returning()
      .get();
    const [right, wrong] = [true, false].map(
      (isCorrect) =>
        course.db
          .insert(schema.quizOptions)
          .values({ questionId: question.id, optionText: "o", isCorrect })
          .returning()
          .get().id
    );
    return { id: question.id, right, wrong };
  });
  return { quizId: quiz.id, questions };
}

function submit(correctCount: number, questionCount: number) {
  const { quizId, questions } = addMultipleChoiceQuiz(questionCount);
  const form = new FormData();
  form.set("intent", "submit-quiz");
  form.set("quizId", String(quizId));
  form.set("question-oops", "1");
  questions.forEach((q, i) =>
    form.set(`question-${q.id}`, String(i < correctCount ? q.right : q.wrong))
  );
  return course.lessonPage.submitQuiz(course.base.user.id, quizId, form);
}

describe("quiz grading", () => {
  it.each([
    [9, "A", true],
    [8, "B", true],
    [7, "C", false],
    [6, "D", false],
    [5, "F", false],
  ])("grades %i of 10 correct as %s", (correct, grade, passed) => {
    expect(submit(correct, 10)).toMatchObject({ grade, passed });
  });

  it("records only the answered questions", () => {
    const { quizId, questions } = addMultipleChoiceQuiz(2);
    const form = new FormData();
    form.set(`question-${questions[0].id}`, String(questions[0].right));
    const result = course.lessonPage.submitQuiz(
      course.base.user.id,
      quizId,
      form
    );
    expect(result?.questionResults[1]).toEqual({
      questionId: questions[1].id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    });
    const answers = course.db.select().from(schema.quizAnswers).all();
    expect(answers).toHaveLength(1);
  });

  it("scores an unknown quiz as null", () => {
    expect(
      course.lessonPage.submitQuiz(course.base.user.id, 9999, new FormData())
    ).toBeNull();
  });
});
