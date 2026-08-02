import Link from "next/link";
import { notFound } from "next/navigation";
import { listDocumentTree, type DocumentNode } from "../../../../domain/documents";
import { getProjectBySlug } from "../../../../domain/projects";
import { Header } from "../../../../header";
import { Back, Banner, Head, Icon, plural, ProjectNav } from "../../../../ui";
import { Branch } from "./tree";

export const dynamic = "force-dynamic";

const folders = (nodes: DocumentNode[], depth = 0): { id: string; label: string }[] =>
  nodes
    .filter((n) => n.isFolder)
    .flatMap((n) => [
      { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
      ...folders(n.children, depth + 1),
    ]);

const countFiles = (nodes: DocumentNode[]): number =>
  nodes.reduce((n, node) => n + (node.isFolder ? 0 : 1) + countFiles(node.children), 0);

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

  const folderSelect = (
    <select name="parentId" defaultValue="">
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

        <Head title="Дерево" count={plural(countFiles(tree), "файл", "файла", "файлов")} />
        {tree.length === 0 ? (
          <p className="muted">Документов пока нет.</p>
        ) : (
          <div className="card tight list">
            {tree.map((node) => (
              <Branch key={node.id} node={node} slug={slug} />
            ))}
          </div>
        )}

        <Head title="Добавить" />
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <form className="row" method="post" action="/api/documents">
            <Back path={path} />
            <input type="hidden" name="projectId" value={project.id} />
            <input type="text" name="name" placeholder="Название документа или папки" required />
            <select name="intent" defaultValue="create-document">
              <option value="create-document">документ</option>
              <option value="create-folder">папка</option>
            </select>
            {folderSelect}
            <button type="submit">
              <Icon name="plus" />
              Создать
            </button>
          </form>

          <form
            className="row"
            method="post"
            action="/api/documents"
            encType="multipart/form-data"
          >
            <Back path={path} />
            <input type="hidden" name="intent" value="import" />
            <input type="hidden" name="projectId" value={project.id} />
            <input type="file" name="files" accept=".md,.txt" multiple required />
            {folderSelect}
            <button className="plain" type="submit">
              <Icon name="upload" />
              Загрузить .md или .txt
            </button>
            <span className="muted">
              содержимое становится документом, сам файл нигде не сохраняется
            </span>
          </form>
        </div>
      </main>
    </>
  );
}
