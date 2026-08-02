-- Шаблонов задач больше нет (ADR-0006).
-- Порядок важен: сначала уходят деревья шаблонов, и только потом projectId
-- становится обязательным — иначе глобальные шаблоны (projectId = null)
-- уронят миграцию.

DELETE FROM "Task" WHERE "isTemplate";

ALTER TABLE "Task" ALTER COLUMN "projectId" SET NOT NULL;

DROP INDEX "Task_projectId_isTemplate_idx";

ALTER TABLE "Task" DROP COLUMN "isTemplate";

CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
