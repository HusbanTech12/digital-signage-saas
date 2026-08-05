"use client";

import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";

type CanvasObject = {
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  opacity?: number;
  rx?: number;
  ry?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
};

/**
 * Lightweight DOM renderer for Fabric-like canvas JSON.
 * Intentionally avoids loading Fabric.js on the kiosk route.
 */
export function CanvasBoard({
  canvasJson,
  className,
}: {
  canvasJson: DesignerCanvasJson;
  className?: string;
}) {
  const width =
    typeof canvasJson.width === "number" ? canvasJson.width : 1280;
  const height =
    typeof canvasJson.height === "number" ? canvasJson.height : 720;
  const background =
    typeof canvasJson.background === "string" ? canvasJson.background : "#111";
  const objects = Array.isArray(canvasJson.objects)
    ? (canvasJson.objects as CanvasObject[])
    : [];

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${width} / ${height}`,
        background,
        overflow: "hidden",
      }}
    >
      {objects.map((obj, index) => (
        <CanvasObjectView
          key={index}
          obj={obj}
          canvasWidth={width}
          canvasHeight={height}
        />
      ))}
    </div>
  );
}

function CanvasObjectView({
  obj,
  canvasWidth,
  canvasHeight,
}: {
  obj: CanvasObject;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const type = (obj.type ?? "").toLowerCase();
  const leftPct = ((obj.left ?? 0) / canvasWidth) * 100;
  const topPct = ((obj.top ?? 0) / canvasHeight) * 100;
  const widthPct =
    (((obj.width ?? 100) * (obj.scaleX ?? 1)) / canvasWidth) * 100;
  const heightPct =
    (((obj.height ?? 40) * (obj.scaleY ?? 1)) / canvasHeight) * 100;
  // Scale font with viewport width relative to design width
  const fontSizeVw = ((obj.fontSize ?? 18) / canvasWidth) * 100;
  const transform = obj.angle ? `rotate(${obj.angle}deg)` : undefined;

  if (type === "rect") {
    return (
      <div
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          background: obj.fill ?? "#333",
          opacity: obj.opacity ?? 1,
          borderRadius: obj.rx ?? obj.ry ?? 0,
          transform,
        }}
      />
    );
  }

  if (
    type === "textbox" ||
    type === "text" ||
    type === "i-text" ||
    type === "fabrictext"
  ) {
    return (
      <div
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          color: obj.fill ?? "#fff",
          fontSize: `${fontSizeVw}vw`,
          fontFamily: obj.fontFamily ?? "system-ui, sans-serif",
          fontWeight: obj.fontWeight ?? 400,
          opacity: obj.opacity ?? 1,
          whiteSpace: "pre-wrap",
          lineHeight: 1.25,
          transform,
        }}
      >
        {obj.text ?? ""}
      </div>
    );
  }

  return null;
}
