"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaPicker } from "@/components/media/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { resolveMediaUrl } from "@/lib/api/media";
import { useLiveApi } from "@/lib/api/config";
import { previewQrCode } from "@/lib/data/qr-codes";
import type { QrCodeInput, QrPreviewInput } from "@/lib/api/qr-codes";
import type {
  Location,
  Menu,
  MediaAsset,
  QrCode,
  QrDestinationType,
} from "@/lib/types/schema";

const DESTINATIONS: { id: QrDestinationType; label: string; hint: string }[] = [
  {
    id: "menu",
    label: "Menu",
    hint: "Opens a mobile-friendly view of one of your menus.",
  },
  {
    id: "ordering",
    label: "Online ordering",
    hint: "Sends guests straight to your ordering page.",
  },
  {
    id: "promotion",
    label: "Promotion",
    hint: "Links a printed or on-screen promo to a landing page.",
  },
  { id: "url", label: "Custom URL", hint: "Any web address you control." },
  {
    id: "text",
    label: "Plain text",
    hint: "Carries text only — no link, no scan tracking.",
  },
];

const MODULE_SHAPES = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dot", label: "Dots" },
];

const EYE_SHAPES = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
];

const ERROR_CORRECTIONS = [
  { id: "L", label: "L — smallest (7% recovery)" },
  { id: "M", label: "M — balanced (15%)" },
  { id: "Q", label: "Q — resilient (25%)" },
  { id: "H", label: "H — best with a logo (30%)" },
];

const REDIRECT_TYPES: string[] = ["url", "promotion", "ordering"];

export type QrDraft = QrCodeInput & {
  clearLocation?: boolean;
  clearEyeColor?: boolean;
  clearLogo?: boolean;
};

export type QrFormState = {
  name: string;
  destinationType: QrDestinationType;
  targetUrl: string;
  menuId: string;
  textPayload: string;
  locationId: string;
  trackingEnabled: boolean;
  foregroundColor: string;
  backgroundColor: string;
  eyeColor: string;
  useEyeColor: boolean;
  moduleShape: string;
  eyeShape: string;
  errorCorrection: string;
  quietZone: number;
  logoMediaAssetId: string | null;
  logoPreviewUrl: string | null;
  logoSizeRatio: number;
  caption: string;
  sizePx: number;
};

export function emptyQrForm(defaults?: Partial<QrFormState>): QrFormState {
  return {
    name: "",
    destinationType: "menu",
    targetUrl: "",
    menuId: "",
    textPayload: "",
    locationId: "",
    trackingEnabled: true,
    foregroundColor: "#0c0c0e",
    backgroundColor: "#ffffff",
    eyeColor: "#c4a574",
    useEyeColor: false,
    moduleShape: "square",
    eyeShape: "square",
    errorCorrection: "M",
    quietZone: 4,
    logoMediaAssetId: null,
    logoPreviewUrl: null,
    logoSizeRatio: 0.22,
    caption: "",
    sizePx: 512,
    ...defaults,
  };
}

export function qrToForm(qr: QrCode): QrFormState {
  return emptyQrForm({
    name: qr.name,
    destinationType: qr.destinationType as QrDestinationType,
    targetUrl: qr.targetUrl ?? "",
    menuId: qr.menuId ?? "",
    textPayload: qr.textPayload ?? "",
    locationId: qr.locationId ?? "",
    trackingEnabled: qr.trackingEnabled,
    foregroundColor: qr.foregroundColor,
    backgroundColor: qr.backgroundColor,
    eyeColor: qr.eyeColor ?? "#c4a574",
    useEyeColor: Boolean(qr.eyeColor),
    moduleShape: qr.moduleShape,
    eyeShape: qr.eyeShape,
    errorCorrection: qr.errorCorrection,
    quietZone: qr.quietZone,
    logoMediaAssetId: qr.logoMediaAssetId,
    logoPreviewUrl: qr.logoUrl,
    logoSizeRatio: qr.logoSizeRatio,
    caption: qr.caption ?? "",
    sizePx: qr.sizePx,
  });
}

/** Payload for create; `formToPatch` adds the explicit clear flags for edits. */
export function formToInput(form: QrFormState): QrCodeInput {
  return {
    name: form.name.trim(),
    destinationType: form.destinationType,
    targetUrl: REDIRECT_TYPES.includes(form.destinationType)
      ? form.targetUrl.trim() || null
      : null,
    menuId: form.destinationType === "menu" ? form.menuId || null : null,
    textPayload:
      form.destinationType === "text" ? form.textPayload.trim() || null : null,
    locationId: form.locationId || null,
    trackingEnabled: form.trackingEnabled,
    foregroundColor: form.foregroundColor,
    backgroundColor: form.backgroundColor,
    eyeColor: form.useEyeColor ? form.eyeColor : null,
    moduleShape: form.moduleShape,
    eyeShape: form.eyeShape,
    errorCorrection: form.errorCorrection,
    quietZone: form.quietZone,
    logoMediaAssetId: form.logoMediaAssetId,
    logoSizeRatio: form.logoSizeRatio,
    caption: form.caption.trim() || null,
    sizePx: form.sizePx,
  };
}

