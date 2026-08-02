-- Задачу можно назначить на владельца, а не только на агента.
-- Существующие задачи остаются как были: ничьи или на агенте.

ALTER TABLE "Task" ADD COLUMN "assignedToOwner" BOOLEAN NOT NULL DEFAULT false;
