import { useEffect, useState } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import type {
  LessonQuiz,
  LessonQuizBestAttempt,
  LessonQuizQuestionResult,
  LessonQuizResult,
} from "~/components/lesson-page-data";

type SelectedAnswers = Record<number, number>;

export function QuizSection({
  quiz,
  bestAttempt,
  quizResult,
  quizFetcher,
  isSubmitting,
}: {
  quiz: LessonQuiz;
  bestAttempt: LessonQuizBestAttempt | null;
  quizResult: LessonQuizResult | null;
  quizFetcher: ReturnType<typeof useFetcher>;
  isSubmitting: boolean;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({});
  const [showQuiz, setShowQuiz] = useState(!bestAttempt?.passed);
  const [retaking, setRetaking] = useState(false);

  useQuizResultToast(quizResult, retaking);

  if (quizResult && !retaking) {
    return (
      <QuizResultCard
        quiz={quiz}
        quizResult={quizResult}
        onRetake={() => {
          setSelectedAnswers({});
          setRetaking(true);
        }}
      />
    );
  }

  if (!showQuiz && bestAttempt?.passed) {
    return (
      <QuizPassedSummary
        title={quiz.title}
        bestAttempt={bestAttempt}
        onRetake={() => setShowQuiz(true)}
      />
    );
  }

  return (
    <QuizForm
      quiz={quiz}
      answers={{ selected: selectedAnswers, setSelected: setSelectedAnswers }}
      form={{ quizFetcher, isSubmitting, onSubmit: () => setRetaking(false) }}
    />
  );
}

function useQuizResultToast(
  quizResult: LessonQuizResult | null,
  retaking: boolean
) {
  useEffect(() => {
    if (quizResult && !retaking) {
      if (quizResult.passed) {
        toast.success(
          `Quiz passed! Score: ${Math.round(quizResult.score * 100)}%`
        );
      } else {
        toast.error(
          `Quiz not passed. Score: ${Math.round(quizResult.score * 100)}%`
        );
      }
    }
  }, [quizResult, retaking]);
}

function QuizTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <HelpCircle className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  );
}

function QuizResultCard({
  quiz,
  quizResult,
  onRetake,
}: {
  quiz: LessonQuiz;
  quizResult: LessonQuizResult;
  onRetake: () => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <QuizTitle title={quiz.title} />

        <QuizResultSummary quizResult={quizResult} />

        {/* Per-question results */}
        <div className="space-y-4">
          {quiz.questions.map((question, qIndex) => (
            <QuestionResult
              key={question.id}
              question={question}
              number={qIndex + 1}
              result={quizResult.questionResults.find(
                (r) => r.questionId === question.id
              )}
            />
          ))}
        </div>

        {/* Retake button */}
        {!quizResult.passed && (
          <div className="mt-6">
            <Button variant="outline" onClick={onRetake}>
              <RotateCcw className="mr-2 size-4" />
              Retake Quiz
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuizResultSummary({ quizResult }: { quizResult: LessonQuizResult }) {
  return (
    <div
      className={`mb-6 rounded-lg p-4 ${quizResult.passed ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}
    >
      <div className="flex items-center gap-3">
        {quizResult.passed ? (
          <Trophy className="size-8 text-green-600" />
        ) : (
          <XCircle className="size-8 text-red-600" />
        )}
        <div>
          <p
            className={`text-lg font-semibold ${quizResult.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
          >
            {quizResult.passed ? "You passed!" : "Not quite — try again!"}
          </p>
          <p className="text-sm text-muted-foreground">
            Score: {quizResult.totalCorrect}/{quizResult.totalQuestions} (
            {Math.round(quizResult.score * 100)}%) — Grade: {quizResult.grade}
          </p>
        </div>
      </div>
    </div>
  );
}

type QuizQuestion = LessonQuiz["questions"][number];

function QuestionResult({
  question,
  number,
  result,
}: {
  question: QuizQuestion;
  number: number;
  result: LessonQuizQuestionResult | undefined;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start gap-2">
        {result?.correct ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
        )}
        <p className="font-medium">
          {number}. {question.questionText}
        </p>
      </div>
      <div className="ml-7 space-y-1">
        {question.options.map((option) => {
          const isSelected = result?.selectedOptionId === option.id;
          const isCorrect = result?.correctOptionId === option.id;
          let className = "text-sm";
          if (isCorrect)
            className += " font-medium text-green-700 dark:text-green-400";
          else if (isSelected && !result?.correct)
            className += " text-red-600 dark:text-red-400 line-through";
          return (
            <p key={option.id} className={className}>
              {isCorrect ? "✓ " : isSelected ? "✗ " : "  "}
              {option.optionText}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function QuizPassedSummary({
  title,
  bestAttempt,
  onRetake,
}: {
  title: string;
  bestAttempt: LessonQuizBestAttempt;
  onRetake: () => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-green-600" />
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">
              — Best score: {Math.round(bestAttempt.score * 100)}%
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onRetake}>
            <RotateCcw className="mr-2 size-4" />
            Retake
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type QuizAnswers = {
  selected: SelectedAnswers;
  setSelected: React.Dispatch<React.SetStateAction<SelectedAnswers>>;
};

function QuizForm({
  quiz,
  answers,
  form,
}: {
  quiz: LessonQuiz;
  answers: QuizAnswers;
  form: {
    quizFetcher: ReturnType<typeof useFetcher>;
    isSubmitting: boolean;
    onSubmit: () => void;
  };
}) {
  const { quizFetcher } = form;
  const allAnswered = quiz.questions.every(
    (q) => answers.selected[q.id] !== undefined
  );

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <QuizTitle title={quiz.title} />
        <p className="mb-6 text-sm text-muted-foreground">
          Answer all questions and submit. Passing score:{" "}
          {Math.round(quiz.passingScore * 100)}%.
        </p>

        <quizFetcher.Form method="post" onSubmit={form.onSubmit}>
          <input type="hidden" name="intent" value="submit-quiz" />
          <input type="hidden" name="quizId" value={quiz.id} />

          <div className="space-y-6">
            {quiz.questions.map((question, qIndex) => (
              <QuestionInput
                key={question.id}
                question={question}
                number={qIndex + 1}
                answers={answers}
              />
            ))}
          </div>

          <QuizSubmit
            allAnswered={allAnswered}
            isSubmitting={form.isSubmitting}
          />
        </quizFetcher.Form>
      </CardContent>
    </Card>
  );
}

function QuestionInput({
  question,
  number,
  answers,
}: {
  question: QuizQuestion;
  number: number;
  answers: QuizAnswers;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 font-medium">
        {number}. {question.questionText}
      </p>
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={answers.selected[question.id] === option.id}
              onChange={() =>
                answers.setSelected((prev) => ({
                  ...prev,
                  [question.id]: option.id,
                }))
              }
              className="size-4 accent-primary"
            />
            <span className="text-sm">{option.optionText}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function QuizSubmit({
  allAnswered,
  isSubmitting,
}: {
  allAnswered: boolean;
  isSubmitting: boolean;
}) {
  return (
    <div className="mt-6">
      <Button type="submit" disabled={!allAnswered || isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Quiz"}
      </Button>
      {!allAnswered && (
        <p className="mt-2 text-sm text-muted-foreground">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}
