# design-sync — заметки по deckbook

Проект в claude.ai/design: **Deckbook Design System**
`https://claude.ai/design/p/d33d3a5b-3d44-4c0a-a8b1-1741214b256c`

## Чем этот репозиторий отличается от обычной дизайн-системы

- **Это не библиотека, а приложение.** Нет `dist/`, нет Storybook, нет
  published-пакета. Семь компонентов живут прямо в `src/ui.tsx`,
  `src/confirm.tsx`, `src/copy.tsx`, стили — в `src/app/globals.css`.
- Поэтому конвертер запускается **не** в synth-entry режиме: он бы сделал
  `export *` из каждого `.tsx` под `src/`, включая `app/**/page.tsx` с их
  Prisma и `next/navigation`, и сборка бы взорвалась. Вместо этого есть
  рукописный барьер `.design-sync/entry.tsx` (передаётся как `--entry`),
  а список компонентов задан `cfg.componentSrcMap` целиком.
- `.d.ts` взять неоткуда, поэтому пропсы прописаны руками в
  `cfg.dtsPropsFor` — **при изменении сигнатуры компонента их надо
  обновить вручную**, автоматика этого не заметит.

## Команда сборки

```sh
node .ds-sync/resync.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./.design-sync/entry.tsx \
  --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

`buildCmd` в конфиге нет намеренно: собирать нечего, конвертер бандлит
исходники напрямую.

## Что пришлось чинить

- **`next/link` вне Next.js.** Ему нужен контекст App Router, которого нет
  ни в карточке превью, ни в макете, собранном агентом. Шим
  `.design-sync/shims/next-link.tsx` (обычный `<a href>`) подключён через
  `paths` в `.design-sync/tsconfig.sync.json` — это и есть `cfg.tsconfig`.
  Благодаря шиму в бандл не утянуло ни одного npm-пакета (`inlined: 0`).
- **Белый фон карточек.** Шаблон превью жёстко задаёт
  `body{background:#fff}`, а Deckbook — тёмная система (`color-scheme: dark`).
  В каждом `.design-sync/previews/*.tsx` содержимое обёрнуто в локальный
  `Surface` с `background: var(--bg)`. Это только оформление карточек, в
  макеты пользователей ничего из этого не уезжает.
- **`npm i <pkg>` в `.ds-sync/` вычищает ранее поставленное.** В
  `.ds-sync/package.json` нет `dependencies`, поэтому второй `npm i`
  выкинул esbuild и ts-morph. Ставить всё одной командой:
  `npm i --save esbuild ts-morph @types/react playwright typescript@5`.
- **typescript@7 ломает проверку `.d.ts`.** У него в ESM-namespace нет
  `createSourceFile`, и `package-validate.mjs` молча печатает
  «typescript not in node_modules». В `.ds-sync/` нужен именно
  **typescript@5** (в самом репозитории при этом остаётся 7.x — они не
  конфликтуют, каталоги разные).
- **Playwright на macOS** кэшируется в `~/Library/Caches/ms-playwright`,
  а не в `~/.cache/ms-playwright`.
- `Header` и `ProjectNav` шире ячейки сетки → `cfg.overrides.*.cardMode =
  "column"`.

## Известные предупреждения (норма, не чинить)

- `docs: 0/7 components matched (cfg.docsDir=docs)` — в `docs/` лежат
  инструкции для агентов, а не документация компонентов. `.prompt.md`
  синтезируются из `.d.ts` и превью, это ожидаемо.
- `exported PascalCase symbols: 0` — проверка ищет shipped `.d.ts`, которых
  нет; список компонентов приходит из `componentSrcMap`.

## Что осознанно не сделано

- Все семь компонентов лежат в группе `general`. Разложить по
  Layout / Forms / Feedback можно стабами `cfg.docsMap` с frontmatter
  `category:`, но на семи компонентах это лишний слой.
- `Banner` без `error` не рендерит ничего — такой ячейки в превью нет
  намеренно, пустая карточка попала бы в `[RENDER_BLANK]`.
- `ConfirmButton` в состоянии hover (там появляется красный `.danger`)
  статически снять нельзя.
- В `src/ui.tsx` у `Header`, `ProjectNav`, `Banner`, `Back` нет JSDoc,
  поэтому в их `.prompt.md` нет описания — только пропсы и примеры.
  Исходники приложения в рамках синка не трогали.

## Риски при следующем синке

- **`cfg.dtsPropsFor` — рукописная копия сигнатур.** Изменили пропсы
  компонента — контракт в claude.ai/design разъедется молча, ни одна
  проверка этого не поймает. Сверять при каждом синке.
- **`.design-sync/entry.tsx` — рукописный список экспортов.** Новый
  компонент в `src/` сам сюда не попадёт: добавлять и в `entry.tsx`, и в
  `componentSrcMap`, и в `dtsPropsFor`.
- **Шим `next/link` скрывает реальное поведение.** Если `Header` или
  `ProjectNav` начнут использовать что-то ещё из Next (`usePathname`,
  `next/navigation`), сборка упадёт — понадобится ещё один шим в
  `tsconfig.sync.json`.
- **`.design-sync/conventions.md` перечисляет классы и токены поимённо.**
  Правка `globals.css` делает файл частично ложным, а агент ему верит.
  Сверять список селекторов с `ds-bundle/_ds_bundle.css` после каждого
  изменения стилей.
- Версия в README берётся из `package.json` (`0.1.0`) и к дизайн-системе
  отношения не имеет.
