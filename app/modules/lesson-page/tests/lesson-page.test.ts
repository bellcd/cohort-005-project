import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { LessonProgressStatus, QuestionType } from "~/db/schema";
import { saveNote } from "~/lib/notes.server";
import type { LessonPageRequest } from "../index.server";
import { setUpCourse } from "./fixtures";

let course: ReturnType<typeof setUpCourse>;
let db: ReturnType<typeof setUpCourse>["db"];
let base: ReturnType<typeof setUpCourse>["base"];
let lessonPage: ReturnType<typeof setUpCourse>["lessonPage"];
let lessonIds: number[];

function request(overrides: Partial<LessonPageRequest>) {
  return course.request(overrides);
}

function progressRows() {
  return db.select().from(schema.lessonProgress).all();
}

beforeEach(() => {
  course = setUpCourse();
  ({ db, base, lessonPage, lessonIds } = course);
});

describe("loading the lesson page", () => {
  it("is null for a lesson that does not exist", async () => {
    expect(await lessonPage.load(request({ lessonId: 9999 }))).toBeNull();
  });

  it("shows only the outline and the reason when the lesson is locked", async () => {
    const page = await lessonPage.load(
      request({ lockedReason: { kind: "not-enrolled" }, enrolled: false })
    );
    expect(page).toEqual({
      view: "locked",
      course: {
        id: base.course.id,
        title: "Test Course",
        slug: "test-course",
      },
      curriculum: [
        {
          id: expect.any(Number),
          title: "Basics",
          lessons: [
            { id: lessonIds[0], title: "One" },
            { id: lessonIds[1], title: "Two" },
          ],
        },
        {
          id: expect.any(Number),
          title: "Advanced",
          lessons: [{ id: lessonIds[2], title: "Three" }],
        },
      ],
      module: { id: expect.any(Number), title: "Basics" },
      lesson: { id: lessonIds[1], title: "Two" },
      enrolled: false,
      lockedReason: { kind: "not-enrolled" },
    });
    expect(progressRows()).toHaveLength(0);
  });

  it("marks the lesson in progress for someone who can take the course", async () => {
    const page = await lessonPage.load(request({}));
    expect(page?.view).toBe("full");
    if (page?.view !== "full") return;
    expect(page.lessonStatus).toBe(LessonProgressStatus.InProgress);
    expect(page.lessonProgressMap).toEqual({
      [lessonIds[1]]: LessonProgressStatus.InProgress,
    });
    expect(page.contentHtml).toContain("Hello");
  });

  it("records no progress for someone who can view but not take", async () => {
    const page = await lessonPage.load(request({ canTake: false }));
    if (page?.view !== "full") throw new Error("expected the full page");
    expect(page.lessonStatus).toBeNull();
    expect(progressRows()).toHaveLength(0);
  });

  it("links the neighbouring lessons across modules", async () => {
    const middle = await lessonPage.load(request({}));
    if (middle?.view !== "full") throw new Error("expected the full page");
    expect(middle.prevLesson?.id).toBe(lessonIds[0]);
    expect(middle.nextLesson).toMatchObject({
      id: lessonIds[2],
      moduleTitle: "Advanced",
    });

    const last = await lessonPage.load(request({ lessonId: lessonIds[2] }));
    if (last?.view !== "full") throw new Error("expected the full page");
    expect(last.nextLesson).toBeNull();
  });

  it("includes the Student's own Note", async () => {
    saveNote(db, base.user.id, lessonIds[1], "Remember this", new Date());
    const page = await lessonPage.load(request({}));
    if (page?.view !== "full") throw new Error("expected the full page");
    expect(page.note?.body).toBe("Remember this");
    expect(page.bookmarked).toBe(false);
    expect(page.instructorName).toBe("Test Instructor");
  });
});

function addQuiz() {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId: lessonIds[1], title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const question = db
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "Is TS typed?",
      questionType: QuestionType.TrueFalse,
      position: 1,
    })
    .returning()
    .get();
  const [right, wrong] = [true, false].map(
    (isCorrect) =>
      db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: String(isCorrect),
          isCorrect,
        })
        .returning()
        .get().id
  );
  return { quiz, question, right, wrong };
}

function answer(questionId: number, optionId: number) {
  const form = new FormData();
  form.set("intent", "submit-quiz");
  form.set(`question-${questionId}`, String(optionId));
  return form;
}

describe("quizzes", () => {
  it("sends the quiz without its answers", async () => {
    addQuiz();
    const page = await lessonPage.load(request({}));
    if (page?.view !== "full") throw new Error("expected the full page");
    expect(page.quiz?.questions[0].options).toEqual([
      { id: expect.any(Number), optionText: "true" },
      { id: expect.any(Number), optionText: "false" },
    ]);
    expect(page.bestAttempt).toBeNull();
  });

  it("scores a correct submission as a pass and records it", async () => {
    const { quiz, question, right } = addQuiz();
    const result = lessonPage.submitQuiz(
      base.user.id,
      quiz.id,
      answer(question.id, right)
    );
    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 1,
      totalQuestions: 1,
    });

    const page = await lessonPage.load(request({}));
    if (page?.view !== "full") throw new Error("expected the full page");
    expect(page.bestAttempt).toEqual({ score: 1, passed: true });
  });

  it("scores a wrong submission as a fail", () => {
    const { quiz, question, right, wrong } = addQuiz();
    const result = lessonPage.submitQuiz(
      base.user.id,
      quiz.id,
      answer(question.id, wrong)
    );
    expect(result).toMatchObject({ score: 0, passed: false, grade: "F" });
    expect(result?.questionResults).toEqual([
      {
        questionId: question.id,
        correct: false,
        selectedOptionId: wrong,
        correctOptionId: right,
      },
    ]);
  });

  it("finds a quiz by id", () => {
    const { quiz } = addQuiz();
    expect(lessonPage.getQuiz(quiz.id)?.lessonId).toBe(lessonIds[1]);
    expect(lessonPage.getQuiz(9999)).toBeUndefined();
  });
});

describe("marking a lesson complete", () => {
  it("completes a lesson already in progress", async () => {
    await lessonPage.load(request({}));
    lessonPage.markComplete(base.user.id, lessonIds[1]);
    expect(progressRows()).toMatchObject([
      { lessonId: lessonIds[1], status: LessonProgressStatus.Completed },
    ]);
  });

  it("stays complete when the lesson is viewed again", async () => {
    lessonPage.markComplete(base.user.id, lessonIds[1]);
    const page = await lessonPage.load(request({}));
    if (page?.view !== "full") throw new Error("expected the full page");
    expect(page.lessonStatus).toBe(LessonProgressStatus.Completed);
  });
});
