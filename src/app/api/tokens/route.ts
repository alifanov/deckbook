import { issueToken, revokeToken } from "../../../domain/tokens";
import { formHandler, text } from "../../../http";

export const POST = formHandler(async (form) => {
  const back = text(form, "back");

  switch (text(form, "intent")) {
    case "issue": {
      const { value } = await issueToken(text(form, "projectId"), text(form, "name"));
      // значение видно ровно один раз — дальше в базе только хеш
      return `${back}?issued=${encodeURIComponent(value)}`;
    }
    case "revoke":
      await revokeToken(text(form, "id"));
      return;
  }
});
