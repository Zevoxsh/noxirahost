#!/usr/bin/env node
/**
 * NebulaHosting - Database initialization
 * Runs all SQL migrations in order
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'nebula_hosting',
  user: process.env.DB_USER || 'nebula',
  password: process.env.DB_PASSWORD || '',
  connectionTimeoutMillis: 10000
});

const migrationsDir = join(__dirname, '..', 'migrations');

async function runMigrations() {
  console.log('[DB] Running migrations...');

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT id FROM _migrations WHERE filename = $1',
      [file]
    );

    if (rows.length > 0) {
      console.log(`[DB]   [SKIP] ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    console.log(`[DB]   [OK]   ${file}`);
  }

  console.log('[DB] Migrations complete.');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('[DB] Migration failed:', err.message);
  process.exit(1);
});
