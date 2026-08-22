"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  animationStyleVars,
  boardTransitionClass,
  itemAnimationClass,
  itemDelayMs,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";
import { cn } from "@/lib/utils";

/** Wraps a display surface with the configured board entrance transition. */
export function AnimatedBoard({
  animations,
  contentKey,
  className,
  style,
  children,
}: {
  animations: DisplayAnimationConfig;
  /** Change to re-trigger board animation (e.g. menu version / hash). */
  contentKey?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const active = animations.enabled;
  return (
    <div
      key={
        animations.animateOnUpdate && contentKey
          ? `board-${contentKey}`
          : "board"
      }
      className={cn(
        boardTransitionClass(animations.boardTransition, active),
        className,
      )}
      style={{
        ...animationStyleVars(animations),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Single staggered item / row entrance. */
export function AnimatedItem({
  animations,
  index,
  className,
  style,
  children,
}: {
  animations: DisplayAnimationConfig;
  index: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const active = animations.enabled;
  const delay = itemDelayMs(index, animations.staggerMs);
  return (
    <div
      className={cn(itemAnimationClass(animations.itemAnimation, active), className)}
      style={{
        ...animationStyleVars(animations),
        ["--dss-item-delay" as string]: `${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
