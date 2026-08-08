-- Görev başvuru sistemi: "Görevi Al" artık doğrudan üstlenme değil, bir başvurudur.
-- Görev sahibi, Görev Takibi ekranından başvuranları görüp onaylar/reddeder.
CREATE TABLE IF NOT EXISTS task_applications (
  id              SERIAL PRIMARY KEY,
  task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  applicant_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  phone           VARCHAR(30),
  contact_address VARCHAR(255),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ,
  UNIQUE (task_id, applicant_id)
);
CREATE INDEX IF NOT EXISTS idx_task_applications_task ON task_applications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_applications_applicant ON task_applications(applicant_id);
