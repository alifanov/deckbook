import { endSession, startSession, verifyPassword } from "../../../auth";
import { redirect } from "../../../http";
import { clientKey, isLocked, recordFailure, resetAttempts } from "../../../login-limit";

const fail = (message: string) => redirect(`/login?error=${encodeURIComponent(message)}`);

export async function POST(request: Request) {
  const form = await request.formData();

  if (String(form.get("intent")) === "logout") {
    await endSession();
    return redirect("/login");
  }

  // маршрут не закрыт сессией, так что перебор ограничиваем здесь
  const key = clientKey(request);
  if (isLocked(key)) {
    return fail("Слишком много неудачных попыток. Попробуйте позже");
  }

  if (!(await verifyPassword(String(form.get("password") ?? "")))) {
    recordFailure(key);
    return fail("Пароль не подошёл");
  }

  resetAttempts(key);
  await startSession();
  return redirect("/");
}
