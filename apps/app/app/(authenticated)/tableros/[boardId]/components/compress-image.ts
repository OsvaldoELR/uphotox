/** Longest side of the stored thumbnail: sharp at 2x on a 288px card. */
const MAX_SIDE = 640;
const QUALITY = 0.75;

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, QUALITY);
  });

/**
 * Shrinks a photo (straight from a camera or phone) to a small thumbnail in
 * the browser, so only a few dozen KB are uploaded. EXIF orientation is
 * applied so portrait phone photos are not rotated.
 */
export const compressImage = async (file: File): Promise<File> => {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Canvas 2D no disponible");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Browsers that cannot encode WebP silently return PNG: fall back to JPEG.
  let blob = await encode(canvas, "image/webp");

  if (blob?.type !== "image/webp") {
    blob = await encode(canvas, "image/jpeg");
  }

  if (!blob) {
    throw new Error("No se pudo comprimir la imagen");
  }

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `cover.${extension}`, { type: blob.type });
};
