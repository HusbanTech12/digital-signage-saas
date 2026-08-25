"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Canvas as FabricCanvas } from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Copy,
  Film,
  LayoutTemplate,
  Lock,
  Maximize2,
  MonitorPlay,
  Music,
  Shapes,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
  Redo2,
  Unlock,
  Upload,
  Utensils,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesignerElementsPanel,
  DesignerMenuItemsPanel,
  DesignerTemplatesPanel,
  DesignerTextPanel,
  DesignerUploadsPanel,
} from "@/components/designer/designer-library";
import {
  addImageFromUrl,
  addMenuItemObject,
  addPriceBox,
  addShape,
  addStyledText,
  alignActiveObject,
  deleteActiveObject,
  duplicateActiveObject,
  loadCanvasFromJson,
  mergeCanvasJson,
  moveActiveLayer,
  saveCanvasToJson,
  setActiveFill,
  setActiveFontSize,
  setActiveLocked,
  setActiveOpacity,
  setCanvasBackground,
  type DesignerCanvasJson,
  type DesignerPoint,
} from "@/lib/designer/canvas-io";
import {
  readDragPayload,
  type DesignerDragPayload,
} from "@/lib/designer/drag-payload";
import { reflowCanvasForOrientation } from "@/lib/designer/reflow";
import { OrientationToggle } from "@/components/dashboard/orientation-toggle";
import { boardSizeFor, orientationLabel } from "@/lib/display/orientation";
import type {
  MenuItem,
  ScreenOrientation,
  Template,
} from "@/lib/types/schema";
import { cn } from "@/lib/utils";

export type VisualEditorPanel =
  | "layouts"
  | "elements"
  | "text"
  | "menu"
  | "uploads"
  | "setup"
  | "audio"
  | "playlist"
  | "target";

export type VisualEditorHandle = {
  getJson: () => DesignerCanvasJson | null;
  isReady: () => boolean;
  openPanel: (panel: VisualEditorPanel) => void;
};

type SelectionInfo = {
  count: number;
  isText: boolean;
  locked: boolean;
  fill: string;
  fontSize: number;
  opacity: number;
};

interface VisualEditorProps {
  initialJson: DesignerCanvasJson;
  templateName: string;
  templateId: string;
  /** Board shape. Changing it reflows the layout and resizes the board. */
  orientation: ScreenOrientation;
  onOrientationChange?: (next: ScreenOrientation) => void;
  menuItems?: MenuItem[];
  templates?: Template[];
  readOnly?: boolean;
  publishing?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onPublish?: () => void;
  /** Publishing-hub panels rendered inside the side rail. */
  hubPanels?: Partial<Record<"setup" | "audio" | "playlist" | "target", React.ReactNode>>;
  headerActions?: React.ReactNode;
}

const RAIL_DESIGN: Array<{
  id: VisualEditorPanel;
  label: string;
  Icon: typeof Shapes;
}> = [
  { id: "layouts", label: "Layouts", Icon: LayoutTemplate },
  { id: "elements", label: "Elements", Icon: Shapes },
  { id: "text", label: "Text", Icon: Type },
  { id: "menu", label: "Menu", Icon: Utensils },
  { id: "uploads", label: "Uploads", Icon: Upload },
];

const RAIL_PUBLISH: Array<{
  id: VisualEditorPanel;
  label: string;
  Icon: typeof Shapes;
}> = [
  { id: "setup", label: "Screen", Icon: SlidersHorizontal },
  { id: "audio", label: "Audio", Icon: Music },
  { id: "playlist", label: "Playlist", Icon: Film },
  { id: "target", label: "Target", Icon: MonitorPlay },
];

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;

/**
 * Canva-style visual editor: icon rail, collapsible library panel, and a
 * zoomable board that accepts drag-and-drop from the panels.
 */
