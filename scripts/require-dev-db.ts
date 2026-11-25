// Runs first in `npm run db:migrate` and `npm run db:push` (see db-guard.ts). The npm scripts
// give it the same environment as the command it guards (.env.local for db:migrate, the shell
// for drizzle-kit).
import { assertDisposableDatabase } from "./db-guard";

assertDisposableDatabase().then(
  (checked) => console.log(`Dev database: ${checked.join(", ")}`),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
