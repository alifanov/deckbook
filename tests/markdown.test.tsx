import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "../src/ui";

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("Markdown", () => {
  it("рендерит заголовки, списки и код", () => {
    const out = html("# Заголовок\n\n- пункт\n\n`код`");
    expect(out).toContain("<h1>Заголовок</h1>");
    expect(out).toContain("<li>пункт</li>");
    expect(out).toContain("<code>код</code>");
  });

  it("не пропускает сырой HTML — разметка агента остаётся текстом", () => {
    const out = html('<script>alert(1)</script><img src=x onerror="alert(1)">');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("делает ссылку из голого URL", () => {
    expect(html("см. https://example.com/x")).toContain('href="https://example.com/x"');
  });
});
