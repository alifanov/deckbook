// Барьер для design-sync: у deckbook нет собранной библиотеки, компоненты
// живут прямо в приложении. Этот файл — единственная точка входа конвертера.
// Header сюда не входит: он async-серверный и ходит в базу (см. NOTES.md).
export {
  Back,
  Banner,
  Dot,
  Head,
  Icon,
  Logo,
  Markdown,
  Prio,
  ProjectNav,
  Reveal,
} from "../src/ui";
export { ConfirmButton } from "../src/confirm";
export { CopyField, CopySnippet } from "../src/copy";
