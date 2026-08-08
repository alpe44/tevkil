-- Görev oluşturma formuna eklenen ek alanlar (görev türü, bütçe, saat, adliye dışı işlem)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(80);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS budget VARCHAR(60);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time VARCHAR(5);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_off_site BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS off_site_address VARCHAR(255);
