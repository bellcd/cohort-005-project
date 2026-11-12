import { describe, expect, it } from "vitest";
import { describeNoteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("describeNoteDraft", () => {
  it("counts the trimmed draft against the Note limit", () => {
    const status = describeNoteDraft("  hello  ", "");
    expect(status.length).toBe(5);
    expect(status.max).toBe(MAX_NOTE_LENGTH);
    expect(status.remaining).toBe(MAX_NOTE_LENGTH - 5);
  });

  it("cannot save an empty or whitespace-only draft", () => {
    expect(describeNoteDraft("", "").canSave).toBe(false);
    expect(describeNoteDraft("   \n ", "").canSave).toBe(false);
  });

  it("cannot save a cleared draft over a saved Note", () => {
    const status = describeNoteDraft("  ", "my note");
    expect(status.dirty).toBe(true);
    expect(status.canSave).toBe(false);
  });

  it("cannot save a draft that matches the saved Note", () => {
    const status = describeNoteDraft("my note ", "my note");
    expect(status.dirty).toBe(false);
    expect(status.canSave).toBe(false);
  });

  it("can save a changed draft within the limit", () => {
    const status = describeNoteDraft("my new note", "my note");
    expect(status.dirty).toBe(true);
    expect(status.canSave).toBe(true);
  });

  it("can save a draft of exactly the limit", () => {
    const status = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), "");
    expect(status.overLimit).toBe(false);
    expect(status.remaining).toBe(0);
    expect(status.canSave).toBe(true);
  });

  it("cannot save a draft over the limit", () => {
    const status = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), "");
    expect(status.overLimit).toBe(true);
    expect(status.nearLimit).toBe(false);
    expect(status.remaining).toBe(-1);
    expect(status.canSave).toBe(false);
  });

  it("warns from 90% of the limit", () => {
    const threshold = MAX_NOTE_LENGTH * 0.9;
    expect(describeNoteDraft("a".repeat(threshold - 1), "").nearLimit).toBe(
      false
    );
    expect(describeNoteDraft("a".repeat(threshold), "").nearLimit).toBe(true);
  });
});
