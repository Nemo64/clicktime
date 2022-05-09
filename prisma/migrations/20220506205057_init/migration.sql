-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('user', 'tag', 'list');

-- CreateTable
CREATE TABLE "Timeplan" (
    "id" SERIAL4 NOT NULL,
    "name" STRING NOT NULL,
    "team_id" STRING NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "target_id" STRING NOT NULL,
    "cycle_start" DATE NOT NULL,
    "cycle_days" INT2 NOT NULL,
    "cycle_end" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Timeplan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Timeplan_team_id_cycle_end_idx" ON "Timeplan"("team_id", "cycle_end");
