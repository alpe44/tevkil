-- Uygulama içi bildirimler
CREATE TYPE notification_type AS ENUM (
  'task_open_match',   -- adliyenizde yeni bir görev açıldı
  'task_accepted',     -- açtığınız görevi biri üstlendi
  'account_approved',  -- üyeliğiniz onaylandı
  'account_rejected'   -- üyeliğiniz reddedildi
);

CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
