import { noteDraftStatus, type NoteDraftStatus } from "./lib/draft";

export type { NoteDraftStatus };

/**
 * What the Lesson page's Note editor shows for the text the Student has typed:
 * the character count against the limit, and whether Save should be enabled.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string
): NoteDraftStatus {
  return noteDraftStatus(draft, savedBody);
}
