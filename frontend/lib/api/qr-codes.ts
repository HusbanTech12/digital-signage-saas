import { apiFetch } from "@/lib/api/client";
import { getApiBaseUrl } from "@/lib/api/config";
import type { MediaAsset, QrCode } from "@/lib/types/schema";

type Token = string;

export type QrCodeListDto = {
  qrCodes: QrCode[];
  total: number;
};

export type QrCodeInput = {
  name: string;
  destinationType: string;
  targetUrl?: string | null;
  menuId?: string | null;
  textPayload?: string | null;
  locationId?: string | null;
  trackingEnabled?: boolean;
  foregroundColor?: string;
  backgroundColor?: string;
  eyeColor?: string | null;
  moduleShape?: string;
  eyeShape?: string;
  errorCorrection?: string;
  quietZone?: number;
  logoMediaAssetId?: string | null;
  logoSizeRatio?: number;
  caption?: string | null;
  sizePx?: number;
};

export type QrCodePatch = Partial<QrCodeInput> & {
  clearLocation?: boolean;
  clearEyeColor?: boolean;
  clearLogo?: boolean;
};

/** Public resolve payload for the /m/<code> menu page. */
export type QrResolveDto = {
  shortCode: string;
  name: string;
  destinationType: string;
  caption: string | null;
  redirectUrl: string | null;
  menu: {
    id: string;
    name: string;
    version: number;
    organizationName: string;
    items: {
      id: string;
      name: string;
      price: number;
      description: string;
      imageUrl: string | null;
      available: boolean;
      category: string;
      sortOrder: number;
    }[];
  } | null;
};

/** Absolute URL for the unauthenticated render endpoints (usable in <img>). */
export function qrRenderUrl(
  path: string,
  params?: { size?: number; v?: string | number },
): string {
  const base = getApiBaseUrl();
  const search = new URLSearchParams();
  if (params?.size) search.set("size", String(params.size));
  if (params?.v !== undefined) search.set("v", String(params.v));
  const qs = search.toString();
  return `${base ?? ""}${path}${qs ? `?${qs}` : ""}`;
}

export function listQrCodesApi(
  token: Token,
  params?: { q?: string; destinationType?: string; locationId?: string },
) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.destinationType) {
    search.set("destination_type", params.destinationType);
  }
  if (params?.locationId) search.set("location_id", params.locationId);
  const qs = search.toString();
  return apiFetch<QrCodeListDto>(`/api/v1/qr-codes${qs ? `?${qs}` : ""}`, {
    token,
  });
}

export type QrPreviewDto = {
  svg: string;
  encodedValue: string;
};

export type QrPreviewInput = Omit<QrCodeInput, "name" | "locationId" | "sizePx">;

export function previewQrCodeApi(token: Token, body: QrPreviewInput) {
  return apiFetch<QrPreviewDto>("/api/v1/qr-codes/preview", {
    method: "POST",
    token,
    body,
  });
}

export function getQrCodeApi(token: Token, qrId: string) {
  return apiFetch<QrCode>(`/api/v1/qr-codes/${qrId}`, { token });
}

export function createQrCodeApi(token: Token, body: QrCodeInput) {
  return apiFetch<QrCode>("/api/v1/qr-codes", {
    method: "POST",
    token,
    body,
  });
}

export function updateQrCodeApi(token: Token, qrId: string, body: QrCodePatch) {
  return apiFetch<QrCode>(`/api/v1/qr-codes/${qrId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export function deleteQrCodeApi(token: Token, qrId: string) {
  return apiFetch<void>(`/api/v1/qr-codes/${qrId}`, {
    method: "DELETE",
    token,
  });
}

export function saveQrCodeToMediaApi(token: Token, qrId: string) {
  return apiFetch<MediaAsset>(`/api/v1/qr-codes/${qrId}/save-to-media`, {
    method: "POST",
    token,
  });
}

/** Public — no auth. `countScan=false` keeps analytics clean for previews. */
export function resolveQrCodeApi(shortCode: string, countScan = true) {
  return apiFetch<QrResolveDto>(
    `/api/v1/public/qr/${shortCode}${countScan ? "" : "?countScan=false"}`,
    { auth: false },
  );
}
