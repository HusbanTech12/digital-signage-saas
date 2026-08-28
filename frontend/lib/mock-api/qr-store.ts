/**
 * In-memory QR codes for mock / offline dashboard mode.
 *
 * The QR image itself is always rendered by the API (single encoder, so the
 * preview and the downloaded file can never drift). In mock mode the render
 * URLs therefore resolve to nothing and the UI shows a placeholder instead.
 */

import type { QrCode } from "@/lib/types/schema";
import type { QrCodeInput, QrCodePatch } from "@/lib/api/qr-codes";

type Listener = () => void;

const listeners = new Set<Listener>();

const SHORT_CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

let qrCodes: QrCode[] = [
  {
    id: "qr_demo_menu",
    organizationId: "org_demo_001",
    locationId: null,
    name: "Table tent — full menu",
    shortCode: "m7k4qp2xrt",
    destinationType: "menu",
    targetUrl: null,
    menuId: "menu_demo_lunch",
    menuName: "Lunch menu",
    textPayload: null,
    trackingEnabled: false,
    foregroundColor: "#0c0c0e",
    backgroundColor: "#ffffff",
    eyeColor: "#c4a574",
    moduleShape: "rounded",
    eyeShape: "circle",
    errorCorrection: "Q",
    quietZone: 4,
    logoMediaAssetId: null,
    logoUrl: null,
    logoSizeRatio: 0.22,
    caption: "SCAN FOR MENU",
    sizePx: 512,
    scanCount: 42,
    lastScannedAt: "2026-08-27T18:20:00.000Z",
    createdByUserId: "user_super",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    encodedValue: "http://localhost:3000/m/m7k4qp2xrt",
    publicUrl: "http://localhost:3000/m/m7k4qp2xrt",
    renderSvgUrl: "/api/v1/public/qr/m7k4qp2xrt/render.svg",
    renderPngUrl: "/api/v1/public/qr/m7k4qp2xrt/render.png",
  },
];

function emit() {
  for (const l of listeners) l();
}

function nowIso() {
  return new Date().toISOString();
}

function randomShortCode() {
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += SHORT_CODE_ALPHABET[
      Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)
    ];
  }
  return out;
}

function normalizeTargetUrl(raw?: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes("://")) {
    throw new Error("Destination URL must be http or https");
  }
  return `https://${value}`;
}

function assertDestination(qr: {
  destinationType: string;
  targetUrl: string | null;
  menuId: string | null;
  textPayload: string | null;
}) {
  const redirectTypes = ["url", "promotion", "ordering"];
  if (redirectTypes.includes(qr.destinationType) && !qr.targetUrl) {
    throw new Error("A destination URL is required for this QR type");
  }
  if (qr.destinationType === "menu" && !qr.menuId) {
    throw new Error("Select a menu for a menu QR code");
  }
  if (qr.destinationType === "text" && !qr.textPayload?.trim()) {
    throw new Error("Enter the text this QR code should carry");
  }
}

function derive(qr: QrCode): QrCode {
  const redirectTypes = ["url", "promotion", "ordering"];
  const encodedValue =
    qr.destinationType === "text"
      ? (qr.textPayload ?? "").trim()
      : qr.destinationType === "menu"
        ? `http://localhost:3000/m/${qr.shortCode}`
        : qr.trackingEnabled
          ? `http://localhost:8000/q/${qr.shortCode}`
          : (qr.targetUrl ?? "");
  return {
    ...qr,
    trackingEnabled:
      qr.trackingEnabled && redirectTypes.includes(qr.destinationType),
    encodedValue,
    publicUrl: qr.destinationType === "text" ? null : encodedValue || null,
    renderSvgUrl: `/api/v1/public/qr/${qr.shortCode}/render.svg`,
    renderPngUrl: `/api/v1/public/qr/${qr.shortCode}/render.png`,
  };
}

export function subscribeQrStore(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listQrCodesMock(params?: {
  q?: string;
  destinationType?: string;
  locationId?: string;
}) {
  let list = qrCodes.map((qr) => ({ ...qr }));
  const q = params?.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (qr) =>
        qr.name.toLowerCase().includes(q) ||
        qr.shortCode.includes(q) ||
        (qr.targetUrl ?? "").toLowerCase().includes(q),
    );
  }
  if (params?.destinationType) {
    list = list.filter((qr) => qr.destinationType === params.destinationType);
  }
  if (params?.locationId === "__unassigned__") {
    list = list.filter((qr) => qr.locationId === null);
  } else if (params?.locationId) {
    list = list.filter((qr) => qr.locationId === params.locationId);
  }
  return { qrCodes: list, total: list.length };
}

