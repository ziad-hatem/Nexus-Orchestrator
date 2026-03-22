import { startExecutionWorker } from "../lib/server/executions/worker";
import { appLogger } from "../lib/observability/logger";

async function main() {
  const once = process.argv.includes("--once");
  appLogger.info({ once }, "Starting execution worker");
  await startExecutionWorker({ once });
}

main().catch((error: unknown) => {
  appLogger.error(
    {
      err: error instanceof Error ? error.message : String(error),
    },
    "Execution worker exited with an error",
  );
  process.exitCode = 1;
});
