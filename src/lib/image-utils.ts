const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Downscales and re-encodes a captured photo to JPEG via canvas, which also
 * normalizes away iOS's occasional HEIC-labeled input and applies EXIF
 * orientation. Falls back to the raw file bytes if the browser can't decode it.
 */
export async function normalizeImageForUpload(file: File): Promise<{ mimeType: string; data: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Canvas export failed."))), "image/jpeg", JPEG_QUALITY);
    });

    return { mimeType: "image/jpeg", data: arrayBufferToBase64(await blob.arrayBuffer()) };
  } catch {
    const buffer = await file.arrayBuffer();
    return { mimeType: file.type || "image/jpeg", data: arrayBufferToBase64(buffer) };
  }
}
