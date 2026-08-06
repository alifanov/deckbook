import { requestSignedIn } from "./auth";
import { DomainError } from "./domain/errors";
import { logError } from "./log";

/** ponytail: относительный Location — за проксей и с проброшенным портом
 * абсолютный адрес указал бы на внутренний порт контейнера. */
export const redirect = (to: string) =>
  new Response(null, { status: 303, headers: { location: to } });

/** Поле `back` приходит из формы, а уезжает в `Location`: `//evil.example`
 * увёл бы с доверенного домена на чужой. Внутренний путь — ровно один `/`
 * в начале (обратный слэш браузеры трактуют как второй слэш). */
const internalPath = (back: string) => (/^\/($|[^/\\])/.test(back) ? back : "/");

/**
 * Route handlers UI собственной логики не несут: разобрать форму, позвать
 * домен, вернуться назад. Отказ домена приезжает обратно текстом в адресе.
 *
 * Сессию проверяем здесь же, до разбора формы: middleware — первый рубеж,
 * но мутации не должны держаться на нём одном.
 */
export function formHandler(
  action: (form: FormData) => Promise<string | void>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    if (!(await requestSignedIn(request))) return new Response("Требуется вход", { status: 403 });

    const form = await request.formData();
    const back = internalPath(String(form.get("back") ?? "/"));

    try {
      return redirect((await action(form)) || back);
    } catch (error) {
      if (!(error instanceof DomainError)) {
        // отказ домена — часть сценария, а поломка route handler'а видна
        // только здесь: дальше Next вернёт 500 и ошибка потеряется
        logError(error, { "http.route": new URL(request.url).pathname });
        throw error;
      }
      const separator = back.includes("?") ? "&" : "?";
      return redirect(`${back}${separator}error=${encodeURIComponent(error.message)}`);
    }
  };
}

export const text = (form: FormData, field: string): string => String(form.get(field) ?? "");

export const optional = (form: FormData, field: string): string | null => {
  const value = String(form.get(field) ?? "").trim();
  return value === "" ? null : value;
};
