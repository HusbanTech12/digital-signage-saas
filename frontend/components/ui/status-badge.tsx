import { cn } from "@/lib/utils";
import type { ScreenStatus } from "@/lib/types/schema";

const STYLES: Record<ScreenStatus, string> = {
  online: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  offline: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  pairing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function StatusBadge({ status }: { status: ScreenStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status],
      )}
    >
      {status}
    </span>
  );
}