export function formToPatch(form: QrFormState): QrDraft {
  const input = formToInput(form);
  return {
    ...input,
    clearLocation: !form.locationId,
    clearEyeColor: !form.useEyeColor,
    clearLogo: !form.logoMediaAssetId,
  };
}

function ColorField({
  label,
  value,
  onChange,
  allowTransparent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}) {
  const transparent = value === "transparent";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={transparent ? "#ffffff" : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
      {allowTransparent ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => onChange(e.target.checked ? "transparent" : "#ffffff")}
          />
          Transparent
        </label>
      ) : null}
    </div>
  );
}

/**
 * Create / edit form with a live preview rendered by the API, so the preview
 * and the downloadable export come from the same encoder.
 */
export function QrCodeEditor({
  form,
  onChange,
  menus,
  locations,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: QrFormState;
  onChange: (next: QrFormState) => void;
  menus: Menu[];
  locations: Location[];
  saving?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const { getApiToken } = useApiAuthToken();
  const live = useLiveApi();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewValue, setPreviewValue] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const patch = useCallback(
    (next: Partial<QrFormState>) => onChange({ ...form, ...next }),
    [form, onChange],
  );

  const destination = DESTINATIONS.find((d) => d.id === form.destinationType);
  const isRedirect = REDIRECT_TYPES.includes(form.destinationType);

  // Only the fields that change the rendered image, so editing the name or
  // location does not re-request a preview.
  const previewInput = useMemo<QrPreviewInput>(
    () => ({
      destinationType: form.destinationType,
      targetUrl: form.targetUrl.trim() || null,
      menuId: form.menuId || null,
      textPayload: form.textPayload.trim() || null,
      trackingEnabled: form.trackingEnabled,
      foregroundColor: form.foregroundColor,
      backgroundColor: form.backgroundColor,
      eyeColor: form.useEyeColor ? form.eyeColor : null,
      moduleShape: form.moduleShape,
      eyeShape: form.eyeShape,
      errorCorrection: form.errorCorrection,
      quietZone: form.quietZone,
      logoMediaAssetId: form.logoMediaAssetId,
      logoSizeRatio: form.logoSizeRatio,
      caption: form.caption.trim() || null,
    }),
    [
      form.destinationType,
      form.targetUrl,
      form.menuId,
      form.textPayload,
      form.trackingEnabled,
      form.foregroundColor,
      form.backgroundColor,
      form.eyeColor,
      form.useEyeColor,
      form.moduleShape,
      form.eyeShape,
      form.errorCorrection,
      form.quietZone,
      form.logoMediaAssetId,
      form.logoSizeRatio,
      form.caption,
    ],
  );

  // Debounced so typing a URL does not fire a request per keystroke.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewing(true);
        try {
          const token = await getApiToken();
          const result = await previewQrCode(token, previewInput);
          if (cancelled || !result) return;
          setPreviewSvg(result.svg);
          setPreviewValue(result.encodedValue);
          setPreviewError(null);
        } catch (err) {
          if (cancelled) return;
          setPreviewSvg(null);
          setPreviewError(
            err instanceof Error ? err.message : "Preview unavailable",
          );
        } finally {
          if (!cancelled) setPreviewing(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [getApiToken, live, previewInput]);

  const previewSrc = previewSvg
    ? `data:image/svg+xml,${encodeURIComponent(previewSvg)}`
    : null;

  return (
    <form
      className="grid gap-6 rounded-xl border border-border p-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="qr-name">Name</Label>
          <Input
            id="qr-name"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Table tent — full menu"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qr-destination">Destination</Label>
          <select
            id="qr-destination"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.destinationType}
            onChange={(e) =>
              patch({ destinationType: e.target.value as QrDestinationType })
            }
          >
            {DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          {destination ? (
            <p className="text-xs text-muted-foreground">{destination.hint}</p>
          ) : null}
        </div>

        {form.destinationType === "menu" ? (
          <div className="space-y-1.5">
            <Label htmlFor="qr-menu">Menu</Label>
            <select
              id="qr-menu"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.menuId}
              onChange={(e) => patch({ menuId: e.target.value })}
              required
            >
              <option value="">Select a menu…</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {isRedirect ? (
          <div className="space-y-1.5">
            <Label htmlFor="qr-url">Destination URL</Label>
            <Input
              id="qr-url"
              value={form.targetUrl}
              onChange={(e) => patch({ targetUrl: e.target.value })}
              placeholder="order.yourvenue.com"
              required
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.trackingEnabled}
                onChange={(e) => patch({ trackingEnabled: e.target.checked })}
              />
              Count scans (routes guests through a short link first)
            </label>
          </div>
        ) : null}

        {form.destinationType === "text" ? (
          <div className="space-y-1.5">
            <Label htmlFor="qr-text">Text</Label>
            <textarea
              id="qr-text"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.textPayload}
              onChange={(e) => patch({ textPayload: e.target.value })}
              placeholder="Table 4 — ask your server about today's special"
              required
            />
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="qr-location">Location (optional)</Label>
            <select
              id="qr-location"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.locationId}
              onChange={(e) => patch({ locationId: e.target.value })}
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-caption">Caption under the code</Label>
            <Input
              id="qr-caption"
              value={form.caption}
              onChange={(e) => patch({ caption: e.target.value })}
              placeholder="SCAN FOR MENU"
              maxLength={120}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <h3 className="text-sm font-semibold">Styling</h3>
            <p className="text-xs text-muted-foreground">
              Keep strong contrast between foreground and background, and raise
              error correction when you add a logo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ColorField
              label="Foreground"
              value={form.foregroundColor}
              onChange={(v) => patch({ foregroundColor: v })}
            />
            <ColorField
              label="Background"
              value={form.backgroundColor}
              onChange={(v) => patch({ backgroundColor: v })}
              allowTransparent
            />
            <div className="space-y-1.5">
              <ColorField
                label="Corner accent"
                value={form.eyeColor}
                onChange={(v) => patch({ eyeColor: v, useEyeColor: true })}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.useEyeColor}
                  onChange={(e) => patch({ useEyeColor: e.target.checked })}
                />
                Use accent for corners
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-module-shape">Module shape</Label>
              <select
                id="qr-module-shape"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.moduleShape}
                onChange={(e) => patch({ moduleShape: e.target.value })}
              >
                {MODULE_SHAPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-eye-shape">Corner shape</Label>
              <select
                id="qr-eye-shape"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.eyeShape}
                onChange={(e) => patch({ eyeShape: e.target.value })}
              >
                {EYE_SHAPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-ec">Error correction</Label>
              <select
                id="qr-ec"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.errorCorrection}
                onChange={(e) => patch({ errorCorrection: e.target.value })}
              >
                {ERROR_CORRECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qr-quiet">Quiet zone ({form.quietZone})</Label>
              <input
                id="qr-quiet"
                type="range"
                min={0}
                max={8}
                step={1}
                className="w-full"
                value={form.quietZone}
                onChange={(e) => patch({ quietZone: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-size">PNG export size ({form.sizePx}px)</Label>
              <input
                id="qr-size"
                type="range"
                min={128}
                max={2048}
                step={64}
                className="w-full"
                value={form.sizePx}
                onChange={(e) => patch({ sizePx: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Center logo (optional)</Label>
            <div className="flex flex-wrap items-center gap-3">
              {form.logoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveMediaUrl(form.logoPreviewUrl)}
                  alt=""
                  className="h-12 w-12 rounded border border-border object-contain"
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                {form.logoMediaAssetId ? "Change logo" : "Choose from Media"}
              </Button>
              {form.logoMediaAssetId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patch({ logoMediaAssetId: null, logoPreviewUrl: null })
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
            {form.logoMediaAssetId ? (
              <div className="space-y-1.5">
                <Label htmlFor="qr-logo-size">
                  Logo size ({Math.round(form.logoSizeRatio * 100)}% of the code)
                </Label>
                <input
                  id="qr-logo-size"
                  type="range"
                  min={10}
                  max={30}
                  step={1}
                  className="w-full max-w-xs"
                  value={Math.round(form.logoSizeRatio * 100)}
                  onChange={(e) =>
                    patch({ logoSizeRatio: Number(e.target.value) / 100 })
                  }
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            Live preview
          </p>
          <div className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#f4f4f5_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="QR code preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="px-3 text-center text-xs text-muted-foreground">
                {!live
                  ? "Connect the API to render QR previews and exports."
                  : previewError
                    ? previewError
                    : previewing
                      ? "Rendering…"
                      : "Fill in a destination to preview."}
              </p>
            )}
          </div>
        </div>
        {previewValue ? (
          <div className="space-y-1">
            <p className="text-xs font-medium">Encodes</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {previewValue}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Always test-scan a printed proof before a large print run.
        </p>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kinds={["logo", "image"]}
        title="Choose a center logo"
        onSelect={(asset: MediaAsset) =>
          patch({ logoMediaAssetId: asset.id, logoPreviewUrl: asset.url })
        }
      />
    </form>
  );
}
