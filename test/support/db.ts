import { Pool } from 'pg';
import { assertSafeTestDatabase, dbConfig } from './env';

let pool: Pool | undefined;

/** Faqat test bazasiga ulanadi (har safar xavfsizlik tekshiriladi). */
export function getPool(): Pool {
  assertSafeTestDatabase();
  pool ??= new Pool({ ...dbConfig(), max: 3 });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Migratsiya jadvallaridan tashqari barcha jadvallarning nomlari. */
export async function listAppTables(): Promise<string[]> {
  const { rows } = await getPool().query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT ILIKE '%migration%'
      ORDER BY tablename`,
  );
  return rows.map((r) => r.tablename);
}

/**
 * Har bir testdan oldin barcha ma'lumotlarni o'chiradi (schema saqlanadi).
 * Jadval nomlari talabaning sxemasiga bog'liq emas - dinamik aniqlanadi.
 */
export async function truncateAll(): Promise<void> {
  const tables = await listAppTables();
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t}"`).join(', ');
  await getPool().query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Barcha ilova jadvallaridagi qatorlarni JSON ko'rinishida qaytaradi (sxemadan mustaqil tekshiruvlar uchun). */
export async function dumpAllTables(): Promise<Record<string, Record<string, unknown>[]>> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const table of await listAppTables()) {
    const { rows } = await getPool().query(`SELECT to_jsonb(t) AS row FROM "${table}" t`);
    result[table] = rows.map((r) => r.row);
  }
  return result;
}

export async function countRows(table: string): Promise<number> {
  const { rows } = await getPool().query(`SELECT count(*)::int AS n FROM "${table}"`);
  return rows[0].n;
}

export async function schemaFacts() {
  const pg = getPool();
  const tables = await listAppTables();
  const fks = await pg.query(
    `SELECT tc.table_name, kcu.column_name, rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
  );
  const uniques = await pg.query(
    `SELECT t.relname AS table_name, i.relname AS index_name, pg_get_indexdef(ix.indexrelid) AS def
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND ix.indisunique AND NOT ix.indisprimary`,
  );
  const migrations = await pg.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE '%migration%'`,
  );
  return {
    tables,
    foreignKeys: fks.rows as { table_name: string; column_name: string; delete_rule: string }[],
    uniqueIndexes: uniques.rows as { table_name: string; index_name: string; def: string }[],
    migrationTables: migrations.rows.map((r) => r.tablename as string),
  };
}

export async function columnFacts() {
  const pg = getPool();
  const cols = await pg.query(
    `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name NOT ILIKE '%migration%'`,
  );
  const pks = await pg.query(
    `SELECT tc.table_name, kcu.column_name, c.data_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.columns c
         ON c.table_schema = tc.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name NOT ILIKE '%migration%'`,
  );
  return {
    columns: cols.rows as { table_name: string; column_name: string; data_type: string; is_nullable: string }[],
    primaryKeys: pks.rows as { table_name: string; column_name: string; data_type: string }[],
  };
}
