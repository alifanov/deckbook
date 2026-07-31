import { OWNER } from "../../../domain/author";
import { addComment } from "../../../domain/comments";
import {
  assignTask,
  createTask,
  deleteTask,
  moveTask,
  parseStatus,
  setRecurrence,
  setStatus,
  updateTask,
} from "../../../domain/tasks";
import { applyTemplate, markAsTemplate } from "../../../domain/templates";
import { formHandler, optional, text } from "../../../http";

export const POST = formHandler(async (form) => {
  const id = text(form, "id");

  switch (text(form, "intent")) {
    case "create":
      await createTask(
        {
          projectId: text(form, "projectId"),
          parentId: optional(form, "parentId"),
          title: text(form, "title"),
          description: text(form, "description"),
        },
        OWNER,
      );
      return;

    case "update":
      await updateTask(
        id,
        { title: text(form, "title"), description: text(form, "description") },
        OWNER,
      );
      return;

    case "status":
      await setStatus(id, parseStatus(text(form, "status")), OWNER);
      return;

    case "assign":
      await assignTask(id, optional(form, "tokenId"), OWNER);
      return;

    case "move":
      await moveTask(id, optional(form, "parentId"), OWNER);
      return;

    case "recurrence": {
      const days = optional(form, "days");
      await setRecurrence(id, days === null ? null : Number(days), OWNER);
      return;
    }

    case "comment":
      await addComment(id, text(form, "body"), OWNER);
      return;

    case "make-template":
      await markAsTemplate(id, {
        global: text(form, "scope") === "global",
        projectId: optional(form, "projectId") ?? undefined,
      });
      return;

    case "apply-template":
      await applyTemplate(
        text(form, "templateId"),
        { projectId: text(form, "projectId"), parentId: optional(form, "parentId") },
        OWNER,
      );
      return;

    case "delete": {
      await deleteTask(id);
      return text(form, "after") || undefined;
    }
  }
});
