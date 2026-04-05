"use client";

import { cn } from "@/app/components/ui/utils";
import { Avatar as FacehashAvatar, AvatarImage, AvatarFallback } from "facehash";

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
  const seedName = name || email || "default_user";

  return (
    <FacehashAvatar
      aria-label={ariaLabel}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
    >
      <AvatarImage
        src={imageUrl || undefined}
        alt={seedName}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
      <AvatarFallback
        name={seedName}
        className={cn("h-full w-full", fallbackClassName)}
      />
    </FacehashAvatar>
  );
}
