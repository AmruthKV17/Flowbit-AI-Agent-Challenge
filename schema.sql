CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT UNIQUE NOT NULL,
  vendor TEXT NOT NULL,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor TEXT NOT NULL,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_notes (
  id SERIAL PRIMARY KEY,
  dn_number TEXT UNIQUE NOT NULL,
  vendor TEXT NOT NULL,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS human_corrections (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  vendor TEXT NOT NULL,
  corrections JSONB NOT NULL,
  final_decision TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_memories (
  id SERIAL PRIMARY KEY,
  vendor TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS correction_memories (
  id SERIAL PRIMARY KEY,
  vendor TEXT NOT NULL,
  field TEXT NOT NULL,
  pattern JSONB NOT NULL,
  suggested_value JSONB NOT NULL,
  confidence REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resolution_memories (
  id SERIAL PRIMARY KEY,
  memory_type TEXT NOT NULL,
  memory_id INT NOT NULL,
  approvals INT NOT NULL DEFAULT 0,
  rejections INT NOT NULL DEFAULT 0,
  last_decision_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  step TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details TEXT NOT NULL
);
