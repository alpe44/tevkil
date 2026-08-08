-- Kullanıcılar (avukatlar + admin)
CREATE TYPE user_role AS ENUM ('lawyer', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  full_name         VARCHAR(150)   NOT NULL,
  email             VARCHAR(255)   NOT NULL UNIQUE,
  password_hash     VARCHAR(255)   NOT NULL,
  bar_association   VARCHAR(120)   NOT NULL,   -- Baro
  bar_registry_no   VARCHAR(40)    NOT NULL,   -- Sicil No
  province          VARCHAR(80)    NOT NULL,   -- İl
  courthouse        VARCHAR(150)   NOT NULL,   -- Adliye
  bio               TEXT,
  role              user_role      NOT NULL DEFAULT 'lawyer',
  status            user_status    NOT NULL DEFAULT 'pending',
  rating_avg        NUMERIC(2,1),
  completed_count   INTEGER        NOT NULL DEFAULT 0,
  created_count     INTEGER        NOT NULL DEFAULT 0,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  UNIQUE (bar_association, bar_registry_no)
);

CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_courthouse ON users(courthouse);
