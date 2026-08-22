/** Client-side video/image probing (no ffmpeg required). */

export type MediaProbeResult = {
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export function probeMediaFile(file: File): Promise<MediaProbeResult> {
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
    return probeAvFile(file);
  }
  if (file.type.startsWith("image/")) {
    return probeImageFile(file);
  }
  return Promise.resolve({});
}

function probeImageFile(file: File): Promise<MediaProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || undefined,
        height: img.naturalHeight || undefined,
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

function probeAvFile(file: File): Promise<MediaProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(
      file.type.startsWith("audio/") ? "audio" : "video",
    );
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : undefined;
      const width =
        "videoWidth" in el ? (el as HTMLVideoElement).videoWidth : undefined;
      const height =
        "videoHeight" in el ? (el as HTMLVideoElement).videoHeight : undefined;
      resolve({
        width: width || undefined,
        height: height || undefined,
        durationSeconds: duration && duration > 0 ? duration : undefined,
      });
      URL.revokeObjectURL(url);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    el.src = url;
  });
}

/** Capture a JPEG poster frame from a video element at currentTime. */
export function captureVideoPoster(
  video: HTMLVideoElement,
  quality = 0.85,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        resolve(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
}
