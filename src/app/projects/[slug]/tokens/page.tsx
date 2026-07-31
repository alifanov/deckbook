import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopyField, CopySnippet } from "../../../../copy";
import { getProjectBySlug } from "../../../../domain/projects";
import { ISSUED_COOKIE, listTokens } from "../../../../domain/tokens";
import { Back, Banner, Header, ProjectNav, when } from "../../../../ui";

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
  // кука живёт минуту и сама протухает: значение видно один раз, но в адресе
  // и в логах прокси его нет (страница менять куки не может — только читать)
  const issued = (await cookies()).get(ISSUED_COOKIE)?.value;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const tokens = await listTokens(project.id);
  const host = (await headers()).get("host") ?? "localhost:3000";
  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  const mcpUrl = `${scheme}://${host}/mcp/${project.slug}`;
  const path = `/projects/${slug}/tokens`;

  // команды показываются только вместе со свежим токеном: второй раз его
  // значение взять неоткуда, а команда с заглушкой вместо токена бесполезна
  const token = issued;
  const server = `deckbook-${project.slug}`;
  const clients = !token ? [] : [
    {
      title: "Claude Code",
      snippet: `claude mcp add --transport http ${server} ${mcpUrl} --header "Authorization: Bearer ${token}"`,
    },
    {
      title: "Codex",
      snippet: `export DECKBOOK_TOKEN=${token} && codex mcp add ${server} --url ${mcpUrl} --bearer-token-env-var DECKBOOK_TOKEN`,
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
              headers: { Authorization: `Bearer ${token}` },
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
        <ProjectNav slug={slug} />
      </Header>
      <main>
        <h1>Токены проекта «{project.name}»</h1>
        <Banner error={error} />

        {issued && (
          <div className="notice">
            <strong>Токен выпущен — значение показывается один раз:</strong>
            <CopyField value={issued} />

            <h2>Подключить агента</h2>
            <p className="muted">
              В командах уже подставлен этот токен — их можно вставить в терминал как есть.
            </p>
            {clients.map((client) => (
              <div key={client.title}>
                <h3>{client.title}</h3>
                <CopySnippet value={client.snippet} />
                {client.note && <p className="muted">{client.note}</p>}
              </div>
            ))}
          </div>
        )}

        <h2>Адрес MCP-сервера</h2>
        <CopyField value={mcpUrl} />
        <p className="muted">
          Агент подключается по этому адресу с заголовком <code>Authorization: Bearer …</code>.
        </p>

        <h2>Выпустить токен</h2>
        <form className="row" method="post" action="/api/tokens">
          <Back path={path} />
          <input type="hidden" name="intent" value="issue" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="text" name="name" placeholder="Имя агента" required />
          <button type="submit">Выпустить</button>
        </form>

        <h2>Выпущенные</h2>
        {tokens.length === 0 ? (
          <p className="muted">Токенов пока нет.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Проект</th>
                <th>Последнее использование</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td>
                    {token.name}
                    {token.revokedAt && <span className="muted"> · отозван</span>}
                  </td>
                  <td className="muted">{token.project.name}</td>
                  <td className="muted">{when(token.lastUsedAt)}</td>
                  <td>
                    {!token.revokedAt && (
                      <form method="post" action="/api/tokens">
                        <Back path={path} />
                        <input type="hidden" name="intent" value="revoke" />
                        <input type="hidden" name="id" value={token.id} />
                        <button className="danger" type="submit">
                          Отозвать
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
