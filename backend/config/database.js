import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

let pgPool = null;

export const getPgPool = () => {
  if (!pgPool) {
    console.log(`[DB] Creating PostgreSQL pool: ${config.database.user}@${config.database.host}:${config.database.port}/${config.database.name}`);
    pgPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: config.database.poolMax,
      min: config.database.poolMin,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      application_name: 'nebula-hosting'
    });

    pgPool.on('error', (err) => {
      console.error('[DB] Unexpected PostgreSQL pool error:', err);
    });
  }
  return pgPool;
};

export const testPostgresConnection = async () => {
  const pool = getPgPool();
  const client = await pool.connect();
  const result = await client.query('SELECT version(), current_database(), current_user');
  console.log(`[DB] PostgreSQL connected: ${result.rows[0].current_database} as ${result.rows[0].current_user}`);
  client.release();
  return true;
};

export const closePool = async () => {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    console.log('[DB] PostgreSQL pool closed');
  }
};

export const pool = {
  get query() { return getPgPool().query.bind(getPgPool()); },
  get connect() { return getPgPool().connect.bind(getPgPool()); }
};
