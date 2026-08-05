-- Локальный путь к чекауту проекта на машине владельца: кнопка «Исправить»
-- подставляет его в диплинк Claude Code. Пустой у всех существующих проектов.

ALTER TABLE "Project" ADD COLUMN "localPath" TEXT NOT NULL DEFAULT '';
