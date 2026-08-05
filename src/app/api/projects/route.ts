import {
  createProject,
  deleteProject,
  renameProject,
  setProjectGoal,
  setProjectLocalPath,
} from "../../../domain/projects";
import { formHandler, text } from "../../../http";

export const POST = formHandler(async (form) => {
  switch (text(form, "intent")) {
    case "create": {
      const project = await createProject(text(form, "name"));
      return `/projects/${project.slug}`;
    }
    case "rename":
      await renameProject(text(form, "id"), text(form, "name"));
      return;
    case "goal":
      await setProjectGoal(text(form, "id"), text(form, "goal"));
      return;
    case "local-path":
      await setProjectLocalPath(text(form, "id"), text(form, "localPath"));
      return;
    case "delete":
      await deleteProject(text(form, "id"));
      return "/";
  }
});
