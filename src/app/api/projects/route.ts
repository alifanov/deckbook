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
    // цель и папка правятся одной формой — и сохраняются одной кнопкой
    case "meta": {
      const id = text(form, "id");
      await setProjectGoal(id, text(form, "goal"));
      await setProjectLocalPath(id, text(form, "localPath"));
      return;
    }
    case "delete":
      await deleteProject(text(form, "id"));
      return "/";
  }
});
