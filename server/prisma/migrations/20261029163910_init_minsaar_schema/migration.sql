-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_type" TEXT NOT NULL,
    "min_temp_c" DOUBLE PRECISION NOT NULL DEFAULT 22.0,
    "max_temp_c" DOUBLE PRECISION NOT NULL DEFAULT 26.0,
    "square_feet" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ac_units" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "rated_kw" DOUBLE PRECISION NOT NULL,
    "cooling_capacity_kw" DOUBLE PRECISION,
    "controllable" BOOLEAN NOT NULL DEFAULT true,
    "control_mode" TEXT NOT NULL DEFAULT 'ir',
    "equipment_type" TEXT,
    "rated_cop" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ac_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "ac_unit_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "on_time" TEXT NOT NULL,
    "off_time" TEXT NOT NULL,
    "setpoint_c" DOUBLE PRECISION NOT NULL DEFAULT 24.0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "ac_unit_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readings" (
    "id" TEXT NOT NULL,
    "ac_unit_id" TEXT NOT NULL,
    "room_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "power_kw" DOUBLE PRECISION NOT NULL,
    "energy_kwh" DOUBLE PRECISION,
    "set_temp_c" DOUBLE PRECISION NOT NULL,
    "room_temp_c" DOUBLE PRECISION NOT NULL,
    "occupancy" DOUBLE PRECISION NOT NULL,
    "on_off" BOOLEAN NOT NULL,
    "outdoor_temp_c" DOUBLE PRECISION,
    "data_source" TEXT NOT NULL DEFAULT 'measured',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "ac_unit_id" TEXT,
    "room_id" TEXT,
    "target_timestamp" TIMESTAMP(3) NOT NULL,
    "horizon_hours" INTEGER NOT NULL,
    "predicted_energy_kwh" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL,
    "data_source" TEXT NOT NULL DEFAULT 'predicted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomalies" (
    "id" TEXT NOT NULL,
    "ac_unit_id" TEXT NOT NULL,
    "room_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "wasted_kwh_est" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "observations" JSONB NOT NULL DEFAULT '[]',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "ac_unit_id" TEXT,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "action" TEXT NOT NULL,
    "est_kwh" DOUBLE PRECISION NOT NULL,
    "est_cost_inr" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "explanation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_commands" (
    "id" TEXT NOT NULL,
    "ac_unit_id" TEXT NOT NULL,
    "command_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "planned_or_sent" TEXT NOT NULL DEFAULT 'planned',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "created_by" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "steps_completed" INTEGER NOT NULL DEFAULT 0,
    "steps_total" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL,
    "summary" JSONB,
    "error" TEXT,
    "readings_filename" TEXT,
    "schedule_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_steps" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "window_start" TEXT NOT NULL,
    "window_end" TEXT NOT NULL,
    "actual_kwh" DOUBLE PRECISION NOT NULL,
    "predicted_kwh" DOUBLE PRECISION NOT NULL,
    "forecast_next_kwh" DOUBLE PRECISION NOT NULL,
    "anomalies" JSONB NOT NULL DEFAULT '[]',
    "wasted_kwh_est" DOUBLE PRECISION NOT NULL,
    "outside_schedule_hours" BOOLEAN NOT NULL,
    "temp_status" JSONB NOT NULL,
    "recommendation_ids" JSONB NOT NULL DEFAULT '[]',
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "schedules_ac_unit_id_weekday_idx" ON "schedules"("ac_unit_id", "weekday");

-- CreateIndex
CREATE INDEX "readings_ac_unit_id_timestamp_idx" ON "readings"("ac_unit_id", "timestamp");

-- CreateIndex
CREATE INDEX "readings_timestamp_idx" ON "readings"("timestamp");

-- CreateIndex
CREATE INDEX "predictions_target_timestamp_idx" ON "predictions"("target_timestamp");

-- CreateIndex
CREATE INDEX "anomalies_ac_unit_id_timestamp_idx" ON "anomalies"("ac_unit_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "simulation_steps_job_id_idx" ON "simulation_steps"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_steps_job_id_step_index_key" ON "simulation_steps"("job_id", "step_index");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ac_units" ADD CONSTRAINT "ac_units_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_ac_unit_id_fkey" FOREIGN KEY ("ac_unit_id") REFERENCES "ac_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_ac_unit_id_fkey" FOREIGN KEY ("ac_unit_id") REFERENCES "ac_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_ac_unit_id_fkey" FOREIGN KEY ("ac_unit_id") REFERENCES "ac_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_ac_unit_id_fkey" FOREIGN KEY ("ac_unit_id") REFERENCES "ac_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_ac_unit_id_fkey" FOREIGN KEY ("ac_unit_id") REFERENCES "ac_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_commands" ADD CONSTRAINT "control_commands_ac_unit_id_fkey" FOREIGN KEY ("ac_unit_id") REFERENCES "ac_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_jobs" ADD CONSTRAINT "simulation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_steps" ADD CONSTRAINT "simulation_steps_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "simulation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
