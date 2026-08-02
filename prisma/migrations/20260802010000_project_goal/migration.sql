-- Цель проекта (ADR-0007): свободный текст, пустой у всех существующих
-- проектов — отсутствие цели ничего не ломает.

ALTER TABLE "Project" ADD COLUMN "goal" TEXT NOT NULL DEFAULT '';
