import { prisma } from "../db";
import { fail } from "./errors";

/** Человекочитаемый идентификатор проекта для адреса MCP-сервера. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

export async function createProject(name: string) {
  const title = name.trim();
  if (!title) fail("Название проекта не может быть пустым");

  const base = slugify(title);
  // ponytail: занятый slug решается суффиксом-счётчиком, проектов десятки
  for (let n = 0; ; n++) {
    const slug = n === 0 ? base : `${base}-${n}`;
    if (!(await prisma.project.findUnique({ where: { slug } }))) {
      return prisma.project.create({ data: { name: title, slug } });
    }
  }
}

export function listProjects() {
  return prisma.project.findMany({ orderBy: { createdAt: "asc" } });
}

export function getProjectBySlug(slug: string) {
  return prisma.project.findUnique({ where: { slug } });
}

export async function requireProjectBySlug(slug: string) {
  const project = await getProjectBySlug(slug);
  if (!project) fail(`Проекта «${slug}» не существует`);
  return project;
}

export async function renameProject(id: string, name: string) {
  const title = name.trim();
  if (!title) fail("Название проекта не может быть пустым");
  // slug не меняется: он уже роздан агентам в адресе MCP-сервера
  return prisma.project.update({ where: { id }, data: { name: title } });
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
}
