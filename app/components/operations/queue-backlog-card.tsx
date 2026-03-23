import type { OperationsQueueSnapshot } from "@/lib/server/operations/types";

export function QueueBacklogCard({
  queue,
}: {
  queue: OperationsQueueSnapshot;
}) {
  return (
    <section className="glass-panel rounded-[1.75rem] p-6">
      <p className="label-caps">Queue backlog</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
        Worker pressure
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
          <p className="label-caps">Ready</p>
          <p className="mt-2 text-2xl font-bold text-[var(--on-surface)]">
            {queue.readyBacklog}
          </p>
        </div>
        <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
          <p className="label-caps">Delayed</p>
          <p className="mt-2 text-2xl font-bold text-[var(--on-surface)]">
            {queue.delayedBacklog}
          </p>
        </div>
        <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
          <p className="label-caps">Stale runs</p>
          <p className="mt-2 text-2xl font-bold text-[var(--on-surface)]">
            {queue.staleRunningCount}
          </p>
        </div>
        <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
          <p className="label-caps">Retry backlog</p>
          <p className="mt-2 text-2xl font-bold text-[var(--on-surface)]">
            {queue.retryBacklogCount}
          </p>
        </div>
      </div>
    </section>
  );
}
