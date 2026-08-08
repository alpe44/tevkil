-- Profil fotoğrafı: her avukat isteğe bağlı bir fotoğraf yükleyebilir, admin onaylamadan
-- herkese açık görünmez (bkz. server/src/controllers/user.controller.js görünürlük kuralı).
CREATE TYPE avatar_status AS ENUM ('none', 'pending', 'approved', 'rejected');

ALTER TABLE users
  ADD COLUMN avatar_filename        VARCHAR(255),
  ADD COLUMN avatar_status          avatar_status NOT NULL DEFAULT 'none',
  ADD COLUMN avatar_uploaded_at     TIMESTAMPTZ,
  ADD COLUMN avatar_rejection_reason TEXT;

CREATE INDEX idx_users_avatar_status ON users(avatar_status);

-- notifyService'in avatar onay/red bildirimlerini yazabilmesi için mevcut enum'a yeni değerler.
ALTER TYPE notification_type ADD VALUE 'avatar_approved';
ALTER TYPE notification_type ADD VALUE 'avatar_rejected';
