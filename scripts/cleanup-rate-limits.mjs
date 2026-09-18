import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  try {
    const result = await pool.query(
      `DELETE FROM "RateLimitEntry" WHERE "windowStart" < now() - interval '24 hours'`
    );
    console.log(`Deleted ${result.rowCount} expired rate limit entries.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Rate limit cleanup failed:", err);
  process.exit(1);
});
