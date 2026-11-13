/**
 * One-shot: set due_at=now for every glider_progress row whose last_result is Easy.
 * Default scope = all users. Pass --user-key g:… to limit to one learner.
 *
 * Requires DATABASE_URL (Postgres). Dry-run with --dry-run.
 *
 *   DATABASE_URL=… node scripts/reset-easy-to-due.mjs
 *   DATABASE_URL=… node scripts/reset-easy-to-due.mjs --user-key g:123
 *   DATABASE_URL=… node scripts/reset-easy-to-due.mjs --dry-run
 */
import pg from 'pg';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userKeyIdx = args.indexOf('--user-key');
const userKey =
  userKeyIdx >= 0 && args[userKeyIdx + 1] ? String(args[userKeyIdx + 1]).trim() : null;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    const countParams = [];
    let where = `lower(coalesce(last_result, '')) = 'easy'`;
    if (userKey) {
      countParams.push(userKey);
      where += ` AND user_key = $1`;
    }
    const { rows: countRows } = await pool.query(
      `SELECT count(*)::int AS n FROM glider_progress WHERE ${where}`,
      countParams
    );
    const n = countRows[0]?.n || 0;
    console.log(
      `[reset-easy-to-due] scope=${userKey || 'all_users'} matching_easy_rows=${n} dry_run=${dryRun}`
    );
    if (dryRun || n === 0) {
      return;
    }
    const params = [];
    let userFilter = '';
    if (userKey) {
      params.push(userKey);
      userFilter = ` AND user_key = $1`;
    }
    const { rows } = await pool.query(
      `UPDATE glider_progress
       SET due_at = NOW(),
           interval_days = 0
       WHERE lower(coalesce(last_result, '')) = 'easy'${userFilter}
       RETURNING user_key, card_id, last_result, due_at`,
      params
    );
    console.log(`[reset-easy-to-due] updated=${rows.length}`);
    for (const row of rows.slice(0, 20)) {
      console.log(`  ${row.user_key} ${row.card_id} ${row.last_result} → ${row.due_at?.toISOString?.() || row.due_at}`);
    }
    if (rows.length > 20) console.log(`  … ${rows.length - 20} more`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
