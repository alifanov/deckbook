import { describe, expect, it } from "vitest";
import { buildTree, trail } from "../src/domain/tree";

const flat = [
  { id: "root", parentId: null },
  { id: "docs", parentId: "root" },
  { id: "file", parentId: "docs" },
  { id: "other", parentId: null },
];

const tree = buildTree(flat, null);

describe("trail", () => {
  it("возвращает цепочку папок до узла, без самого узла", () => {
    expect(trail(tree, "file")?.map((n) => n.id)).toEqual(["root", "docs"]);
  });

  it("у корневого узла цепочка пуста", () => {
    expect(trail(tree, "other")).toEqual([]);
  });

  it("для чужого узла — null, а не пустая цепочка", () => {
    expect(trail(tree, "нет такого")).toBeNull();
  });
});
