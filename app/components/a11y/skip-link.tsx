import { MAIN_CONTENT_ID } from "@/lib/a11y";

export function SkipLink() {
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className="skip-link">
      Skip to main content
    </a>
  );
}
