import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ startExecutionWorker }, { appLogger }] = await Promise.all([
    import("../lib/server/executions/worker"),
    import("../lib/observability/logger"),
  ]);
  const once = process.argv.includes("--once");
  appLogger.info({ once }, "Starting execution worker");
  await startExecutionWorker({ once });
}

main().catch((error: unknown) => {
  void import("../lib/observability/logger")
    .then(({ appLogger }) => {
      appLogger.error(
        {
          err: error instanceof Error ? error.message : String(error),
        },
        "Execution worker exited with an error",
      );
      process.exitCode = 1;
    })
    .catch(() => {
      console.error(
        "Execution worker exited with an error",
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    });
});
