import Link from "next/link";
import { notFound } from "next/navigation";
import { listDocumentTree, type DocumentNode } from "../../../../domain/documents";
import { getProjectBySlug } from "../../../../domain/projects";
import { Header } from "../../../../header";
import { Back, Banner, Icon, ProjectNav } from "../../../../ui";
import { DocumentTree } from "./tree";

export const dynamic = "force-dynamic";

const folders = (nodes: DocumentNode[], depth = 0): { id: string; label: string }[] =>
  nodes
    .filter((n) => n.isFolder)
    .flatMap((n) => [
      { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
      ...folders(n.children, depth + 1),
    ]);

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const tree = await listDocumentTree(project.id);
  const path = `/projects/${slug}/documents`;

  // выбор папки стоит под оправой, а не в ней: form= связывает его со своей формой
  const folderSelect = (form: string) => (
    <select form={form} name="parentId" defaultValue="" style={{ flex: 1, minWidth: 0 }}>
      <option value="">в корне</option>
      {folders(tree).map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.label}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="documents" />
      </Header>
      <main>
        <p className="crumbs">
          <Link href={`/projects/${slug}`}>{project.name}</Link>
        </p>
        <h1 style={{ marginBottom: 26 }}>Документы</h1>
        <Banner error={error} />

        <div className="panes">
          <DocumentTree tree={tree} slug={slug} />

          <section>
            <p className="muted" style={{ marginTop: 0 }}>
              Выберите файл слева — содержимое откроется здесь.
            </p>

            {/* создание и загрузка — два действия одной формы страницы:
                подпись слева, поля справа, каждое со своей оправой */}
            <div
              className="card fields"
              style={{ padding: "14px 18px", "--label": "88px" } as React.CSSProperties}
            >
              <span className="name" style={{ alignSelf: "start", paddingTop: 9 }}>
                Создать
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <form className="pill" method="post" action="/api/documents" id="doc-create">
                  <Back path={path} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input
                    type="text"
                    name="name"
                    placeholder="Название документа или папки"
                    required
                  />
                  <button type="submit">
                    <Icon name="plus" />
                    Создать
                  </button>
                </form>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    form="doc-create"
                    name="intent"
                    defaultValue="create-document"
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="create-document">документ</option>
                    <option value="create-folder">папка</option>
                  </select>
                  {folderSelect("doc-create")}
                </div>
              </div>

              <span className="sep" />

              <span className="name" style={{ alignSelf: "start", paddingTop: 9 }}>
                Загрузить
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <form
                  className="pill"
                  method="post"
                  action="/api/documents"
                  encType="multipart/form-data"
                  id="doc-import"
                >
                  <Back path={path} />
                  <input type="hidden" name="intent" value="import" />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="file" name="files" accept=".md,.txt" multiple required />
                  <button type="submit">
                    <Icon name="upload" />
                    Загрузить
                  </button>
                </form>
                {folderSelect("doc-import")}
              </div>

              <span />
              <span className="muted" style={{ fontSize: 13 }}>
                Содержимое становится документом, сам файл нигде не сохраняется.
              </span>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
