import { prisma } from "../db";
import type { Author } from "./author";
import { fail } from "./errors";

/** Лента задачи: и комментарии, и системные записи (ADR-0002). */
export async function addComment(taskId: string, body: string, author: Author) {
  const text = body.trim();
  if (!text) fail("Пустой комментарий");
  return prisma.comment.create({
    data: { taskId, body: text, kind: "human", authorTokenId: author.tokenId },
  });
}

/** Системная запись — готовый текст, структуры изменения не хранится. */
export function recordSystem(taskId: string, body: string, author: Author) {
  return prisma.comment.create({
    data: { taskId, body, kind: "system", authorTokenId: author.tokenId },
  });
}

export function listComments(taskId: string) {
  return prisma.comment.findMany({
    where: { taskId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });
}
