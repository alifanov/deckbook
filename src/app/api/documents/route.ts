import { OWNER } from "../../../domain/actor";
import {
  createDocument,
  createFolder,
  deleteNode,
  importTextFile,
  moveNode,
  renameNode,
  writeDocument,
} from "../../../domain/documents";
import { formHandler, optional, text } from "../../../http";

export const POST = formHandler(async (form) => {
  const id = text(form, "id");
  const projectId = text(form, "projectId");

  switch (text(form, "intent")) {
    case "create-folder":
      await createFolder(
        { projectId, parentId: optional(form, "parentId"), name: text(form, "name") },
        OWNER,
      );
      return;

    case "create-document":
      await createDocument(
        { projectId, parentId: optional(form, "parentId"), name: text(form, "name") },
        OWNER,
      );
      return;

    case "write":
      await writeDocument(id, text(form, "content"), OWNER);
      return;

    case "rename":
      await renameNode(id, text(form, "name"), OWNER);
      return;

    case "move":
      await moveNode(id, optional(form, "parentId"), OWNER);
      return;

    case "delete":
      await deleteNode(id);
      return text(form, "after") || undefined;

    case "import": {
      // файл читается и выбрасывается: файлового хранилища в системе нет
      const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length === 0) return;
      for (const file of files) {
        await importTextFile(
          {
            projectId,
            parentId: optional(form, "parentId"),
            filename: file.name,
            content: await file.text(),
          },
          OWNER,
        );
      }
      return;
    }
  }
});
