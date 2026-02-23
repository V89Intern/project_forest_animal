-- ============================================================
-- Forest Animal Project — PostgreSQL Schema
-- ============================================================

-- Role lookup
CREATE TABLE IF NOT EXISTS Role (
  Role_ID   SERIAL      PRIMARY KEY,
  Role_Name VARCHAR(50) NOT NULL UNIQUE
);

-- Customer (back-office users, PIN login)
CREATE TABLE IF NOT EXISTS Customer (
  Customer_ID SERIAL       PRIMARY KEY,
  PIN         CHAR(6)      NOT NULL UNIQUE,
  Name        VARCHAR(200) NOT NULL,
  Role_ID     INT          REFERENCES Role(Role_ID) ON DELETE SET NULL
);

-- Users (public upload portal users, phone-based)
CREATE TABLE IF NOT EXISTS Users (
  User_ID          CHAR(3)     PRIMARY KEY CHECK (User_ID ~ '^\d{3}$'),
  Phone_Number     VARCHAR(20) NOT NULL,
  PDPA_Check       BOOLEAN     NOT NULL DEFAULT FALSE,
  Role_ID          INT         REFERENCES Role(Role_ID) ON DELETE SET NULL,
  Create_Timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Picture_Electronic (main upload / image records)
CREATE TABLE IF NOT EXISTS Picture_Electronic (
  PE_ID            SERIAL       PRIMARY KEY,
  Url_Path         TEXT         NOT NULL,
  Phone_Number     VARCHAR(20)  NOT NULL,
  Owner_Name       VARCHAR(200),
  Uploader_ID      INT          NOT NULL,
  Uploader_Type    VARCHAR(10)  NOT NULL CHECK (Uploader_Type IN ('CUSTOMER', 'USER')),
  Upload_Timestamp TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast phone-number lookups on downloads
CREATE INDEX IF NOT EXISTS idx_pe_phone ON Picture_Electronic(Phone_Number);

-- ── Seed Roles ──────────────────────────────────────────────
INSERT INTO Role (Role_Name) VALUES ('ADMIN'), ('STAFF'), ('USER')
  ON CONFLICT (Role_Name) DO NOTHING;

-- ── Seed Customers ──────────────────────────────────────────
-- ADMIN role_id = 1
INSERT INTO Customer (PIN, Name, Role_ID) VALUES
  ('173925', 'Not',    1),
  ('294017', 'Tong',   1),
  ('346708', 'Naming', 1)
ON CONFLICT (PIN) DO NOTHING;
