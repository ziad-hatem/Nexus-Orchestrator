"use client";

import { startTransition, useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import type { OrgRealtimeChannel } from "@/lib/server/realtime/service";

type RealtimePayload = {
  type: "connected" | "refresh" | "ping";
  channel: OrgRealtimeChannel;
  version: string;
  at: string;
};

function parseRealtimePayload(value: string): RealtimePayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<RealtimePayload>;
    if (
      (parsed.type === "connected" ||
        parsed.type === "refresh" ||
        parsed.type === "ping") &&
      typeof parsed.channel === "string" &&
      typeof parsed.version === "string" &&
      typeof parsed.at === "string"
    ) {
      return parsed as RealtimePayload;
    }
  } catch {
    return null;
  }

  return null;
}

export function OrgRealtimeRefresh({
  orgSlug,
  channel,
}: {
  orgSlug: string;
  channel: OrgRealtimeChannel;
}) {
  const router = useRouter();
  const versionRef = useRef<string | null>(null);

  const handleRealtimeMessage = useEffectEvent((event: MessageEvent<string>) => {
    const payload = parseRealtimePayload(event.data);
    if (!payload) {
      return;
    }

    if (payload.type === "connected" || payload.type === "ping") {
      versionRef.current = payload.version;
      return;
    }

    if (payload.version === versionRef.current) {
      return;
    }

    versionRef.current = payload.version;
    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/orgs/${orgSlug}/realtime?channel=${channel}`,
    );

    const listener = (event: Event) => {
      handleRealtimeMessage(event as MessageEvent<string>);
    };

    eventSource.addEventListener("connected", listener);
    eventSource.addEventListener("refresh", listener);
    eventSource.addEventListener("ping", listener);

    return () => {
      eventSource.removeEventListener("connected", listener);
      eventSource.removeEventListener("refresh", listener);
      eventSource.removeEventListener("ping", listener);
      eventSource.close();
    };
  }, [channel, handleRealtimeMessage, orgSlug]);

  return null;
}
