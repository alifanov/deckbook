import { OWNER } from "../../../domain/author";
import { addComment } from "../../../domain/comments";
import {
  assignTask,
  assignTaskToOwner,
  assignUnassigned,
  createTask,
  deleteTask,
  moveTask,
  OWNER_ASSIGNEE,
  parseDueDate,
  parsePriority,
  parseStatus,
  setDueDate,
  setPriority,
  setRecurrence,
  setStatus,
  updateTask,
} from "../../../domain/tasks";
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

    case "priority":
      await setPriority(id, parsePriority(text(form, "priority")), OWNER);
      return;

    case "assign": {
      const assignee = optional(form, "tokenId");
      if (assignee === OWNER_ASSIGNEE) await assignTaskToOwner(id, OWNER);
      else await assignTask(id, assignee, OWNER);
      return;
    }

    case "assign-unassigned":
      await assignUnassigned(text(form, "projectId"), text(form, "tokenId"), OWNER);
      return;

    case "move":
      await moveTask(id, optional(form, "parentId"), OWNER);
      return;

    case "recurrence": {
      const days = optional(form, "days");
      await setRecurrence(id, days === null ? null : Number(days), OWNER);
      return;
    }

    case "due": {
      const dueAt = optional(form, "dueAt");
      await setDueDate(id, dueAt === null ? null : parseDueDate(dueAt), OWNER);
      return;
    }

    case "comment":
      await addComment(id, text(form, "body"), OWNER);
      return;

    case "delete": {
      await deleteTask(id);
      return text(form, "after") || undefined;
    }
  }
});
