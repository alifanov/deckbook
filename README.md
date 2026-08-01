# Deckbook

Личный self-hosted трекер задач, у которого MCP — основной интерфейс: задачи
создают и меняют AI-агенты наравне с владельцем. См. `CONTEXT.md` и `docs/adr/`.

Два compose-файла: `docker-compose.yml` — деплой (только приложение, база
внешняя), `docker-compose.local.yml` — всё своё, вместе с Postgres.

## Запуск у себя

```sh
cp .env.example .env      # задать OWNER_PASSWORD и SESSION_SECRET
docker compose -f docker-compose.local.yml up -d
```

Поднимаются Postgres, одноразовый контейнер `migrate` и приложение. Схему
меняет только `migrate` (`prisma migrate deploy`); приложение стартует после
того, как он отработал, — в базу со старой схемой запросы не приходят.
Бэкап — обычный дамп Postgres.

Переменные окружения:

| Переменная       | Смысл                                                  |
| ---------------- | ------------------------------------------------------ |
| `OWNER_PASSWORD` | пароль владельца; при первом входе сохраняется хешем    |
| `SESSION_SECRET` | ключ подписи cookie сессии                              |
| `DATABASE_URL`   | адрес Postgres (в local-compose проставлен автоматически) |
| `APP_PORT`       | порт на хосте, по умолчанию 3000                        |

## Деплой в Coolify

`docker-compose.yml` — тот же образ, но без Postgres: база уже поднята
в Coolify, её адрес приходит переменной `DATABASE_URL`.

1. New Resource → Docker Compose, репозиторий этот, файл `docker-compose.yml`.
2. Задать переменные: `DATABASE_URL`, `OWNER_PASSWORD`, `SESSION_SECRET`.
3. В домене сервиса `app` указать свой хост — Coolify сам проставит его
   в `SERVICE_FQDN_APP_3000` и настроит роутинг на порт 3000.

Каждый деплой сначала поднимает сервис `migrate` и ждёт его успешного
завершения. Если миграция упала — приложение не стартует и остаётся работать
предыдущий контейнер.

**Разово для базы, которая жила на `db push`** (в ней нет таблицы
`_prisma_migrations`, и деплой упадёт с `P3005`). Разметить её как уже
содержащую первую миграцию — данные при этом не трогаются:

```sh
DATABASE_URL=<адрес прод-базы> pnpm exec prisma migrate resolve \
  --applied 20260801000000_init
```

## Подключение агента

1. Завести проект в UI.
2. На странице «Токены» выпустить токен — значение показывается один раз.
3. Скопировать адрес MCP-сервера проекта: `https://<хост>/mcp/<slug-проекта>`.
4. В конфиге агента указать этот адрес и заголовок `Authorization: Bearer <токен>`.

Токен действует только на свой проект: обращение к чужому адресу отвергается,
и ни один инструмент не принимает проект параметром (ADR-0003).

## Разработка

```sh
docker compose -f docker-compose.local.yml up -d db         # только база
pnpm install
pnpm db:migrate                                            # миграции в dev-базу
DATABASE_URL=$TEST_DATABASE_URL pnpm db:migrate            # миграции в тестовую базу
pnpm dev
```

Новая миграция после правки `prisma/schema.prisma` — диффом против текущей
базы. Без `migrate dev` и без shadow-базы: обе умеют ронять данные.

```sh
DIR=prisma/migrations/$(date +%Y%m%d%H%M%S)_короткое_имя && mkdir -p "$DIR"
pnpm exec prisma migrate diff --from-config-datasource \
  --to-schema prisma/schema.prisma --script > "$DIR/migration.sql"
pnpm db:migrate
```

Тесты идут против настоящего Postgres (`TEST_DATABASE_URL`), каждый тест
начинается с чистой схемы:

```sh
pnpm test        # весь набор
pnpm typecheck
pnpm build
```

## Потолок памяти

4 ГБ — позиция, а не пожелание: из неё следует отсутствие Elasticsearch,
брокера очередей, фоновых воркеров и планировщика.

Замер под простоем сразу после деплоя (`docker stats`, 2026-07-31):

| Контейнер   | Память      |
| ----------- | ----------- |
| приложение  | 103 МиБ     |
| Postgres    | 61 МиБ      |
| **всего**   | **164 МиБ** |

Запас до потолка — примерно 25×.
