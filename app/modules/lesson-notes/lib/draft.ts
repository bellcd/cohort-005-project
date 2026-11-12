import { MAX_NOTE_LENGTH } from "~/lib/notes";

/** Share of the limit at which the counter starts warning the Student. */
const NEAR_LIMIT_RATIO = 0.9;

export type NoteDraftStatus = {
  length: number;
  max: number;
  remaining: number;
  nearLimit: boolean;
  overLimit: boolean;
  dirty: boolean;
  canSave: boolean;
};

/**
 * What the Lesson page's Note editor shows for the text the Student has typed:
 * the character count against the limit, and whether Save should be enabled.
 */
// Counts the trimmed draft because the server trims before it checks the
// limit; counting the raw text would warn about whitespace that never saves.
export function describeNoteDraft(
  draft: string,
  savedBody: string
): NoteDraftStatus {
  const length = draft.trim().length;
  const overLimit = length > MAX_NOTE_LENGTH;
  const dirty = draft.trim() !== savedBody;
  return {
    length,
    max: MAX_NOTE_LENGTH,
    remaining: MAX_NOTE_LENGTH - length,
    nearLimit: !overLimit && length >= MAX_NOTE_LENGTH * NEAR_LIMIT_RATIO,
    overLimit,
    dirty,
    canSave: dirty && length > 0 && !overLimit,
  };
}
