import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentTree } from "../src/app/projects/[slug]/documents/tree";
import type { DocumentNode } from "../src/domain/documents";

const node = (over: Partial<DocumentNode> & { id: string; name: string }): DocumentNode =>
  ({
    isFolder: false,
    content: "",
    projectId: "p1",
    parentId: null,
    updatedBy: null,
    updatedAt: new Date("2026-01-02T10:00:00Z"),
    createdAt: new Date("2026-01-01T10:00:00Z"),
    children: [],
    ...over,
  }) as DocumentNode;

const html = (tree: DocumentNode[], activeId?: string) =>
  renderToStaticMarkup(<DocumentTree tree={tree} slug="deckbook" activeId={activeId} />);

const logs = [
  node({
    id: "f1",
    name: "logs",
    isFolder: true,
    children: [node({ id: "d1", name: "2026-08-02" })],
  }),
];

describe("дерево документов", () => {
  it("папка — схлопываемый <details>, по умолчанию закрытый", () => {
    const out = html(logs);
    expect(out).toContain("<details");
    expect(out).not.toContain("<details open");
    expect(out).toContain("<summary");
    expect(out).toContain("2026-08-02");
  });

  it("папки над выбранным файлом раскрыты", () => {
    expect(html(logs, "d1")).toContain("<details open");
  });

  it("выбранный файл подсвечен, остальные — нет", () => {
    const out = html(logs, "d1");
    expect(out).toContain('class="file here"');
    expect(html(logs, "другой")).not.toContain("file here");
  });

  it("документ остаётся ссылкой без <details>", () => {
    const out = html([node({ id: "d2", name: "spec" })]);
    expect(out).not.toContain("<details");
    expect(out).toContain('href="/projects/deckbook/documents/d2"');
  });

  it("пустое дерево не падает", () => {
    expect(html([])).toContain("Пока пусто");
  });
});
