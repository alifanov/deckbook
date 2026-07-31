import MarkdownIt from "markdown-it";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../../../../confirm";
import {
  getDocument,
  listDocumentTree,
  type DocumentNode,
} from "../../../../../domain/documents";
import { getProjectBySlug } from "../../../../../domain/projects";
import { Back, Banner, Header, ProjectNav, when } from "../../../../../ui";

export const dynamic = "force-dynamic";

// html: false — разметка агента остаётся текстом, а не исполняемым HTML
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

function folders(nodes: DocumentNode[], depth = 0): { id: string; label: string }[] {
  return nodes
    .filter((n) => n.isFolder)
    .flatMap((n) => [
      { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
      ...folders(n.children, depth + 1),
    ]);
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

  return (
    <>
      <Header>
        <ProjectNav slug={slug} />
      </Header>
      <main>
        <p className="muted">
          <Link href={`/projects/${slug}/documents`}>← Документы</Link>
        </p>
        <h1>{document.name}</h1>
        <Banner error={error} />
        <p className="muted">
          Последним менял: {document.updatedBy ? `агент ${document.updatedBy.name}` : "владелец"} ·{" "}
          {when(document.updatedAt)}
        </p>

        {document.isFolder ? (
          <p className="muted">
            Папка. Её содержимое видно в{" "}
            <Link href={`/projects/${slug}/documents`}>дереве документов</Link>.
          </p>
        ) : edit ? (
          <form method="post" action="/api/documents">
            <Back path={path} />
            <input type="hidden" name="intent" value="write" />
            <input type="hidden" name="id" value={id} />
            <textarea name="content" defaultValue={document.content} style={{ minHeight: 320 }} />
            <div className="row">
              <button type="submit">Сохранить</button>
              <Link href={path}>отменить</Link>
              <span className="muted">запись затирает предыдущее содержимое безвозвратно</span>
            </div>
          </form>
        ) : (
          <>
            <div className="row">
              <Link href={`${path}?edit=1`}>Редактировать</Link>
            </div>
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: markdown.render(document.content) }}
            />
          </>
        )}

        <h2>Название и место</h2>
        <form className="row" method="post" action="/api/documents">
          <Back path={path} />
          <input type="hidden" name="intent" value="rename" />
          <input type="hidden" name="id" value={id} />
          <input type="text" name="name" defaultValue={document.name} required />
          <button type="submit">Переименовать</button>
        </form>

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
          <button type="submit">Переместить</button>
        </form>

        <form className="row" method="post" action="/api/documents">
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
            Удалить
          </ConfirmButton>
        </form>
      </main>
    </>
  );
}
