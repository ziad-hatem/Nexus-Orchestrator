"use client";

import { useMemo, useState } from "react";
import { cn } from "@/app/components/ui/utils";

type AvatarProps = {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  textClassName?: string;
  ariaLabel?: string;
};

function initialsForAvatar(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = name?.trim() || email?.split("@")[0] || "U";

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export function Avatar({
  name,
  email,
  imageUrl,
  className,
  fallbackClassName,
  imageClassName,
  textClassName,
  ariaLabel,
}: AvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const resolvedImageUrl = useMemo(
    () => imageUrl?.trim() || null,
    [imageUrl],
  );

  const showImage =
    Boolean(resolvedImageUrl) && failedImageUrl !== resolvedImageUrl;
  const isLoaded = loadedImageUrl === resolvedImageUrl;

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      role={ariaLabel ? "img" : undefined}
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          fallbackClassName,
        )}
      >
        <span className={textClassName}>
          {initialsForAvatar(name, email)}
        </span>
      </div>

      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolvedImageUrl}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
            isLoaded ? "opacity-100" : "opacity-0",
            imageClassName,
          )}
          loading="eager"
          referrerPolicy="no-referrer"
          src={resolvedImageUrl ?? undefined}
          onError={() => {
            setFailedImageUrl(resolvedImageUrl);
            setLoadedImageUrl(null);
          }}
          onLoad={() => {
            setLoadedImageUrl(resolvedImageUrl);
          }}
        />
      ) : null}
    </div>
  );
}
