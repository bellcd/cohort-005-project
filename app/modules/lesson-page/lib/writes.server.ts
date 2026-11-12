import {
  createComment,
  deleteComment,
  editComment,
} from "~/lib/comments.server";
import { toggleBookmark } from "~/lib/bookmarks.server";
import { saveNote } from "~/lib/notes.server";
import type { Notifications } from "~/lib/notifications.server";
import type { Db } from "./db";

type StudentLesson = { userId: number; lessonId: number };

/** What a viewer writes on the lesson: comments, Bookmarks and Notes. */
export function createLessonWrites(database: Db) {
  return {
    postComment(
      post: StudentLesson & { parentId: number | null; body: string },
      now: Date,
      notifications: Notifications
    ) {
      const { userId, lessonId, parentId, body } = post;
      return createComment(
        database,
        userId,
        lessonId,
        parentId,
        body,
        now,
        notifications
      );
    },

    editComment(
      edit: { commentId: number; userId: number; body: string },
      now: Date
    ) {
      const { commentId, userId, body } = edit;
      return editComment(database, commentId, userId, body, now);
    },

    /** `canModerate` allows deleting someone else's comment. */
    deleteComment(
      removal: { commentId: number; userId: number; canModerate: boolean },
      now: Date,
      notifications: Notifications
    ) {
      const { commentId, userId, canModerate } = removal;
      return deleteComment(
        database,
        commentId,
        userId,
        canModerate,
        now,
        notifications
      );
    },

    /** True if the lesson is bookmarked after the toggle. */
    toggleBookmark({ userId, lessonId }: StudentLesson, now: Date) {
      return toggleBookmark(database, userId, lessonId, now);
    },

    saveNote(note: StudentLesson & { body: string }, now: Date) {
      const { userId, lessonId, body } = note;
      return saveNote(database, userId, lessonId, body, now);
    },
  };
}
