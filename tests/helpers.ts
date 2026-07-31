import { createProject } from "../src/domain/projects";
import { issueToken } from "../src/domain/tokens";

export async function makeProject(name = "Проект") {
  return createProject(name);
}

export async function makeToken(projectId: string, name = "Агент") {
  return issueToken(projectId, name);
}
