import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmButton } from "../src/confirm";
import { Icon, Reveal } from "../src/ui";

describe("действия без подписи", () => {
  it("bare-Reveal прячет текст, но оставляет подпись для доступности", () => {
    const out = renderToStaticMarkup(
      <Reveal label="Переименовать" icon="pencil" bare>
        <span>форма</span>
      </Reveal>,
    );
    expect(out).toContain('aria-label="Переименовать"');
    expect(out).toContain('title="Переименовать"');
    expect(out).not.toContain(">Переименовать<");
  });

  it("обычный Reveal подпись показывает", () => {
    const out = renderToStaticMarkup(
      <Reveal label="Переименовать" icon="pencil">
        <span>форма</span>
      </Reveal>,
    );
    expect(out).toContain("Переименовать</span>");
    expect(out).not.toContain("aria-label");
  });

  it("кнопка удаления с одним значком подписана через label", () => {
    const out = renderToStaticMarkup(
      <ConfirmButton message="Удалить?" label="Удалить">
        <Icon name="trash" />
      </ConfirmButton>,
    );
    expect(out).toContain('aria-label="Удалить"');
    expect(out).toContain('title="Удалить"');
  });
});
