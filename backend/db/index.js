// Força resolução IPv4 — WSL2 e alguns ambientes não têm IPv6 mas o Supabase pode retornar AAAA primeiro
const dns = require('dns');
const _originalLookup = dns.lookup.bind(dns);
dns.lookup = function (hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  if (typeof options === 'number') options = { family: options };
  return _originalLookup(hostname, { ...options, family: 4 }, cb);
};

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada no .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do Postgres:', err.message);
});

async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`🗄  query (${duration}ms):`, text.slice(0, 80).replace(/\s+/g, ' '));
  return res;
}

async function getClient() {
  return pool.connect();
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, getClient, transaction, pool };
