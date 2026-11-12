import { useState } from "react";
import { useFetcher } from "react-router";
import { Check, Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import {
  describeNoteDraft,
  type NoteDraftStatus,
} from "~/modules/lesson-notes";
import { cn, formatRelativeTime } from "~/lib/utils";

export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const savedBody = note?.body ?? "";
  const [draft, setDraft] = useState(savedBody);
  const status = describeNoteDraft(draft, savedBody);
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;
  const justSaved = fetcher.data?.ok && !status.dirty && !isSaving;

  return (
    <Card className="mb-8 gap-0 py-0">
      <LessonNoteHeader />

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save-note" />
        <CardContent className="py-4">
          <label htmlFor="lesson-note-body" className="sr-only">
            Your notes
          </label>
          <Textarea
            id="lesson-note-body"
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What stood out in this lesson?"
            aria-invalid={status.overLimit || !!error}
            aria-describedby="lesson-note-status"
            className="min-h-40 resize-y leading-relaxed"
          />
        </CardContent>

        <CardFooter className="justify-between gap-4 rounded-b-xl border-t bg-muted/40 py-3 [.border-t]:pt-3">
          <LessonNoteStatus
            error={error}
            justSaved={!!justSaved}
            dirty={status.dirty}
            updatedAt={note?.updatedAt}
          />

          <LessonNoteActions status={status} isSaving={isSaving} />
        </CardFooter>
      </fetcher.Form>
    </Card>
  );
}

function LessonNoteHeader() {
  return (
    <CardHeader className="border-b py-4 [.border-b]:pb-4">
      <CardTitle className="flex items-center gap-2 text-base">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <NotebookPen className="size-4" />
        </span>
        Your notes
      </CardTitle>
      <CardDescription className="flex items-center gap-1.5">
        <Lock className="size-3" />
        Private to you. Jot down ideas, questions and takeaways as you watch.
      </CardDescription>
    </CardHeader>
  );
}

function LessonNoteStatus({
  error,
  justSaved,
  dirty,
  updatedAt,
}: {
  error: string | undefined;
  justSaved: boolean;
  dirty: boolean;
  updatedAt: string | undefined;
}) {
  return (
    <div
      id="lesson-note-status"
      aria-live="polite"
      className="text-xs text-muted-foreground"
    >
      {error ? (
        <span className="text-destructive">{error}</span>
      ) : justSaved ? (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" />
          Saved
        </span>
      ) : dirty ? (
        <span>Unsaved changes</span>
      ) : updatedAt ? (
        <span suppressHydrationWarning>
          Last edited {formatRelativeTime(updatedAt)}
        </span>
      ) : null}
    </div>
  );
}

function LessonNoteCounter({ status }: { status: NoteDraftStatus }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums text-muted-foreground",
        status.nearLimit && "text-amber-600 dark:text-amber-400",
        status.overLimit && "font-medium text-destructive"
      )}
    >
      {status.length.toLocaleString("en")} / {status.max.toLocaleString("en")}
    </span>
  );
}

function LessonNoteActions({
  status,
  isSaving,
}: {
  status: NoteDraftStatus;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <LessonNoteCounter status={status} />
      <Button type="submit" size="sm" disabled={isSaving || !status.canSave}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>
    </div>
  );
}
