-- Kayıt sırasında alınan KVKK açık rıza onayının zaman damgası (kanıt amaçlı)
ALTER TABLE users ADD COLUMN IF NOT EXISTS kvkk_consent_at TIMESTAMPTZ;
