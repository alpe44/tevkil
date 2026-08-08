-- Görevler (tevkil ilanları)
CREATE TYPE task_status AS ENUM ('open', 'assigned', 'completed');

CREATE TABLE tasks (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200)  NOT NULL,
  description   TEXT          NOT NULL,
  city          VARCHAR(150)  NOT NULL,   -- Adliye / İl
  due_date      DATE,
  owner_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignee_id   INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  status        task_status   NOT NULL DEFAULT 'open',
  rating        SMALLINT      CHECK (rating BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  assigned_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
