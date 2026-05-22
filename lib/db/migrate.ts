import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../env";

async function main() {
  const sql = neon(getDatabaseUrl());
  const db = drizzle(sql);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations complete");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