export function getQrCodeMock(qrId: string): QrCode {
  const found = qrCodes.find((qr) => qr.id === qrId);
  if (!found) throw new Error("QR code not found");
  return { ...found };
}

export function createQrCodeMock(
  input: QrCodeInput & { organizationId: string; createdByUserId: string },
): QrCode {
  const targetUrl = normalizeTargetUrl(input.targetUrl);
  const draft: QrCode = derive({
    id: `qr_${Math.random().toString(36).slice(2, 10)}`,
    organizationId: input.organizationId,
    locationId: input.locationId ?? null,
    name: input.name.trim(),
    shortCode: randomShortCode(),
    destinationType: input.destinationType,
    targetUrl,
    menuId: input.menuId ?? null,
    menuName: null,
    textPayload: input.textPayload?.trim() || null,
    trackingEnabled: input.trackingEnabled ?? true,
    foregroundColor: input.foregroundColor ?? "#000000",
    backgroundColor: input.backgroundColor ?? "#ffffff",
    eyeColor: input.eyeColor ?? null,
    moduleShape: input.moduleShape ?? "square",
    eyeShape: input.eyeShape ?? "square",
    errorCorrection: input.errorCorrection ?? "M",
    quietZone: input.quietZone ?? 4,
    logoMediaAssetId: input.logoMediaAssetId ?? null,
    logoUrl: null,
    logoSizeRatio: input.logoSizeRatio ?? 0.22,
    caption: input.caption?.trim() || null,
    sizePx: input.sizePx ?? 512,
    scanCount: 0,
    lastScannedAt: null,
    createdByUserId: input.createdByUserId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    encodedValue: "",
    publicUrl: null,
    renderSvgUrl: "",
    renderPngUrl: "",
  });
  assertDestination(draft);
  qrCodes = [draft, ...qrCodes];
  emit();
  return { ...draft };
}

export function updateQrCodeMock(qrId: string, patch: QrCodePatch): QrCode {
  const index = qrCodes.findIndex((qr) => qr.id === qrId);
  if (index === -1) throw new Error("QR code not found");
  const current = qrCodes[index];
  const next: QrCode = { ...current };

  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.destinationType !== undefined) {
    next.destinationType = patch.destinationType;
  }
  if (patch.targetUrl !== undefined) {
    next.targetUrl = normalizeTargetUrl(patch.targetUrl);
  }
  if (patch.menuId !== undefined) next.menuId = patch.menuId ?? null;
  if (patch.textPayload !== undefined) {
    next.textPayload = patch.textPayload?.trim() || null;
  }
  if (patch.clearLocation) next.locationId = null;
  else if (patch.locationId !== undefined) {
    next.locationId = patch.locationId ?? null;
  }
  if (patch.trackingEnabled !== undefined) {
    next.trackingEnabled = patch.trackingEnabled;
  }
  if (patch.foregroundColor !== undefined) {
    next.foregroundColor = patch.foregroundColor;
  }
  if (patch.backgroundColor !== undefined) {
    next.backgroundColor = patch.backgroundColor;
  }
  if (patch.clearEyeColor) next.eyeColor = null;
  else if (patch.eyeColor !== undefined) next.eyeColor = patch.eyeColor ?? null;
  if (patch.moduleShape !== undefined) next.moduleShape = patch.moduleShape;
  if (patch.eyeShape !== undefined) next.eyeShape = patch.eyeShape;
  if (patch.errorCorrection !== undefined) {
    next.errorCorrection = patch.errorCorrection;
  }
  if (patch.quietZone !== undefined) next.quietZone = patch.quietZone;
  if (patch.clearLogo) {
    next.logoMediaAssetId = null;
    next.logoUrl = null;
  } else if (patch.logoMediaAssetId !== undefined) {
    next.logoMediaAssetId = patch.logoMediaAssetId ?? null;
  }
  if (patch.logoSizeRatio !== undefined) {
    next.logoSizeRatio = patch.logoSizeRatio;
  }
  if (patch.caption !== undefined) next.caption = patch.caption?.trim() || null;
  if (patch.sizePx !== undefined) next.sizePx = patch.sizePx;
  next.updatedAt = nowIso();

  const derived = derive(next);
  assertDestination(derived);
  qrCodes = [
    ...qrCodes.slice(0, index),
    derived,
    ...qrCodes.slice(index + 1),
  ];
  emit();
  return { ...derived };
}

export function deleteQrCodeMock(qrId: string) {
  if (!qrCodes.some((qr) => qr.id === qrId)) {
    throw new Error("QR code not found");
  }
  qrCodes = qrCodes.filter((qr) => qr.id !== qrId);
  emit();
}
