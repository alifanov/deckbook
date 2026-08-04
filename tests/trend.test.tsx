import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Trend } from "../src/trend";

const html = (trend: number[]) => renderToStaticMarkup(<Trend trend={trend} />);

/** Точки полилинии как пары чисел — так проверяем саму геометрию, а не разметку. */
const points = (out: string): [number, number][] =>
  (out.match(/points="([^"]+)"/)?.[1] ?? "")
    .split(" ")
    .map((pair) => pair.split(",").map(Number) as [number, number]);

describe("линия бэклога", () => {
  it("растущий бэклог идёт вверх и красится тревожно", () => {
    const out = html([0, 1, 1, 2, 2, 3, 4]);
    const ys = points(out).map(([, y]) => y);

    expect(out).toContain('class="trend up"');
    expect(out).toContain("вырос на 4");
    expect(ys.at(-1)).toBeLessThan(ys[0]); // в SVG меньший y — это выше
  });

  it("разгребённый бэклог идёт вниз", () => {
    const out = html([0, -1, -2, -2, -3, -3, -4]);
    const ys = points(out).map(([, y]) => y);

    expect(out).toContain('class="trend down"');
    expect(out).toContain("сократился на 4");
    expect(ys.at(-1)).toBeGreaterThan(ys[0]);
  });

  it("тихая неделя — ровная линия без деления на ноль", () => {
    const ys = points(html([0, 0, 0, 0, 0, 0, 0])).map(([, y]) => y);

    expect(ys.every(Number.isFinite)).toBe(true);
    expect(new Set(ys).size).toBe(1);
    expect(html([0, 0, 0, 0, 0, 0, 0])).toContain("без изменений");
  });

  it("точки раскладываются по всей ширине, по одной на день", () => {
    const xs = points(html([0, 1, 2, 3, 4, 5, 6])).map(([x]) => x);

    expect(xs).toHaveLength(7);
    expect(xs[0]).toBe(0);
    expect(xs.at(-1)).toBe(108);
  });
});
