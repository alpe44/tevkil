-- Görev tamamlanırken bırakılan yorum + admin onay kuyruğu
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comment VARCHAR(1000);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comment_status VARCHAR(20) NOT NULL DEFAULT 'none'; -- none | pending | approved | rejected
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comment_rejection_reason VARCHAR(500);
