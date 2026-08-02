import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../../../../confirm";
import { getDocument, listDocumentTree, type DocumentNode } from "../../../../../domain/documents";
import { getProjectBySlug } from "../../../../../domain/projects";
import {
  Back,
  Banner,
  Header,
  Icon,
  Markdown,
  moment,
  ProjectNav,
  Reveal,
} from "../../../../../ui";

export const dynamic = "force-dynamic";

function folders(nodes: DocumentNode[], depth = 0): { id: string; label: string }[] {
  return nodes
    .filter((n) => n.isFolder)
    .flatMap((n) => [
      { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
      ...folders(n.children, depth + 1),
    ]);
}

/** Цепочка папок до документа — из уже загруженного дерева, без лишних запросов. */
function trail(nodes: DocumentNode[], id: string): DocumentNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [];
    const inside = trail(node.children, id);
    if (inside) return [node, ...inside];
  }
  return null;
}

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { slug, id } = await params;
  const { error, edit } = await searchParams;

  const project = await getProjectBySlug(slug);
  const document = await getDocument(id);
  if (!project || !document || document.projectId !== project.id) notFound();

  const tree = await listDocumentTree(project.id);
  const path = `/projects/${slug}/documents/${id}`;
  const editing = Boolean(edit) && !document.isFolder;

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="documents" />
      </Header>
      <main>
        <p className="crumbs">
          <Link href={`/projects/${slug}`}>{project.name}</Link>
          {" / "}
          <Link href={`/projects/${slug}/documents`}>Документы</Link>
          {(trail(tree, id) ?? []).map((node) => (
            <span key={node.id}>
              {" / "}
              <Link href={`/projects/${slug}/documents/${node.id}`}>{node.name}</Link>
            </span>
          ))}
        </p>

        {editing ? (
          <>
            <h1 style={{ marginBottom: 10 }}>{document.name}</h1>
            <p className="muted" style={{ margin: "0 0 22px" }}>
              Правка · запись затирает предыдущее содержимое безвозвратно
            </p>
            <Banner error={error} />

            <div className="card" style={{ padding: "20px 24px" }}>
              <form method="post" action="/api/documents">
                <Back path={path} />
                <input type="hidden" name="intent" value="write" />
                <input type="hidden" name="id" value={id} />
                <textarea name="content" defaultValue={document.content} />
                <div className="bar" style={{ gap: 16, marginTop: 16 }}>
                  <button type="submit">
                    <Icon name="check" />
                    Сохранить
                  </button>
                  <Link className="act" href={path}>
                    <Icon name="x" />
                    Отмена
                  </Link>
                  <span className="spacer" />
                  <span className="muted">markdown · предпросмотр после сохранения</span>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            <div className="bar" style={{ alignItems: "baseline", marginBottom: 10 }}>
              <h1 style={{ margin: 0 }}>{document.name}</h1>
              <span className="spacer" />
              {!document.isFolder && (
                <Link className="act go" href={`${path}?edit=1`}>
                  <Icon name="pencil" />
                  Редактировать
                </Link>
              )}
            </div>
            <p className="muted" style={{ margin: "0 0 26px" }}>
              Последним менял{" "}
              {document.updatedBy ? `агент ${document.updatedBy.name}` : "владелец"} ·{" "}
              {moment(document.updatedAt)}
            </p>
            <Banner error={error} />

            {document.isFolder ? (
              <p className="muted">
                Папка. Её содержимое видно в{" "}
                <Link href={`/projects/${slug}/documents`}>дереве документов</Link>.
              </p>
            ) : document.content.trim() === "" ? (
              <p className="muted">Документ пуст.</p>
            ) : (
              <div className="card" style={{ padding: "28px 32px" }}>
                <Markdown text={document.content} />
              </div>
            )}
          </>
        )}

        <div className="bar" style={{ gap: 20, marginTop: 22 }}>
          <Reveal label="Переименовать" icon="pencil" drop>
            <form className="row" method="post" action="/api/documents">
              <Back path={path} />
              <input type="hidden" name="intent" value="rename" />
              <input type="hidden" name="id" value={id} />
              <input type="text" name="name" defaultValue={document.name} required />
              <button type="submit">
                <Icon name="check" />
                Готово
              </button>
            </form>
          </Reveal>

          <Reveal label="Переместить" icon="move" drop>
            <form className="row" method="post" action="/api/documents">
              <Back path={path} />
              <input type="hidden" name="intent" value="move" />
              <input type="hidden" name="id" value={id} />
              <select name="parentId" defaultValue={document.parentId ?? ""}>
                <option value="">в корень</option>
                {folders(tree)
                  .filter((folder) => folder.id !== id)
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.label}
                    </option>
                  ))}
              </select>
              <button type="submit">
                <Icon name="move" />
                Переместить
              </button>
            </form>
          </Reveal>

          <span className="spacer" />

          <form className="inline" method="post" action="/api/documents">
            <Back path={path} />
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="after" value={`/projects/${slug}/documents`} />
            <ConfirmButton
              message={
                document.isFolder
                  ? "Удалить папку вместе со всем содержимым?"
                  : "Удалить документ? Восстановить его будет неоткуда."
              }
            >
              <Icon name="trash" />
              Удалить {document.isFolder ? "папку" : "документ"}
            </ConfirmButton>
          </form>
        </div>
      </main>
    </>
  );
}