export const VisualEditor = forwardRef<VisualEditorHandle, VisualEditorProps>(
  function VisualEditor(
    {
      initialJson,
      templateName,
      templateId,
      orientation,
      onOrientationChange,
      menuItems = [],
      templates = [],
      readOnly = false,
      publishing = false,
      statusMessage,
      errorMessage,
      onPublish,
      hubPanels,
      headerActions,
    },
    ref,
  ) {
    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const fabricRef = useRef<FabricCanvas | null>(null);
    const workspaceRef = useRef<HTMLDivElement | null>(null);

    const [ready, setReady] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [panel, setPanel] = useState<VisualEditorPanel | null>("elements");
    const [selection, setSelection] = useState<SelectionInfo | null>(null);
    const [dropActive, setDropActive] = useState(false);
    const [zoom, setZoom] = useState(0.6);
    const [autoFit, setAutoFit] = useState(true);
    const [history, setHistory] = useState({ canUndo: false, canRedo: false });
    const [localError, setLocalError] = useState<string | null>(null);
    const [background, setBackground] = useState("#1a1a1a");

    const board = useMemo(() => boardSizeFor(orientation), [orientation]);

    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const autoFitRef = useRef(autoFit);
    autoFitRef.current = autoFit;

    const historyRef = useRef({
      past: [] as string[],
      future: [] as string[],
      current: "",
      suspended: false,
    });

    const applyCssZoom = useCallback(
      (value: number) => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        canvas.setDimensions(
          {
            width: `${Math.round(board.width * value)}px`,
            height: `${Math.round(board.height * value)}px`,
          },
          { cssOnly: true },
        );
      },
      [board.height, board.width],
    );

    const readSelection = useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) {
        setSelection(null);
        return;
      }
      const objects = canvas.getActiveObjects();
      const fill = typeof active.fill === "string" ? active.fill : "#fafafa";
      const fontSize =
        "fontSize" in active && typeof active.fontSize === "number"
          ? active.fontSize
          : 24;
      setSelection({
        count: objects.length,
        isText: "fontSize" in active,
        locked: Boolean(active.lockMovementX),
        fill,
        fontSize,
        opacity: active.opacity ?? 1,
      });
    }, []);

    const commitHistory = useCallback(() => {
      const canvas = fabricRef.current;
      const store = historyRef.current;
      if (!canvas || store.suspended) return;
      const snapshot = JSON.stringify(saveCanvasToJson(canvas));
      if (snapshot === store.current) return;
      if (store.current) store.past.push(store.current);
      if (store.past.length > 40) store.past.shift();
      store.future = [];
      store.current = snapshot;
      setHistory({ canUndo: store.past.length > 0, canRedo: false });
      setDirty(true);
    }, []);

    const applySnapshot = useCallback(
      async (snapshot: string) => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const store = historyRef.current;
        store.suspended = true;
        try {
          await loadCanvasFromJson(
            canvas,
            JSON.parse(snapshot) as DesignerCanvasJson,
          );
          store.current = snapshot;
          applyCssZoom(zoomRef.current);
        } finally {
          store.suspended = false;
        }
        setHistory({
          canUndo: store.past.length > 0,
          canRedo: store.future.length > 0,
        });
        setSelection(null);
        setDirty(true);
      },
      [applyCssZoom],
    );

    const undo = useCallback(() => {
      const store = historyRef.current;
      const previous = store.past.pop();
      if (!previous) return;
      store.future.push(store.current);
      void applySnapshot(previous);
    }, [applySnapshot]);

    const redo = useCallback(() => {
      const store = historyRef.current;
      const next = store.future.pop();
      if (!next) return;
      store.past.push(store.current);
      void applySnapshot(next);
    }, [applySnapshot]);

    useImperativeHandle(ref, () => ({
      getJson: () => {
        const canvas = fabricRef.current;
        return canvas ? saveCanvasToJson(canvas) : null;
      },
      isReady: () => Boolean(fabricRef.current) && ready,
      openPanel: (next) => setPanel(next),
    }));

    useEffect(() => {
      let disposed = false;
      let canvas: FabricCanvas | null = null;

      async function init() {
        if (!canvasElRef.current) return;
        const { Canvas } = await import("fabric");
        if (disposed || !canvasElRef.current) return;

        canvas = new Canvas(canvasElRef.current, {
          width: board.width,
          height: board.height,
          backgroundColor: "#1a1a1a",
          selection: !readOnly,
          preserveObjectStacking: true,
        });
        fabricRef.current = canvas;

        await loadCanvasFromJson(canvas, initialJson);
        if (disposed) {
          canvas.dispose();
          return;
        }
        // A saved board may predate the template's current orientation tag.
        if (
          canvas.getWidth() !== board.width ||
          canvas.getHeight() !== board.height
        ) {
          reflowCanvasForOrientation(canvas, orientation);
        }
        applyCssZoom(zoomRef.current);
        if (typeof canvas.backgroundColor === "string") {
          setBackground(canvas.backgroundColor);
        }

        historyRef.current.current = JSON.stringify(saveCanvasToJson(canvas));
        canvas.on("object:added", commitHistory);
        canvas.on("object:removed", commitHistory);
        canvas.on("object:modified", commitHistory);
        canvas.on("selection:created", readSelection);
        canvas.on("selection:updated", readSelection);
        canvas.on("selection:cleared", () => setSelection(null));

        setReady(true);
        setDirty(false);
      }

      void init();

      return () => {
        disposed = true;
        canvas?.dispose();
        fabricRef.current = null;
      };
      // Board identity is pinned by the parent's `key`; re-init is intentional-only.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fitToWorkspace = useCallback(() => {
      const el = workspaceRef.current;
      if (!el) return;
      const available = {
        width: el.clientWidth - 80,
        height: el.clientHeight - 80,
      };
      if (available.width <= 0 || available.height <= 0) return;
      const scale = Math.min(
        available.width / board.width,
        available.height / board.height,
      );
      const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale));
      setZoom(Number(clamped.toFixed(3)));
    }, [board.height, board.width]);

    useEffect(() => {
      if (!ready) return;
      const el = workspaceRef.current;
      if (!el) return;
      fitToWorkspace();
      const observer = new ResizeObserver(() => {
        if (autoFitRef.current) fitToWorkspace();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, [ready, fitToWorkspace]);

    useEffect(() => {
      if (!ready) return;
      applyCssZoom(zoom);
    }, [zoom, ready, applyCssZoom]);

    const appliedOrientationRef = useRef(orientation);
    useEffect(() => {
      if (!ready) return;
      if (appliedOrientationRef.current === orientation) return;
      appliedOrientationRef.current = orientation;
      const canvas = fabricRef.current;
      if (!canvas) return;
      reflowCanvasForOrientation(canvas, orientation);
      commitHistory();
      applyCssZoom(zoomRef.current);
      if (autoFitRef.current) fitToWorkspace();
      setSelection(null);
    }, [orientation, ready, commitHistory, applyCssZoom, fitToWorkspace]);

    const applyPayload = useCallback(
      async (payload: DesignerDragPayload, point?: DesignerPoint) => {
        const canvas = fabricRef.current;
        if (!canvas || readOnly) return;
        setLocalError(null);
        try {
          switch (payload.kind) {
            case "text":
              await addStyledText(canvas, payload.style, point);
              break;
            case "shape":
              await addShape(canvas, payload.shape, payload.fill, point);
              break;
            case "priceBox":
              await addPriceBox(canvas, point);
              break;
            case "menuItem": {
              const item = menuItems.find((entry) => entry.id === payload.itemId);
              if (item) await addMenuItemObject(canvas, item, point);
              break;
            }
            case "image":
              await addImageFromUrl(canvas, payload.url, point);
              break;
            case "template": {
              const source = templates.find(
                (entry) => entry.id === payload.templateId,
              );
              if (source) {
                await mergeCanvasJson(
                  canvas,
                  source.canvasJson as DesignerCanvasJson,
                );
              }
              break;
            }
          }
        } catch (err) {
          setLocalError(
            err instanceof Error ? err.message : "Could not add that element",
          );
        }
      },
      [menuItems, readOnly, templates],
    );

    const handleDrop = useCallback(
      (event: React.DragEvent) => {
        event.preventDefault();
        setDropActive(false);
        const payload = readDragPayload(event);
        const element = canvasElRef.current;
        if (!payload || !element) return;
        const rect = element.getBoundingClientRect();
        const scale = zoomRef.current || 1;
        const left = Math.max(
          0,
          Math.min(board.width - 20, (event.clientX - rect.left) / scale),
        );
        const top = Math.max(
          0,
          Math.min(board.height - 20, (event.clientY - rect.top) / scale),
        );
        void applyPayload(payload, { left, top });
      },
      [applyPayload, board.height, board.width],
    );

    const quickAdd = useCallback(
      (payload: DesignerDragPayload) => {
        void applyPayload(payload);
      },
      [applyPayload],
    );

    const withCanvas = useCallback((action: (canvas: FabricCanvas) => void) => {
      const canvas = fabricRef.current;
      if (!canvas || readOnly) return;
      action(canvas);
      commitHistory();
      readSelection();
    }, [commitHistory, readOnly, readSelection]);

    useEffect(() => {
      if (readOnly) return;
      function onKeyDown(event: KeyboardEvent) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        const editing = Boolean(
          active && "isEditing" in active && active.isEditing,
        );
        const target = event.target as HTMLElement | null;
        const typing =
          editing ||
          (target &&
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) ||
          target?.isContentEditable;

        if (typing) return;

        const meta = event.ctrlKey || event.metaKey;
        if (meta && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          return;
        }
        if (meta && event.key.toLowerCase() === "d") {
          event.preventDefault();
          void duplicateActiveObject(canvas);
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          if (!active) return;
          event.preventDefault();
          deleteActiveObject(canvas);
        }
      }

      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [readOnly, redo, undo]);

    const panelBody = (() => {
      switch (panel) {
        case "layouts":
          return (
            <DesignerTemplatesPanel
              templates={templates}
              currentTemplateId={templateId}
              onQuickAdd={quickAdd}
            />
          );
        case "elements":
          return <DesignerElementsPanel onQuickAdd={quickAdd} />;
        case "text":
          return <DesignerTextPanel onQuickAdd={quickAdd} />;
        case "menu":
          return (
            <DesignerMenuItemsPanel menuItems={menuItems} onQuickAdd={quickAdd} />
          );
        case "uploads":
          return <DesignerUploadsPanel onQuickAdd={quickAdd} />;
        case "setup":
        case "audio":
        case "playlist":
        case "target":
          return (
            <div className="h-full overflow-y-auto p-3">
              {hubPanels?.[panel] ?? (
                <p className="text-xs text-muted-foreground">
                  Nothing to configure here.
                </p>
              )}
            </div>
          );
        default:
          return null;
      }
    })();

    const message = errorMessage ?? localError;

    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-muted/30">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{templateName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {!ready
                ? "Loading board…"
                : message
                  ? message
                  : (statusMessage ??
                    (dirty ? "Unpublished changes" : "All changes published"))}
            </p>
          </div>

          {onOrientationChange ? (
            <div className="w-[220px] shrink-0">
              <OrientationToggle
                value={orientation}
                onChange={onOrientationChange}
                label={null}
                hint={null}
                size="sm"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Undo"
              disabled={!history.canUndo || readOnly}
              onClick={undo}
            >
              <Undo2 />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Redo"
              disabled={!history.canRedo || readOnly}
              onClick={redo}
            >
              <Redo2 />
            </Button>
          </div>

          {headerActions}

          {onPublish ? (
            <Button disabled={readOnly || !ready || publishing} onClick={onPublish}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Editor tools"
            className="flex w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-background py-2"
          >
            {RAIL_DESIGN.map((entry) => (
              <RailButton
                key={entry.id}
                {...entry}
                active={panel === entry.id}
                onClick={() =>
                  setPanel((prev) => (prev === entry.id ? null : entry.id))
                }
              />
            ))}
            <span className="my-1 h-px w-8 bg-border" aria-hidden />
            {RAIL_PUBLISH.map((entry) => (
              <RailButton
                key={entry.id}
                {...entry}
                active={panel === entry.id}
                onClick={() =>
                  setPanel((prev) => (prev === entry.id ? null : entry.id))
                }
              />
            ))}
          </nav>

          {panel ? (
            <aside className="relative w-[300px] shrink-0 border-r border-border bg-background">
              {panelBody}
              <button
                type="button"
                aria-label="Collapse panel"
                onClick={() => setPanel(null)}
                className="absolute top-1/2 -right-3 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
            </aside>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <SelectionToolbar
              selection={selection}
              background={background}
              disabled={readOnly || !ready}
              onBackground={(color) => {
                setBackground(color);
                withCanvas((canvas) => setCanvasBackground(canvas, color));
              }}
              onFill={(color) =>
                withCanvas((canvas) => setActiveFill(canvas, color))
              }
              onFontSize={(size) =>
                withCanvas((canvas) => setActiveFontSize(canvas, size))
              }
              onOpacity={(value) =>
                withCanvas((canvas) => setActiveOpacity(canvas, value))
              }
              onAlign={(alignment) =>
                withCanvas((canvas) => alignActiveObject(canvas, alignment))
              }
              onLayer={(direction) =>
                withCanvas((canvas) => moveActiveLayer(canvas, direction))
              }
              onLock={(locked) =>
                withCanvas((canvas) => setActiveLocked(canvas, locked))
              }
              onDuplicate={() => {
                const canvas = fabricRef.current;
                if (!canvas || readOnly) return;
                void duplicateActiveObject(canvas);
              }}
              onDelete={() =>
                withCanvas((canvas) => deleteActiveObject(canvas))
              }
            />

            <div
              ref={workspaceRef}
              className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-10"
              onDragOver={(event) => {
                if (readOnly) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setDropActive(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setDropActive(false);
              }}
              onDrop={handleDrop}
            >
              <div className="flex min-h-full items-center justify-center">
                <div
                  className={cn(
                    "shadow-2xl ring-1 ring-black/20 transition",
                    dropActive && "ring-2 ring-primary",
                  )}
                >
                  <canvas ref={canvasElRef} />
                </div>
              </div>
            </div>

            <footer className="flex h-11 shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-3 text-xs text-muted-foreground">
              <span>
                {orientationLabel(orientation)} · fills any screen size
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Zoom out"
                  onClick={() => {
                    setAutoFit(false);
                    setZoom((prev) => Math.max(ZOOM_MIN, prev - 0.1));
                  }}
                >
                  <ZoomOut />
                </Button>
                <input
                  type="range"
                  min={ZOOM_MIN * 100}
                  max={ZOOM_MAX * 100}
                  value={Math.round(zoom * 100)}
                  aria-label="Zoom level"
                  onChange={(event) => {
                    setAutoFit(false);
                    setZoom(Number(event.target.value) / 100);
                  }}
                  className="w-28 accent-primary"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Zoom in"
                  onClick={() => {
                    setAutoFit(false);
                    setZoom((prev) => Math.min(ZOOM_MAX, prev + 0.1));
                  }}
                >
                  <ZoomIn />
                </Button>
                <span className="w-10 text-right tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Fit board to view"
                  onClick={() => {
                    setAutoFit(true);
                    fitToWorkspace();
                  }}
                >
                  <Maximize2 />
                </Button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    );
  },
);

function RailButton({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: typeof Shapes;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function SelectionToolbar({
  selection,
  background,
  disabled,
  onBackground,
  onFill,
  onFontSize,
  onOpacity,
  onAlign,
  onLayer,
  onLock,
  onDuplicate,
  onDelete,
}: {
  selection: SelectionInfo | null;
  background: string;
  disabled: boolean;
  onBackground: (color: string) => void;
  onFill: (color: string) => void;
  onFontSize: (size: number) => void;
  onOpacity: (value: number) => void;
  onAlign: (
    alignment: "left" | "center-h" | "right" | "top" | "center-v" | "bottom",
  ) => void;
  onLayer: (direction: "up" | "down") => void;
  onLock: (locked: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (!selection) {
    return (
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Board background
          <input
            type="color"
            value={background}
            disabled={disabled}
            aria-label="Board background colour"
            onChange={(event) => onBackground(event.target.value)}
            className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
        <span className="text-xs text-muted-foreground">
          Drag an element from the panel onto the board, or select one to edit it.
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3">
      <input
        type="color"
        value={selection.fill.startsWith("#") ? selection.fill : "#fafafa"}
        disabled={disabled}
        aria-label="Fill colour"
        onChange={(event) => onFill(event.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
      />

      {selection.isText ? (
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Size
          <input
            type="number"
            min={8}
            max={200}
            value={selection.fontSize}
            disabled={disabled}
            aria-label="Font size"
            onChange={(event) => onFontSize(Number(event.target.value))}
            className="h-7 w-16 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          />
        </label>
      ) : null}

      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Opacity
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(selection.opacity * 100)}
          disabled={disabled}
          aria-label="Opacity"
          onChange={(event) => onOpacity(Number(event.target.value) / 100)}
          className="w-20 accent-primary"
        />
      </label>

      <span className="h-6 w-px bg-border" aria-hidden />

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Align left"
        disabled={disabled}
        onClick={() => onAlign("left")}
      >
        <AlignLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Align centre"
        disabled={disabled}
        onClick={() => onAlign("center-h")}
      >
        <AlignCenter />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Align right"
        disabled={disabled}
        onClick={() => onAlign("right")}
      >
        <AlignRight />
      </Button>

      <span className="h-6 w-px bg-border" aria-hidden />

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Bring forward"
        disabled={disabled}
        onClick={() => onLayer("up")}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Send backward"
        disabled={disabled}
        onClick={() => onLayer("down")}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={selection.locked ? "Unlock" : "Lock"}
        disabled={disabled}
        onClick={() => onLock(!selection.locked)}
      >
        {selection.locked ? <Lock /> : <Unlock />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Duplicate"
        disabled={disabled}
        onClick={onDuplicate}
      >
        <Copy />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete selection"
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>

      <span className="ml-auto text-xs text-muted-foreground">
        {selection.count} selected
      </span>
    </div>
  );
}
