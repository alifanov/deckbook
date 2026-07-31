import { describe, expect, it } from "vitest";
import { OWNER, agent } from "../src/domain/actor";
import { prisma } from "../src/db";
import {
  createDocument,
  createFolder,
  deleteNode,
  getDocument,
  importTextFile,
  listDocumentTree,
  moveNode,
  renameNode,
  writeDocument,
} from "../src/domain/documents";
import { makeProject, makeToken } from "./helpers";

describe("дерево документов", () => {
  it("создаёт папки любой вложенности и документы внутри них", async () => {
    const project = await makeProject();
    const outer = await createFolder({ projectId: project.id, name: "Спеки" }, OWNER);
    const inner = await createFolder(
      { projectId: project.id, parentId: outer.id, name: "MVP" },
      OWNER,
    );
    await createDocument(
      { projectId: project.id, parentId: inner.id, name: "Задачи", content: "# Заголовок" },
      OWNER,
    );

    const [root] = await listDocumentTree(project.id);
    expect(root.name).toBe("Спеки");
    expect(root.children[0].children[0].name).toBe("Задачи");
  });

  it("не даёт вложить что-либо внутрь документа", async () => {
    const project = await makeProject();
    const doc = await createDocument({ projectId: project.id, name: "Заметка" }, OWNER);

    await expect(
      createDocument({ projectId: project.id, parentId: doc.id, name: "Внутри" }, OWNER),
    ).rejects.toThrow(/только внутрь папки/);
  });

  it("не связывает узлы разных проектов", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const folder = await createFolder({ projectId: a.id, name: "Чужая" }, OWNER);

    await expect(
      createDocument({ projectId: b.id, parentId: folder.id, name: "Своя" }, OWNER),
    ).rejects.toThrow(/другому проекту/);
  });

  it("запись затирает предыдущее содержимое и помнит автора", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const doc = await createDocument(
      { projectId: project.id, name: "Спека", content: "старое" },
      OWNER,
    );

    await writeDocument(doc.id, "новое", agent(token.id));

    const after = await getDocument(doc.id);
    expect(after?.content).toBe("новое");
    expect(after?.updatedByTokenId).toBe(token.id);
    expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(after!.createdAt.getTime());
  });

  it("у папки нет содержимого", async () => {
    const project = await makeProject();
    const folder = await createFolder({ projectId: project.id, name: "Папка" }, OWNER);

    await expect(writeDocument(folder.id, "текст", OWNER)).rejects.toThrow(/нет содержимого/);
  });
});

describe("порядок в дереве документов", () => {
  it("переносит документ в другую папку", async () => {
    const project = await makeProject();
    const from = await createFolder({ projectId: project.id, name: "Из" }, OWNER);
    const to = await createFolder({ projectId: project.id, name: "В" }, OWNER);
    const doc = await createDocument(
      { projectId: project.id, parentId: from.id, name: "Заметка" },
      OWNER,
    );

    expect((await moveNode(doc.id, to.id, OWNER)).parentId).toBe(to.id);
    expect((await moveNode(doc.id, null, OWNER)).parentId).toBeNull();
  });

  it("переносит папку вместе с содержимым", async () => {
    const project = await makeProject();
    const target = await createFolder({ projectId: project.id, name: "Цель" }, OWNER);
    const folder = await createFolder({ projectId: project.id, name: "Папка" }, OWNER);
    const doc = await createDocument(
      { projectId: project.id, parentId: folder.id, name: "Внутри" },
      OWNER,
    );

    await moveNode(folder.id, target.id, OWNER);

    const [root] = await listDocumentTree(project.id);
    expect(root.name).toBe("Цель");
    expect(root.children[0].children[0].id).toBe(doc.id);
  });

  it("отказывает переносу папки внутрь самой себя", async () => {
    const project = await makeProject();
    const outer = await createFolder({ projectId: project.id, name: "Внешняя" }, OWNER);
    const inner = await createFolder(
      { projectId: project.id, parentId: outer.id, name: "Внутренняя" },
      OWNER,
    );

    await expect(moveNode(outer.id, inner.id, OWNER)).rejects.toThrow(/внутрь самой себя/);
    await expect(moveNode(outer.id, outer.id, OWNER)).rejects.toThrow(/сам в себя/);
  });

  it("отказывает переносу в другой проект", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const doc = await createDocument({ projectId: a.id, name: "Заметка" }, OWNER);
    const foreign = await createFolder({ projectId: b.id, name: "Чужая" }, OWNER);

    await expect(moveNode(doc.id, foreign.id, OWNER)).rejects.toThrow(/другому проекту/);
  });

  it("переименовывает документ и папку", async () => {
    const project = await makeProject();
    const folder = await createFolder({ projectId: project.id, name: "Было" }, OWNER);

    expect((await renameNode(folder.id, "Стало", OWNER)).name).toBe("Стало");
  });

  it("удаляет папку вместе с содержимым", async () => {
    const project = await makeProject();
    const folder = await createFolder({ projectId: project.id, name: "Папка" }, OWNER);
    await createDocument({ projectId: project.id, parentId: folder.id, name: "Внутри" }, OWNER);

    await deleteNode(folder.id);
    expect(await prisma.document.count()).toBe(0);
  });
});

describe("импорт текстовых файлов", () => {
  it("делает документ из файла: имя без расширения, содержимое как текст", async () => {
    const project = await makeProject();
    const folder = await createFolder({ projectId: project.id, name: "Заметки" }, OWNER);

    const doc = await importTextFile(
      {
        projectId: project.id,
        parentId: folder.id,
        filename: "release-notes.md",
        content: "# Релиз",
      },
      OWNER,
    );

    expect(doc.name).toBe("release-notes");
    expect(doc.content).toBe("# Релиз");
    expect(doc.parentId).toBe(folder.id);
  });

  it("отвергает нетекстовый файл", async () => {
    const project = await makeProject();

    await expect(
      importTextFile({ projectId: project.id, filename: "logo.png", content: "..." }, OWNER),
    ).rejects.toThrow(/только текстовые файлы/);
    await expect(
      importTextFile(
        { projectId: project.id, filename: "binary.txt", content: "a\u0000b" },
        OWNER,
      ),
    ).rejects.toThrow(/не текстовый файл/);
  });

  it("отвергает файл сверх предела размера", async () => {
    const project = await makeProject();

    await expect(
      importTextFile(
        { projectId: project.id, filename: "huge.txt", content: "x".repeat(1_000_001) },
        OWNER,
      ),
    ).rejects.toThrow(/больше/);
  });

  it("не пускает импорт в папку другого проекта", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const foreign = await createFolder({ projectId: b.id, name: "Чужая" }, OWNER);

    await expect(
      importTextFile(
        { projectId: a.id, parentId: foreign.id, filename: "note.txt", content: "текст" },
        OWNER,
      ),
    ).rejects.toThrow(/другому проекту/);
  });
});
