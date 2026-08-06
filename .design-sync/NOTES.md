# design-sync — заметки по deckbook

Проект в claude.ai/design: **Deckbook Design System**
`https://claude.ai/design/p/d33d3a5b-3d44-4c0a-a8b1-1741214b256c`

Синхронизировано 13 компонентов, все в группе `general`:
`Back`, `Banner`, `ConfirmButton`, `CopyField`, `CopySnippet`, `Dot`, `Head`,
`Icon`, `Logo`, `Markdown`, `Prio`, `ProjectNav`, `Reveal`.

## Чем этот репозиторий отличается от обычной дизайн-системы

- **Это не библиотека, а приложение.** Нет `dist/`, нет Storybook, нет
  published-пакета. Компоненты живут прямо в `src/ui.tsx`, `src/confirm.tsx`,
  `src/copy.tsx`, стили — в `src/app/globals.css`.
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

## Почему `Header` не в дизайн-системе

С синка 2026-08 `Header` живёт в `src/header.tsx`, стал **async-серверным**
и ходит в базу (`countOwnerTasks`). Такой компонент нельзя ни отрендерить
карточкой в браузере, ни забандлить — он утянет Prisma. Решение владельца:
убрать из системы (карточка и `_preview/Header.js` удалены из проекта).

Вместо него в `conventions.md` описана ручная разметка шапки
(`.top` → `.inner` → `.brand` + `ProjectNav` + `.spacer` + `.act`), и та же
оправа повторена во `previews/ProjectNav.tsx` — иначе навигацию не показать.
Если `Header` когда-нибудь станет синхронным и перестанет ходить в базу,
его можно вернуть в `entry.tsx` + `componentSrcMap` + `dtsPropsFor`.

## Что пришлось чинить

- **`next/link` вне Next.js.** Ему нужен контекст App Router, которого нет
  ни в карточке превью, ни в макете, собранном агентом. Шим
  `.design-sync/shims/next-link.tsx` (обычный `<a href>`) подключён через
  `paths` в `.design-sync/tsconfig.sync.json` — это и есть `cfg.tsconfig`.
- **Фон карточек.** Шаблон превью жёстко задаёт `body{background:#fff}`,
  а страницы Deckbook стоят на `var(--bg)` (тёплая бумага `#f5f2ec`).
  В каждом `.design-sync/previews/*.tsx` содержимое обёрнуто в локальный
  `Surface` с `background: var(--bg)`. Это только оформление карточек, в
  макеты пользователей ничего из этого не уезжает.
- **`ProjectNav` вне `.top .inner` слипается**: промежутки между ссылками
  задаёт CSS шапки, а не сам компонент. Превью с «голой» навигацией
  выглядело сломанным — заменено на три ячейки внутри оправы шапки,
  по одной на каждое значение `at`. Урок: компонент, который в приложении
  живёт только внутри контейнера, и в превью должен быть внутри него.
- **`npm i <pkg>` в `.ds-sync/` вычищает ранее поставленное.** В
  `.ds-sync/package.json` нет `dependencies`, поэтому второй `npm i`
  выкинул esbuild и ts-morph. Ставить всё одной командой:
  `npm i --save esbuild ts-morph @types/react playwright typescript@5`.
- **esbuild из `.ds-sync/node_modules` может оказаться под чужую платформу**
  («You installed esbuild for another platform») — сборка падает в
  `vendorReact`. Лечится сносом и переустановкой одной командой выше:
  `rm -rf .ds-sync/node_modules .ds-sync/package-lock.json`.
- **typescript@7 ломает проверку `.d.ts`.** У него в ESM-namespace нет
  `createSourceFile`, и `package-validate.mjs` молча печатает
  «typescript not in node_modules». В `.ds-sync/` нужен именно
  **typescript@5** (в самом репозитории при этом остаётся 7.x — они не
  конфликтуют, каталоги разные).
- **Playwright на macOS** кэшируется в `~/Library/Caches/ms-playwright`,
  а не в `~/.cache/ms-playwright`.
