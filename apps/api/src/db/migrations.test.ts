import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';

describe('database migrations', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it('apply to an empty database, including the trigram extension', async () => {
    const { rows } = await database.client.query<{ extname: string }>(
      "select extname from pg_extension where extname = 'pg_trgm'",
    );
    expect(rows).toEqual([{ extname: 'pg_trgm' }]);
  });

  it('create the indexes for filters, name search and pay history', async () => {
    const { rows } = await database.client.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname = 'public' and indexname like '%_idx'",
    );
    expect(rows.map((row) => row.indexname).sort()).toEqual([
      'change_log_entity_idx',
      'employees_country_code_idx',
      'employees_department_idx',
      'employees_employment_type_idx',
      'employees_full_name_trgm_idx',
      'employees_job_title_idx',
      'employees_status_idx',
      'pay_changes_employee_id_effective_from_idx',
      'pay_items_employee_id_effective_from_idx',
      'pay_items_one_open_item_idx',
    ]);
  });
});
