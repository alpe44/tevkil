-- Kayıt sırasında zorunlu telefon numarası
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- Görev kabul edilirken zorunlu olarak alınan iletişim/tevkil bilgileri
-- (görev sahibine mail olarak gönderilir; kayıt olarak da tasks tablosunda saklanır)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_phone VARCHAR(30);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_contact VARCHAR(255);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_note TEXT;
