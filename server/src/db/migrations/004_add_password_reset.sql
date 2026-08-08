-- Şifre sıfırlama: ham token asla saklanmaz, yalnızca SHA-256 hash'i saklanır.
ALTER TABLE users
  ADD COLUMN reset_token_hash VARCHAR(64),
  ADD COLUMN reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX idx_users_reset_token_hash ON users(reset_token_hash);
