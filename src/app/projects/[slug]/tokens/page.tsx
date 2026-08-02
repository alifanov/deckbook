import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopyField, CopySnippet } from "../../../../copy";
import { getProjectBySlug } from "../../../../domain/projects";
import { ISSUED_HEADER, listTokens } from "../../../../domain/tokens";
import { Header } from "../../../../header";
import {
  Back,
  Banner,
  Head,
  Icon,
  moment,
  ProjectNav,
  Reveal,
} from "../../../../ui";

export const dynamic = "force-dynamic";

export default async function TokensPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  // значение приходит заголовком от middleware, которая гасит куку на этом же
  // ответе; в адресе токена нет — он оседал бы в истории и в логах прокси
  const issued = (await headers()).get(ISSUED_HEADER);
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const tokens = await listTokens(project.id);
  const host = (await headers()).get("host") ?? "localhost:3000";
  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  const mcpUrl = `${scheme}://${host}/mcp/${project.slug}`;
  const path = `/projects/${slug}/tokens`;

  // команды показываются только вместе со свежим токеном: второй раз его
  // значение взять неоткуда, а команда с заглушкой вместо токена бесполезна
  const server = `deckbook-${project.slug}`;
  const others = !issued
    ? []
    : [
        {
          title: "Codex",
          snippet: `export DECKBOOK_TOKEN=${issued} && codex mcp add ${server} --url ${mcpUrl} --bearer-token-env-var DECKBOOK_TOKEN`,
          note: "Codex хранит имя переменной, а не значение — DECKBOOK_TOKEN нужно прописать в профиль оболочки, иначе после перезапуска терминала подключение отвалится.",
        },
        {
          title: "OpenCode",
          snippet: JSON.stringify(
            {
              mcp: {
                [server]: {
                  type: "remote",
                  url: mcpUrl,
                  headers: { Authorization: `Bearer ${issued}` },
                  enabled: true,
                },
              },
            },
            null,
            2,
          ),
          note: "У opencode нет флагов для неинтерактивного добавления — блок кладётся в ~/.config/opencode/opencode.json.",
        },
      ];

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="tokens" />
      </Header>
      <main>
        <h1 style={{ marginBottom: 26 }}>Токены</h1>
        <Banner error={error} />

        {issued && (
          <div className="notice">
            <div className="bar" style={{ alignItems: "baseline", marginBottom: 14 }}>
              <strong className="lead">Токен выпущен</strong>
              <span className="muted">значение показывается один раз</span>
            </div>
            <CopyField value={issued} />

            <div
              style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div className="muted">Команда для Claude Code — токен уже подставлен:</div>
              <CopySnippet
                value={`claude mcp add --transport http ${server} ${mcpUrl} --header "Authorization: Bearer ${issued}"`}
              />
              <Reveal label="Команды для Codex и OpenCode" icon="right">
                {others.map((client) => (
                  <div key={client.title}>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      {client.title}
                    </div>
                    <CopySnippet value={client.snippet} />
                    <p className="muted" style={{ margin: "8px 0 0" }}>
                      {client.note}
                    </p>
                  </div>
                ))}
              </Reveal>
            </div>
          </div>
        )}

        <Head title="Адрес MCP-сервера" />
        <div className="card" style={{ padding: "18px 24px" }}>
          <CopyField value={mcpUrl} />
          <p className="muted" style={{ margin: "12px 0 0" }}>
            Агент подключается по этому адресу с заголовком{" "}
            <code>Authorization: Bearer …</code>
          </p>
        </div>

        <Head title="Выпущенные" count={tokens.length}>
          <Reveal label="выпустить токен" icon="plus" drop>
            <form className="row" method="post" action="/api/tokens">
              <Back path={path} />
              <input type="hidden" name="intent" value="issue" />
              <input type="hidden" name="projectId" value={project.id} />
              <input type="text" name="name" placeholder="Имя агента" required />
              <button type="submit">
                <Icon name="plus" />
                Выпустить
              </button>
            </form>
          </Reveal>
        </Head>

        {tokens.length === 0 ? (
          <p className="muted">Токенов пока нет.</p>
        ) : (
          <div className="card tight list">
            {tokens.map((token) => (
              <div className="item" key={token.id}>
                <span className={token.revokedAt ? "dot" : "dot live"} />
                <span
                  className={token.revokedAt ? "grow off" : "grow"}
                  style={{ fontSize: 16 }}
                >
                  {token.name}
                </span>
                <span className="muted">
                  {token.revokedAt
                    ? `отозван ${moment(token.revokedAt)}`
                    : token.lastUsedAt
                      ? `использован ${moment(token.lastUsedAt)}`
                      : "ещё не использован"}
                </span>
                {!token.revokedAt && (
                  <form method="post" action="/api/tokens">
                    <Back path={path} />
                    <input type="hidden" name="intent" value="revoke" />
                    <input type="hidden" name="id" value={token.id} />
                    <button className="plain bad" type="submit">
                      <Icon name="ban" />
                      Отозвать
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
