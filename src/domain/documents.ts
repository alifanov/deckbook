import { prisma } from "../db";
import type { Author } from "./author";
import { fail } from "./errors";
import { buildTree, type Node } from "./tree";
import type { Document } from "../generated/prisma/client";

export type DocumentNode = Node<Document>;

async function requireNode(id: string) {
  const node = await prisma.document.findUnique({ where: { id } });
  if (!node) fail("Документа или папки не существует");
  return node;
}

/** Документ или папка существует и лежит в этом проекте — граница агента (ADR-0003). */
export async function requireDocumentInProject(id: string, projectId: string) {
  const node = await prisma.document.findUnique({ where: { id } });
  if (!node || node.projectId !== projectId) {
    fail(`Документа ${id} нет в этом проекте — доступен только текущий проект`);
  }
  return node;
}

/** Вложить что-либо можно только в папку, и только внутри своего проекта. */
async function requireFolderInProject(parentId: string, projectId: string) {
  const parent = await requireNode(parentId);
  if (!parent.isFolder) fail("Вложить что-либо внутрь документа нельзя — только внутрь папки");
  if (parent.projectId !== projectId) fail("Папка принадлежит другому проекту");
  return parent;
}

async function create(
  input: {
    projectId: string;
    parentId?: string | null;
    name: string;
    isFolder: boolean;
    content?: string;
  },
  author: Author,
) {
  const name = input.name.trim();
  if (!name) fail("Название не может быть пустым");
  if (input.parentId) await requireFolderInProject(input.parentId, input.projectId);

  return prisma.document.create({
    data: {
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      name,
      isFolder: input.isFolder,
      content: input.isFolder ? "" : (input.content ?? ""),
      updatedByTokenId: author.tokenId,
    },
  });
}

export const createFolder = (
  input: { projectId: string; parentId?: string | null; name: string },
  author: Author,
) => create({ ...input, isFolder: true }, author);

export const createDocument = (
  input: { projectId: string; parentId?: string | null; name: string; content?: string },
  author: Author,
) => create({ ...input, isFolder: false }, author);

/** Запись затирает предыдущее содержимое безвозвратно (ADR-0002). */
export async function writeDocument(id: string, content: string, author: Author) {
  const node = await requireNode(id);
  if (node.isFolder) fail("У папки нет содержимого");
  return prisma.document.update({
    where: { id },
    data: { content, updatedByTokenId: author.tokenId },
  });
}

export async function renameNode(id: string, name: string, author: Author) {
  const title = name.trim();
  if (!title) fail("Название не может быть пустым");
  await requireNode(id);
  return prisma.document.update({
    where: { id },
    data: { name: title, updatedByTokenId: author.tokenId },
  });
}

export async function moveNode(id: string, newParentId: string | null, author: Author) {
  const node = await requireNode(id);
  if (newParentId === id) fail("Узел не может быть вложен сам в себя");

  if (newParentId) {
    const parent = await requireFolderInProject(newParentId, node.projectId);
    for (let cursor: Document | null = parent; cursor?.parentId; ) {
      if (cursor.parentId === id) fail("Папку нельзя перенести внутрь самой себя");
      cursor = await prisma.document.findUnique({ where: { id: cursor.parentId } });
    }
  }

  return prisma.document.update({
    where: { id },
    data: { parentId: newParentId, updatedByTokenId: author.tokenId },
  });
}

/** Удаление папки уносит содержимое — каскадом на уровне базы. */
export async function deleteNode(id: string) {
  await prisma.document.delete({ where: { id } });
}

export function getDocument(id: string) {
  return prisma.document.findUnique({ where: { id }, include: { updatedBy: true } });
}

export async function listDocumentTree(projectId: string): Promise<DocumentNode[]> {
  const nodes = await prisma.document.findMany({
    where: { projectId },
    orderBy: [{ isFolder: "desc" }, { name: "asc" }],
  });
  return buildTree(nodes, null);
}

export const MAX_IMPORT_BYTES = 1_000_000;
const TEXT_EXTENSIONS = [".md", ".txt"];

/**
 * Импорт текстового файла: содержимое становится документом, сам файл
 * никуда не сохраняется — файлового хранилища в системе нет.
 */
export async function importTextFile(
  input: { projectId: string; parentId?: string | null; filename: string; content: string },
  author: Author,
) {
  const filename = input.filename.trim();
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (!TEXT_EXTENSIONS.includes(extension)) {
    fail(`«${filename}»: принимаются только текстовые файлы ${TEXT_EXTENSIONS.join(" и ")}`);
  }
  if (Buffer.byteLength(input.content, "utf8") > MAX_IMPORT_BYTES) {
    fail(`«${filename}»: файл больше ${MAX_IMPORT_BYTES / 1000} КБ`);
  }
  if (input.content.includes("\u0000")) {
    fail(`«${filename}»: это не текстовый файл`);
  }

  return createDocument(
    {
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      name: filename.slice(0, filename.lastIndexOf(".")),
      content: input.content,
    },
    author,
  );
}
