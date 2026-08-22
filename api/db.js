const { Pool } = require('pg');

let pool;
let initialized = false;
let initializing;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS purchases_email_idx ON purchases (LOWER(email));
      CREATE INDEX IF NOT EXISTS purchases_email_whatsapp_idx ON purchases (LOWER(email), whatsapp);
    `);
    initialized = true;
  })();
  try { await initializing; } finally { initializing = null; }
}

module.exports = { getPool, ensureSchema };
