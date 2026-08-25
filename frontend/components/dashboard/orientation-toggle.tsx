"use client";

import {
  ORIENTATIONS,
  orientationHint,
  orientationLabel,
} from "@/lib/display/orientation";
import type { ScreenOrientation } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

/**
 * Landscape / Portrait segmented control. The only screen-shape input in the
 * product — no pixel dimensions are collected anywhere.
 */
export function OrientationToggle({
  value,
  onChange,
  disabled,
  label = "Orientation",
  hint,
  size = "default",
}: {
  value: ScreenOrientation;
  onChange: (next: ScreenOrientation) => void;
  disabled?: boolean;
  /** Pass null to render without a label (e.g. inside a toolbar). */
  label?: string | null;
  hint?: string | null;
  size?: "default" | "sm";
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Screen orientation"
        className="grid grid-cols-2 gap-2"
      >
        {ORIENTATIONS.map((orientation) => {
          const selected = value === orientation;
          return (
            <button
              key={orientation}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(orientation)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:opacity-50",
                size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
                selected
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "shrink-0 rounded-[3px] border-2",
                  selected ? "border-current" : "border-current/60",
                  orientation === "landscape"
                    ? "h-3.5 w-6"
                    : "h-6 w-3.5",
                )}
              />
              {orientationLabel(orientation)}
            </button>
          );
        })}
      </div>
      {hint === null ? null : (
        <p className="text-xs text-muted-foreground">
          {hint ?? orientationHint(value)}
        </p>
      )}
    </div>
  );
}
