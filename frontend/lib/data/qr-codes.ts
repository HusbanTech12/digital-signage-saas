import {
  createQrCodeApi,
  deleteQrCodeApi,
  getQrCodeApi,
  listQrCodesApi,
  previewQrCodeApi,
  resolveQrCodeApi,
  saveQrCodeToMediaApi,
  updateQrCodeApi,
  type QrCodeInput,
  type QrCodeListDto,
  type QrCodePatch,
  type QrPreviewDto,
  type QrPreviewInput,
  type QrResolveDto,
} from "@/lib/api/qr-codes";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";
import {
  createQrCodeMock,
  deleteQrCodeMock,
  getQrCodeMock,
  listQrCodesMock,
  updateQrCodeMock,
} from "@/lib/mock-api/qr-store";
import type { MediaAsset, QrCode } from "@/lib/types/schema";

type Token = string | null;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listQrCodes(
  token: Token,
  params?: { q?: string; destinationType?: string; locationId?: string },
): Promise<QrCodeListDto> {
  if (!useLiveApi()) return listQrCodesMock(params);
  const t = requireToken(token);
  return withProvisioned(t, () => listQrCodesApi(t, params));
}

export async function getQrCode(token: Token, qrId: string): Promise<QrCode> {
  if (!useLiveApi()) return getQrCodeMock(qrId);
  const t = requireToken(token);
  return withProvisioned(t, () => getQrCodeApi(t, qrId));
}

export async function createQrCode(
  token: Token,
  input: QrCodeInput & { organizationId: string; createdByUserId: string },
): Promise<QrCode> {
  if (!useLiveApi()) return createQrCodeMock(input);
  const t = requireToken(token);
  const { organizationId: _org, createdByUserId: _user, ...body } = input;
  return withProvisioned(t, () => createQrCodeApi(t, body));
}

export async function updateQrCode(
  token: Token,
  qrId: string,
  patch: QrCodePatch,
): Promise<QrCode> {
  if (!useLiveApi()) return updateQrCodeMock(qrId, patch);
  const t = requireToken(token);
  return withProvisioned(t, () => updateQrCodeApi(t, qrId, patch));
}

export async function deleteQrCode(token: Token, qrId: string): Promise<void> {
  if (!useLiveApi()) {
    deleteQrCodeMock(qrId);
    return;
  }
  const t = requireToken(token);
  await withProvisioned(t, () => deleteQrCodeApi(t, qrId));
}

/**
 * Live editor preview. The API is the only QR encoder, so the preview and the
 * exported file can never disagree — mock mode has no preview instead.
 */
export async function previewQrCode(
  token: Token,
  input: QrPreviewInput,
): Promise<QrPreviewDto | null> {
  if (!useLiveApi()) return null;
  const t = requireToken(token);
  return withProvisioned(t, () => previewQrCodeApi(t, input));
}

export async function saveQrCodeToMedia(
  token: Token,
  qrId: string,
): Promise<MediaAsset> {
  if (!useLiveApi()) {
    throw new Error("Saving a QR code to the Media Library requires the live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () => saveQrCodeToMediaApi(t, qrId));
}

/** Public scan resolution — used by the /m/<code> mobile menu page. */
export async function resolveQrCode(
  shortCode: string,
  countScan = true,
): Promise<QrResolveDto> {
  return resolveQrCodeApi(shortCode, countScan);
}
