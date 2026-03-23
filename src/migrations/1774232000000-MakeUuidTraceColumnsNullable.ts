import { MigrationInterface, QueryRunner } from 'typeorm';

function parsePgTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return [trimmed];
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];

  return inner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s));
}

export class MakeUuidTraceColumnsNullable1774232000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnsMeta: Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
    }> = await queryRunner.query(`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);

    const columnMetaByTable = new Map<string, Map<string, { data_type: string; udt_name: string }>>();
    for (const col of columnsMeta) {
      if (!columnMetaByTable.has(col.table_name)) {
        columnMetaByTable.set(col.table_name, new Map());
      }
      columnMetaByTable.get(col.table_name)!.set(col.column_name, {
        data_type: col.data_type,
        udt_name: col.udt_name,
      });
    }

    // 1) Fix PKs that were unintentionally left pointing at the old UUID columns
    //    (renamed to *__uuid) when those PKs are actually meant to follow the new INT FK columns.
    const pkConstraints: Array<{
      table_name: string;
      constraint_name: string;
      columns: unknown;
      referencing_fk_count: unknown;
    }> = await queryRunner.query(`
      SELECT
        c.relname AS table_name,
        con.conname AS constraint_name,
        array_agg(att.attname ORDER BY ord.ordinality) AS columns,
        (
          SELECT count(*)
          FROM pg_constraint con2
          WHERE con2.contype = 'f'
            AND con2.confrelid = c.oid
        )::int AS referencing_fk_count
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = ord.attnum
      WHERE con.contype = 'p'
        AND n.nspname = 'public'
      GROUP BY c.relname, con.conname, c.oid;
    `);

    for (const pk of pkConstraints) {
      const pkColumns = parsePgTextArray(pk.columns);
      const referencingFkCount = Number(pk.referencing_fk_count ?? 0);

      const hasUuidTracePkCol = pkColumns.some((c) => c.endsWith('__uuid'));
      if (!hasUuidTracePkCol) continue;

      // Conservative: if other tables reference this table's PK, don't change it here.
      if (referencingFkCount > 0) continue;

      const tableCols = columnMetaByTable.get(pk.table_name);
      if (!tableCols) continue;

      const mappedPkColumns = pkColumns.map((c) => (c.endsWith('__uuid') ? c.slice(0, -'__uuid'.length) : c));

      const canMap = mappedPkColumns.every((c) => {
        const meta = tableCols.get(c);
        if (!meta) return false;
        return meta.data_type === 'integer' || meta.data_type === 'bigint';
      });
      if (!canMap) continue;

      const pkColumnsSql = mappedPkColumns.map((c) => `\"${c}\"`).join(', ');
      await queryRunner.query(`ALTER TABLE \"${pk.table_name}\" DROP CONSTRAINT \"${pk.constraint_name}\"`);
      await queryRunner.query(`ALTER TABLE \"${pk.table_name}\" ADD PRIMARY KEY (${pkColumnsSql})`);
    }

    // 2) Drop NOT NULL on trace UUID columns that are NOT part of a primary key.
    const pkColumnsNow: Array<{ table_name: string; column_name: string }> = await queryRunner.query(`
      SELECT
        c.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(con.conkey) AS key(attnum) ON true
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = key.attnum
      WHERE con.contype = 'p'
        AND n.nspname = 'public';
    `);
    const pkColumnSet = new Set(pkColumnsNow.map((r) => `${r.table_name}.${r.column_name}`));

    const traceUuidNotNullColumns: Array<{ table_name: string; column_name: string }> = await queryRunner.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name LIKE '%\\_\\_uuid' ESCAPE '\\'
        AND is_nullable = 'NO'
    `);

    for (const { table_name, column_name } of traceUuidNotNullColumns) {
      if (pkColumnSet.has(`${table_name}.${column_name}`)) continue;
      await queryRunner.query(`ALTER TABLE \"${table_name}\" ALTER COLUMN \"${column_name}\" DROP NOT NULL`);
    }
  }

  // Intentionally a no-op. Reverting this safely would require
  // verifying every __uuid column has no NULLs before setting NOT NULL.
  public async down(_queryRunner: QueryRunner): Promise<void> {
    return;
  }
}
