import { z } from "zod";

const idSchema = z.coerce.number().int().positive();

export function calculateGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

/**
 * The answers in a quiz submission: form fields named "question-{questionId}"
 * whose value is the chosen option id.
 */
export function parseQuizAnswers(formData: FormData): Record<number, number> {
  const selectedAnswers: Record<number, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("question-")) continue;
    const questionId = idSchema.safeParse(key.replace("question-", ""));
    const optionId = idSchema.safeParse(value);
    if (questionId.success && optionId.success) {
      selectedAnswers[questionId.data] = optionId.data;
    }
  }
  return selectedAnswers;
}
