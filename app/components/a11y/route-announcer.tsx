"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [announcement, setAnnouncement] = useState("");
  const queryString = searchParams.toString();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const title = document.title.trim();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      setAnnouncement(title ? `Navigated to ${title}` : `Navigated to ${url}`);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, queryString]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </p>
  );
}
