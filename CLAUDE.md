## Dogfooding

Deckbook хранит собственные задачи и документы в себе же — через MCP `deckbook-deckbook`.

- **Задачи**: `my_tasks`, `create_task`, `set_task_status`, `comment_on_task`, … — не `.scratch/`, не GitHub Issues.
- **Документы**: `read_document_tree`, `read_document`, `create_document`, `write_document` — спеки, заметки, решения пишем туда.

В репозитории остаются только `CONTEXT.md` и `docs/adr/` (глоссарий домена и ADR) — их читают инженерные скиллы. См. `docs/agents/domain.md`.

## Agent skills

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.
