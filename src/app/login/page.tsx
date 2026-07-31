export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 360, paddingTop: 100 }}>
      <h1>Deckbook</h1>
      {error && <p className="error">{error}</p>}
      <form className="row" method="post" action="/api/session">
        <input type="hidden" name="intent" value="login" />
        <input
          type="password"
          name="password"
          placeholder="Пароль владельца"
          autoFocus
          required
          style={{ flex: 1 }}
        />
        <button type="submit">Войти</button>
      </form>
    </main>
  );
}
