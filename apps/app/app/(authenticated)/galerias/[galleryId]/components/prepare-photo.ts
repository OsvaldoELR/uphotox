/** Grid thumbnail: sharp at 2x in a ~300px cell, ~40 KB. */
const THUMBNAIL_SIDE = 600;
const THUMBNAIL_QUALITY = 0.78;

/**
 * Lightroom exports (~200 KB) are uploaded untouched. Anything heavier (a
 * full-size JPG by mistake) is reduced so the client gallery stays fast.
 */
const MAX_UNTOUCHED_BYTES = 1.5 * 1024 * 1024;
const MAX_UNTOUCHED_SIDE = 3000;
const PREVIEW_SIDE = 2048;
const PREVIEW_QUALITY = 0.85;

export interface PreparedPhoto {
  readonly height: number;
  readonly name: string;
  readonly preview: Blob;
  readonly thumbnail: Blob;
  readonly width: number;
}

const toJpeg = (bitmap: ImageBitmap, maxSide: number, quality: number) => {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D no disponible");
  }

  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise<{ blob: Blob; height: number; width: number }>(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve({ blob, width, height })
            : reject(new Error("No se pudo convertir la imagen")),
        "image/jpeg",
        quality
      );
    }
  );
};

/** Reads one photo in the browser and makes its thumbnail (and preview). */
export const preparePhoto = async (file: File): Promise<PreparedPhoto> => {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  try {
    const thumbnail = await toJpeg(bitmap, THUMBNAIL_SIDE, THUMBNAIL_QUALITY);
    const untouched =
      file.size <= MAX_UNTOUCHED_BYTES &&
      Math.max(bitmap.width, bitmap.height) <= MAX_UNTOUCHED_SIDE;

    if (untouched) {
      return {
        name: file.name,
        preview: file,
        thumbnail: thumbnail.blob,
        width: bitmap.width,
        height: bitmap.height,
      };
    }

    const preview = await toJpeg(bitmap, PREVIEW_SIDE, PREVIEW_QUALITY);

    return {
      name: file.name,
      preview: preview.blob,
      thumbnail: thumbnail.blob,
      width: preview.width,
      height: preview.height,
    };
  } finally {
    bitmap.close();
  }
};

/** Runs `task` over `items` with at most `limit` running at once. */
export const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
};
