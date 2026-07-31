import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";
import { fail } from "./errors";

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

/** Одноразовая кука, в которой выпущенный токен доезжает до страницы показа. */
export const ISSUED_COOKIE = "deckbook_issued_token";

/**
 * Заголовок, которым middleware передаёт значение странице. Нужен потому,
 * что серверный компонент куки читать умеет, а гасить — нет: без этого
 * значение переживало бы перезагрузку страницы всю минуту жизни куки.
 */
export const ISSUED_HEADER = "x-deckbook-issued-token";

/**
 * Выпускает токен на проект. Значение возвращается один раз —
 * в базе остаётся только хеш.
 */
export async function issueToken(projectId: string, name: string) {
  const title = name.trim();
  if (!title) fail("У токена должно быть имя");

  const value = `dbk_${randomBytes(24).toString("hex")}`;
  const token = await prisma.token.create({
    data: { name: title, projectId, hash: hashToken(value) },
  });
  return { token, value };
}

export function listTokens(projectId: string) {
  return prisma.token.findMany({
    where: { projectId },
    include: { project: true },
    orderBy: { createdAt: "asc" },
  });
}

export function revokeToken(id: string) {
  return prisma.token.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Проверяет токен против проекта из адреса. Расхождение — отказ,
 * а не выбор одного из двух (ADR-0003).
 */
export async function authenticateToken(projectSlug: string, value: string | null) {
  if (!value) return { error: "Токен не передан" as const };

  const token = await prisma.token.findUnique({
    where: { hash: hashToken(value) },
    include: { project: true },
  });
  if (!token) return { error: "Токен неизвестен" as const };
  if (token.revokedAt) return { error: "Токен отозван" as const };
  if (token.project.slug !== projectSlug) {
    return { error: "Токен выдан на другой проект" as const };
  }

  await prisma.token.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });
  return { token, project: token.project };
}
