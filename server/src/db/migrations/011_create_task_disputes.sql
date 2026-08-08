-- Başvuranın bir görevle ilgili admin'e ilettiği itiraz/şikayetler
CREATE TABLE IF NOT EXISTS task_disputes (
  id           SERIAL PRIMARY KEY,
  task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  resolved     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_disputes_task ON task_disputes(task_id);
