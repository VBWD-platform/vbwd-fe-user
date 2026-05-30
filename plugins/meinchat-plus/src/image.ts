// S28.4 §3 — client-side image processing for e2e attachments.
//
// The server can't resize ciphertext, so the CLIENT produces both the fullres
// (downscaled) and thumb blobs before encrypting. Uses canvas/createImageBitmap
// in the browser; falls back to the raw bytes when those APIs are absent (SSR /
// old browsers) so the flow still works (just un-resized).

const FULLRES_MAX = 2048;
const THUMB_MAX = 256;

export interface ProcessedImage {
  fullres: Uint8Array;
  thumb: Uint8Array;
  width: number;
  height: number;
  mime: string;
}

export type ProcessImage = (file: Blob) => Promise<ProcessedImage>;

async function toBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function downscale(
  bitmap: ImageBitmap,
  maxDim: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = (canvas as OffscreenCanvas).getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob =
    canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
      : await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
            'image/webp',
            0.85,
          ),
        );
  return { bytes: await toBytes(blob), width, height };
}

/** Default browser image processor (webp fullres + thumb). */
export const processImage: ProcessImage = async (file: Blob) => {
  if (typeof createImageBitmap !== 'function') {
    // SSR / unsupported — ship the original bytes for both kinds.
    const raw = await toBytes(file);
    return { fullres: raw, thumb: raw, width: 0, height: 0, mime: file.type || 'application/octet-stream' };
  }
  const bitmap = await createImageBitmap(file);
  try {
    const full = await downscale(bitmap, FULLRES_MAX);
    const thumb = await downscale(bitmap, THUMB_MAX);
    return {
      fullres: full.bytes,
      thumb: thumb.bytes,
      width: full.width,
      height: full.height,
      mime: 'image/webp',
    };
  } finally {
    bitmap.close?.();
  }
};
