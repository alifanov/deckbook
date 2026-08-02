import { Banner, Icon, Logo } from "../../ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ padding: "110px 0 130px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 360 }}>
        <div
          style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24 }}
        >
          <Logo size={22} />
          <h1 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.015em" }}>Deckbook</h1>
        </div>

        <div className="card" style={{ padding: "22px 24px" }}>
          <Banner error={error} />
          <form className="row" method="post" action="/api/session">
            <input type="hidden" name="intent" value="login" />
            <input
              type="password"
              name="password"
              placeholder="Пароль владельца"
              autoFocus
              required
            />
            <button type="submit">
              <Icon name="login" />
              Войти
            </button>
          </form>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>
            Вход только для владельца. Агенты подключаются по токену.
          </p>
        </div>
      </div>
    </main>
  );
}
