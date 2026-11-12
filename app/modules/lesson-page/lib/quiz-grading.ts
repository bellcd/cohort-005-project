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
    if (key.startsWith("question-")) {
      const questionId = Number(key.replace("question-", ""));
      const optionId = Number(value);
      if (!isNaN(questionId) && !isNaN(optionId)) {
        selectedAnswers[questionId] = optionId;
      }
    }
  }
  return selectedAnswers;
}
