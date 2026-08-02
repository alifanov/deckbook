import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Branch } from "../src/app/projects/[slug]/documents/tree";
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

const html = (n: DocumentNode) => renderToStaticMarkup(<Branch node={n} slug="deckbook" />);

describe("дерево документов", () => {
  it("папка — схлопываемый <details>, раскрытый по умолчанию", () => {
    const out = html(
      node({
        id: "f1",
        name: "logs",
        isFolder: true,
        children: [node({ id: "d1", name: "2026-08-02" })],
      }),
    );
    expect(out).toContain('<details class="tree" open');
    expect(out).toContain("<summary");
    expect(out).toContain("2026-08-02");
  });

  it("пустая папка тоже схлопывается", () => {
    const out = html(node({ id: "f2", name: "пусто", isFolder: true }));
    expect(out).toContain("<summary");
    expect(out).not.toContain('class="kids"');
  });

  it("документ остаётся обычной строкой без <details>", () => {
    const out = html(node({ id: "d2", name: "spec" }));
    expect(out).not.toContain("<details");
    expect(out).toContain('href="/projects/deckbook/documents/d2"');
  });
});
