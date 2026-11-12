import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { fakeNotifications } from "~/lib/notifications.fake.server";
import { loadFull, setUpCourse } from "./fixtures";

const NOW = new Date("2026-03-01T12:00:00.000Z");

let course: ReturnType<typeof setUpCourse>;

beforeEach(() => {
  course = setUpCourse();
});

describe("writing comments", () => {
  async function post(body: string) {
    const created = await course.lessonPage.postComment(
      {
        userId: course.base.user.id,
        lessonId: course.lessonIds[1],
        parentId: null,
        body,
      },
      NOW,
      fakeNotifications()
    );
    if (!created.ok) throw new Error(created.error);
    return created;
  }

  it("shows a posted comment in the lesson's thread", async () => {
    await post("Why does this compile?");
    const page = await loadFull(course);
    expect(page.comments.map((c) => c.body)).toEqual([
      "Why does this compile?",
    ]);
  });

  it("shows an edited comment's new body", async () => {
    const created = await post("Frist");
    const commentId = (await loadFull(course)).comments[0].id;
    expect(created.ok).toBe(true);
    course.lessonPage.editComment(
      { commentId, userId: course.base.user.id, body: "First" },
      NOW
    );
    const page = await loadFull(course);
    expect(page.comments[0].body).toBe("First");
  });

  it("drops a deleted comment with no replies from the thread", async () => {
    await post("Never mind");
    const commentId = (await loadFull(course)).comments[0].id;
    const deleted = await course.lessonPage.deleteComment(
      { commentId, userId: course.base.user.id, canModerate: false },
      NOW,
      fakeNotifications()
    );
    expect(deleted.ok).toBe(true);
    expect((await loadFull(course)).comments).toEqual([]);
  });
});

function addQuiz(questions: { isCorrect: boolean }[][]) {
  const quiz = course.db
    .insert(schema.quizzes)
    .values({ lessonId: course.lessonIds[1], title: "Q", passingScore: 0.7 })
    .returning()
    .get();
  const added = questions.map((options, position) => {
    const question = course.db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Q${position}`,
        questionType: QuestionType.MultipleChoice,
        position,
      })
      .returning()
      .get();
    const optionIds = options.map(
      ({ isCorrect }, i) =>
        course.db
          .insert(schema.quizOptions)
          .values({ questionId: question.id, optionText: `o${i}`, isCorrect })
          .returning()
          .get().id
    );
    return { id: question.id, optionIds };
  });
  return { quizId: quiz.id, questions: added };
}

describe("quiz edge cases", () => {
  it("shows each question only its own options", async () => {
    const { questions } = addQuiz([
      [{ isCorrect: true }, { isCorrect: false }],
      [{ isCorrect: false }, { isCorrect: true }],
    ]);
    const page = await loadFull(course);
    expect(page.quiz?.questions.map((q) => q.options.map((o) => o.id))).toEqual(
      questions.map((q) => q.optionIds)
    );
  });

  it("loads and scores a quiz with no questions", async () => {
    const { quizId } = addQuiz([]);
    expect((await loadFull(course)).quiz?.questions).toEqual([]);
    const result = course.lessonPage.submitQuiz(
      course.base.user.id,
      quizId,
      new FormData()
    );
    expect(result).toMatchObject({ score: 0, totalQuestions: 0 });
  });

  it("records an attempt with no answers", () => {
    const { quizId } = addQuiz([[{ isCorrect: true }]]);
    const result = course.lessonPage.submitQuiz(
      course.base.user.id,
      quizId,
      new FormData()
    );
    expect(result).toMatchObject({ score: 0, passed: false });
    expect(course.db.select().from(schema.quizAttempts).all()).toHaveLength(1);
  });

  it("marks the first of several correct options as the answer", () => {
    const { quizId, questions } = addQuiz([
      [{ isCorrect: true }, { isCorrect: true }],
    ]);
    const [first] = questions[0].optionIds;
    const form = new FormData();
    form.set(`question-${questions[0].id}`, String(first));
    const result = course.lessonPage.submitQuiz(
      course.base.user.id,
      quizId,
      form
    );
    expect(result?.questionResults[0]).toMatchObject({
      correct: true,
      correctOptionId: first,
    });
  });

  it("ignores answer fields without the question- prefix", () => {
    const { quizId, questions } = addQuiz([[{ isCorrect: true }]]);
    const form = new FormData();
    form.set(String(questions[0].id), String(questions[0].optionIds[0]));
    const result = course.lessonPage.submitQuiz(
      course.base.user.id,
      quizId,
      form
    );
    expect(result?.totalCorrect).toBe(0);
  });
});
