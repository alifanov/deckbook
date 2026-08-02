import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import {
  asDay,
  createTask,
  isOverdue,
  listTasks,
  parseDueDate,
  setDueDate,
  setRecurrence,
  setStatus,
  today,
} from "../src/domain/tasks";
import { makeProject } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const shifted = (days: number) => new Date(today().getTime() + days * DAY);
const titles = (tasks: { title: string }[]) => tasks.map((t) => t.title);

describe("срок задачи", () => {
  it("прячет из списка задачу, чей срок ещё не наступил", async () => {
    const project = await makeProject();
    const future = await createTask(
      { projectId: project.id, title: "Ревью РК", dueAt: shifted(30) },
      OWNER,
    );
    await createTask({ projectId: project.id, title: "Без срока" }, OWNER);

    expect(titles(await listTasks(project.id))).toEqual(["Без срока"]);
    expect(titles(await listTasks(project.id, { includeFuture: true }))).toContain("Ревью РК");
    // задача существует и достаётся напрямую — спрятан только список
    expect(future.dueAt).not.toBeNull();
  });

  it("показывает задачу в день срока и после него", async () => {
    const project = await makeProject();
    await createTask({ projectId: project.id, title: "Сегодня", dueAt: today() }, OWNER);
    await createTask({ projectId: project.id, title: "Вчера", dueAt: shifted(-1) }, OWNER);
    await createTask({ projectId: project.id, title: "Завтра", dueAt: shifted(1) }, OWNER);

    expect(titles(await listTasks(project.id))).toEqual(["Вчера", "Сегодня"]);
  });

  it("ставит просроченное первым, бессрочное последним", async () => {
    const project = await makeProject();
    await createTask({ projectId: project.id, title: "Без срока" }, OWNER);
    await createTask({ projectId: project.id, title: "Сегодня", dueAt: today() }, OWNER);
    await createTask({ projectId: project.id, title: "Давно", dueAt: shifted(-9) }, OWNER);

    expect(titles(await listTasks(project.id))).toEqual(["Давно", "Сегодня", "Без срока"]);
  });

  it("считает просроченным только прошедший срок", async () => {
    expect(isOverdue({ dueAt: shifted(-1) })).toBe(true);
    expect(isOverdue({ dueAt: today() })).toBe(false);
    expect(isOverdue({ dueAt: shifted(1) })).toBe(false);
    expect(isOverdue({ dueAt: null })).toBe(false);
  });

  it("хранит срок днём, а не моментом", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Срочная" }, OWNER);

    const dated = await setDueDate(task.id, parseDueDate("2030-03-07"), OWNER);

    expect(asDay(dated.dueAt!)).toBe("2030-03-07");
    expect(dated.dueAt!.getTime() % DAY).toBe(0);
  });

  it("снимает срок и возвращает задачу в список", async () => {
    const project = await makeProject();
    const task = await createTask(
      { projectId: project.id, title: "Отложенная", dueAt: shifted(5) },
      OWNER,
    );
    expect(titles(await listTasks(project.id))).toEqual([]);

    await setDueDate(task.id, null, OWNER);

    expect(titles(await listTasks(project.id))).toEqual(["Отложенная"]);
  });

  it("отвергает дату без дня и несуществующую дату", async () => {
    const project = await makeProject();
    await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    expect(() => parseDueDate("2030-03-07T14:37:00Z")).toThrow(/ГГГГ-ММ-ДД/);
    expect(() => parseDueDate("завтра")).toThrow(/ГГГГ-ММ-ДД/);
    expect(() => parseDueDate("2030-02-31")).toThrow(/не существует/);
  });

  it("повтор не затирает уже поставленный срок", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Ревью" }, OWNER);
    await setDueDate(task.id, parseDueDate("2030-05-01"), OWNER);

    const repeating = await setRecurrence(task.id, 7, OWNER);

    expect(asDay(repeating.dueAt!)).toBe("2030-05-01");
  });

  it("повтор без срока встаёт на сегодня, а снятие повтора срок не уносит", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Регулярная" }, OWNER);

    const repeating = await setRecurrence(task.id, 3, OWNER);
    expect(asDay(repeating.dueAt!)).toBe(asDay(today()));

    const plain = await setRecurrence(task.id, null, OWNER);
    expect(asDay(plain.dueAt!)).toBe(asDay(today()));
  });

  it("закрытие повторяющейся задачи уводит её из списка до нового срока", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Обновить зависимости" }, OWNER);
    await setRecurrence(task.id, 7, OWNER);
    expect(titles(await listTasks(project.id))).toEqual(["Обновить зависимости"]);

    const closed = await setStatus(task.id, "done", OWNER);

    expect(closed.status).toBe("todo");
    expect(asDay(closed.dueAt!)).toBe(asDay(shifted(7)));
    expect(titles(await listTasks(project.id))).toEqual([]);
  });

});
