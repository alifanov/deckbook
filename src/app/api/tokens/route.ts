import { cookies } from "next/headers";
import { ISSUED_COOKIE, issueToken, revokeToken } from "../../../domain/tokens";
import { formHandler, text } from "../../../http";

export const POST = formHandler(async (form) => {
  switch (text(form, "intent")) {
    case "issue": {
      const { value } = await issueToken(text(form, "projectId"), text(form, "name"));
      // значение видно ровно один раз; в адресе его нести нельзя — он оседает
      // в истории браузера, в Referer и в логах прокси
      (await cookies()).set(ISSUED_COOKIE, value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60,
      });
      return;
    }
    case "revoke":
      await revokeToken(text(form, "id"));
      return;
  }
});
