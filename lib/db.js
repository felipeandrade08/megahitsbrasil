const { Pool } = require('pg');

let pool;
let initialized = false;
let initializing;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

async function ensureSchema() {
  if (initialized) return;
  if (initializing) return initializing;
  initializing = (async () => {
    const p = getPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id BIGSERIAL PRIMARY KEY,
        stripe_session_id TEXT UNIQUE NOT NULL,
        stripe_payment_intent TEXT,
        email TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        product TEXT NOT NULL DEFAULT 'megahitsbrasil_15gb',
        amount INTEGER NOT NULL DEFAULT 990,
        currency TEXT NOT NULL DEFAULT 'brl',
        status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT NOT NULL DEFAULT 'card',
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS purchases_email_idx ON purchases (LOWER(email));
      CREATE INDEX IF NOT EXISTS purchases_email_whatsapp_idx ON purchases (LOWER(email), whatsapp);

      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'card';
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS admin_note TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS proof_data BYTEA;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS proof_mime TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS proof_name TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS access_blocked BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_type TEXT NOT NULL DEFAULT 'main';
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS update_id BIGINT;

      CREATE TABLE IF NOT EXISTS updates (
        id BIGSERIAL PRIMARY KEY,
        month_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL DEFAULT 490,
        currency TEXT NOT NULL DEFAULT 'brl',
        download_url TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS purchases_update_idx ON purchases(update_id);
      CREATE INDEX IF NOT EXISTS purchases_type_idx ON purchases(purchase_type);
    `);
    initialized = true;
  })();
  try { await initializing; } finally { initializing = null; }
}

module.exports = { getPool, ensureSchema };
