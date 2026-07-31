import Link from "next/link";
import { notFound } from "next/navigation";
import { listDocumentTree, type DocumentNode } from "../../../../domain/documents";
import { getProjectBySlug } from "../../../../domain/projects";
import { Back, Banner, Header, ProjectNav } from "../../../../ui";

export const dynamic = "force-dynamic";

function Branch({ node, slug }: { node: DocumentNode; slug: string }) {
  const label = (
    <Link href={`/projects/${slug}/documents/${node.id}`}>
      {node.isFolder ? `${node.name}/` : node.name}
    </Link>
  );

  if (!node.isFolder || node.children.length === 0) return <li>{label}</li>;

  return (
    <li>
      <details open>
        <summary>{label}</summary>
        <ul className="tree">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} slug={slug} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function flatten(nodes: DocumentNode[], depth = 0): { id: string; label: string }[] {
  return nodes
    .filter((n) => n.isFolder)
    .flatMap((n) => [
      { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
      ...flatten(n.children, depth + 1),
    ]);
}

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
  const folders = flatten(tree);
  const path = `/projects/${slug}/documents`;

  const folderSelect = (
    <select name="parentId" defaultValue="">
      <option value="">в корне</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.label}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Header>
        <ProjectNav slug={slug} />
      </Header>
      <main>
        <h1>Документы проекта «{project.name}»</h1>
        <Banner error={error} />

        {tree.length === 0 ? (
          <p className="muted">Документов пока нет.</p>
        ) : (
          <ul className="tree">
            {tree.map((node) => (
              <Branch key={node.id} node={node} slug={slug} />
            ))}
          </ul>
        )}

        <h2>Создать</h2>
        <form className="row" method="post" action="/api/documents">
          <Back path={path} />
          <input type="hidden" name="intent" value="create-folder" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="text" name="name" placeholder="Название папки" required />
          {folderSelect}
          <button type="submit">Создать папку</button>
        </form>

        <form className="row" method="post" action="/api/documents">
          <Back path={path} />
          <input type="hidden" name="intent" value="create-document" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="text" name="name" placeholder="Название документа" required />
          {folderSelect}
          <button type="submit">Создать документ</button>
        </form>

        <h2>Загрузить файлы</h2>
        <form className="row" method="post" action="/api/documents" encType="multipart/form-data">
          <Back path={path} />
          <input type="hidden" name="intent" value="import" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="file" name="files" accept=".md,.txt" multiple required />
          {folderSelect}
          <button type="submit">Импортировать</button>
        </form>
        <p className="muted">
          Принимаются <code>.md</code> и <code>.txt</code>: содержимое становится документом, сам
          файл нигде не сохраняется.
        </p>
      </main>
    </>
  );
}
