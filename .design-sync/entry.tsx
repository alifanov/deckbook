// Барьер для design-sync: у deckbook нет собранной библиотеки, компоненты
// живут прямо в приложении. Этот файл — единственная точка входа конвертера.
export { Back, Banner, Header, ProjectNav, when } from "../src/ui";
export { ConfirmButton } from "../src/confirm";
export { CopyField, CopySnippet } from "../src/copy";
