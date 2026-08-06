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
  requireTask,
  setDueDate,
  setPriority,
  setRecurrence,
  setStatus,
  updateTask,
} from "../../../domain/tasks";
import { listAgents } from "../../../domain/tokens";
import { formHandler, optional, text } from "../../../http";

export const POST = formHandler(async (form) => {
  const id = text(form, "id");

  switch (text(form, "intent")) {
    case "create": {
      const projectId = text(form, "projectId");
      // ничья задача не попадёт ни в один my_tasks — по умолчанию вешаем её
      // на первого агента проекта, переназначить можно на карточке
      const [agent] = await listAgents(projectId);
      await createTask(
        {
          projectId,
          parentId: optional(form, "parentId"),
          title: text(form, "title"),
          description: text(form, "description"),
          assigneeTokenId: agent?.id ?? null,
        },
        OWNER,
      );
      return;
    }

    case "update":
      await updateTask(
        id,
        { title: text(form, "title"), description: text(form, "description") },
        OWNER,
      );
      return;

    /**
     * Правка задачи целиком: экран «Изменить» сохраняет все поля разом.
     * Сеттеры сами молчат, когда значение не изменилось, — кроме назначения
     * и переноса: их сравниваем здесь, иначе каждое сохранение засоряло бы
     * ленту записями «задача перенесена» без единого изменения.
     */
    case "edit": {
      const before = await requireTask(id);

      await updateTask(
        id,
        { title: text(form, "title"), description: text(form, "description") },
        OWNER,
      );

      const assignee = optional(form, "tokenId");
      const assigned = before.assignedToOwner ? OWNER_ASSIGNEE : before.assigneeTokenId;
      if (assignee !== assigned) {
        if (assignee === OWNER_ASSIGNEE) await assignTaskToOwner(id, OWNER);
        else await assignTask(id, assignee, OWNER);
      }

      const parentId = optional(form, "parentId");
      if (parentId !== before.parentId) await moveTask(id, parentId, OWNER);

      await setPriority(id, parsePriority(text(form, "priority")), OWNER);

      const dueAt = optional(form, "dueAt");
      await setDueDate(id, dueAt === null ? null : parseDueDate(dueAt), OWNER);

      const days = optional(form, "days");
      await setRecurrence(id, days === null ? null : Number(days), OWNER);

      // статус — последним: у повторяющейся задачи закрытие переставляет срок,
      // и переставить его должно уже по новому интервалу
      await setStatus(id, parseStatus(text(form, "status")), OWNER);
      return;
    }

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
