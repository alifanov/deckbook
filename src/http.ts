import { DomainError } from "./domain/errors";

/** ponytail: относительный Location — за проксей и с проброшенным портом
 * абсолютный адрес указал бы на внутренний порт контейнера. */
export const redirect = (to: string) =>
  new Response(null, { status: 303, headers: { location: to } });

/**
 * Route handlers UI собственной логики не несут: разобрать форму, позвать
 * домен, вернуться назад. Отказ домена приезжает обратно текстом в адресе.
 */
export function formHandler(
  action: (form: FormData) => Promise<string | void>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const form = await request.formData();
    const back = String(form.get("back") ?? "/");

    try {
      return redirect((await action(form)) || back);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
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
