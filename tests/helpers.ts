import { prisma } from "../src/db";
import { createProject } from "../src/domain/projects";
import { issueToken } from "../src/domain/tokens";
import { SESSION_COOKIE, signSession } from "../src/session";

export async function makeProject(name = "Проект") {
  return createProject(name);
}

export async function makeToken(projectId: string, name = "Агент") {
  return issueToken(projectId, name);
}

/** Заголовок Cookie с действующей сессией владельца — как у вошедшего браузера. */
export async function sessionHeader(): Promise<Record<string, string>> {
  const owner = await prisma.owner.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, passwordHash: "test" },
  });
  return { cookie: `${SESSION_COOKIE}=${signSession(Date.now() + 60_000, owner.sessionEpoch)}` };
}
