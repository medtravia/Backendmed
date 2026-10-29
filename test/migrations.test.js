import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

test("all migrations apply in order and produce UUID primary keys", async () => {
  const database = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  try {
    const migrationsRoot = path.resolve("prisma", "migrations");
    const migrationDirectories = fs.readdirSync(migrationsRoot)
      .filter((entry) => fs.existsSync(path.join(migrationsRoot, entry, "migration.sql")))
      .sort();

    for (const directory of migrationDirectories) {
      const sql = fs.readFileSync(path.join(migrationsRoot, directory, "migration.sql"), "utf8");
      await database.exec(sql);
      if (directory === "20261027115501_add_admin_auth_and_email_notifications") {
        await database.exec(`
          INSERT INTO admins (name, email, password_hash, updated_at)
          VALUES ('Existing Admin', 'existing@example.com', 'hash', CURRENT_TIMESTAMP);
          INSERT INTO treatment_inquiries (
            full_name, country, mobile_number, email, treatment,
            preferred_destination, message, updated_at
          ) VALUES (
            'Existing Patient', 'India', '+91 99999 99999', 'patient@example.com',
            'Cardiology', 'India', 'Existing inquiry', CURRENT_TIMESTAMP
          );
        `);
      }
    }

    const columns = await database.query(`
      SELECT table_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'id'
        AND table_name IN ('admins', 'treatment_inquiries')
      ORDER BY table_name
    `);
    assert.deepEqual(columns.rows, [
      { table_name: "admins", data_type: "uuid" },
      { table_name: "treatment_inquiries", data_type: "uuid" },
    ]);

    const preservedIds = await database.query(`
      SELECT
        (SELECT legacy_id FROM admins WHERE email = 'existing@example.com') AS admin_legacy_id,
        (SELECT legacy_id FROM treatment_inquiries WHERE email = 'patient@example.com') AS inquiry_legacy_id
    `);
    assert.deepEqual(preservedIds.rows[0], { admin_legacy_id: 1, inquiry_legacy_id: 1 });

    const tables = await database.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets'
    `);
    assert.equal(tables.rows.length, 1);
  } finally {
    await database.close();
  }
});