- **`cd` в Bash-инструменте сохраняется между вызовами.** После `cd .ds-sync`
  или `cd ds-bundle` следующая команда (и `localDir` у `finalize_plan`)
  промахивается мимо корня. Запускать всё от абсолютных путей.
- `cfg.overrides.*.cardMode = "column"` у `ProjectNav`, `CopyField` и
  `Reveal` — их ячейки шире колонки сетки (`[GRID_OVERFLOW]`).

## Известные предупреждения (норма, не чинить)

- `docs: 0/13 components matched (cfg.docsDir=docs)` — в `docs/` лежат
  инструкции для агентов, а не документация компонентов. `.prompt.md`
  синтезируются из `.d.ts` и превью, это ожидаемо.
- `exported PascalCase symbols: 0` — проверка ищет shipped `.d.ts`, которых
  нет; список компонентов приходит из `componentSrcMap`.

## Что осознанно не сделано

- Все 13 компонентов лежат в группе `general`. Разложить по
  Layout / Forms / Feedback можно стабами `cfg.docsMap` с frontmatter
  `category:`, но на таком объёме это лишний слой.
- `Banner` без `error` не рендерит ничего — такой ячейки в превью нет
  намеренно, пустая карточка попала бы в `[RENDER_BLANK]`.
- `Prio` при `priority: "normal"` тоже не рендерит ничего; в ячейке
  `AllPriorities` середина пустая — это и есть демонстрация поведения.
- Раскрытое состояние `Reveal` (`<details open>`) и hover у `ConfirmButton`
  статически снять нельзя — в превью только покой.
- Форматтеры `day`, `dueDay`, `moment`, `plural`, `statusLabel`,
  `priorityLabel` в `entry.tsx` не экспортируются: дизайн-система отдаёт
  компоненты, а не утилиты. В `conventions.md` это сказано явно, потому что
  прошлая версия файла обещала их агенту — и врала.
- `Markdown` тянет в бандл `markdown-it`: `_ds_bundle.js` вырос до ~245 КБ.
  Осознанный размен на то, чтобы агент мог рендерить тексты агентов.

## Риски при следующем синке

- **`cfg.dtsPropsFor` — рукописная копия сигнатур.** Ровно это и разъехалось
  за прошлый цикл: `ProjectNav` получил обязательный `at`, `ConfirmButton` —
  `className` и `label`, и контракт в claude.ai/design молча врал.
  **Сверять сигнатуры всех 13 компонентов с исходниками при каждом синке** —
  ни одна проверка этого не поймает.
- **`.design-sync/entry.tsx` — рукописный список экспортов.** Новый
  компонент в `src/` сам сюда не попадёт: добавлять и в `entry.tsx`, и в
  `componentSrcMap`, и в `dtsPropsFor`. И наоборот: удалённый или
  переехавший компонент валит сборку (так и обнаружился переезд `Header`).
- **Шим `next/link` скрывает реальное поведение.** Если компоненты начнут
  использовать что-то ещё из Next (`usePathname`, `next/navigation`),
  сборка упадёт — понадобится ещё один шим в `tsconfig.sync.json`.
- **`.design-sync/conventions.md` перечисляет классы, токены и имена
  компонентов поимённо.** Правка `globals.css` или `ui.tsx` делает файл
  частично ложным, а агент ему верит. В этот синк там нашлись четыре
  неверных утверждения (`Header` в примере, класс `.prose`, форматтеры дат,
  ссылка на `ui.tsx`). Проверка — скриптом из «Author the conventions
  header»: селекторы против `ds-bundle/_ds_bundle.css`, имена компонентов
  против `ds-bundle/components/general/*`, символы против текста бандла.
- **Списки значений в `dtsPropsFor` захардкожены**: 19 имён `IconName`,
  три значения `NavAt`, пять `TaskStatus`, три `TaskPriority`. Добавили
  глиф или статус — обновить `config.json` вручную.
- Версия в README берётся из `package.json` (`0.1.0`) и к дизайн-системе
  отношения не имеет.
