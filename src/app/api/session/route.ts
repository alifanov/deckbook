import { endSession, startSession, verifyPassword } from "../../../auth";
import { redirect } from "../../../http";

export async function POST(request: Request) {
  const form = await request.formData();

  if (String(form.get("intent")) === "logout") {
    await endSession();
    return redirect("/login");
  }

  if (!(await verifyPassword(String(form.get("password") ?? "")))) {
    return redirect(`/login?error=${encodeURIComponent("Пароль не подошёл")}`);
  }

  await startSession();
  return redirect("/");
}
