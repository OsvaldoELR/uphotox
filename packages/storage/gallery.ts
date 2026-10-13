/**
 * Object keys of a gallery photo in R2. The same layout is built in SQL by
 * private.gallery_photos_queue_deletion(); change both together.
 */
export const galleryPhotoKeys = (photo: {
  readonly galleryId: number;
  readonly id: number;
  readonly studioId: number;
}) => {
  const prefix = `${photo.studioId}/${photo.galleryId}/${photo.id}`;

  return { preview: `${prefix}.jpg`, thumbnail: `${prefix}_t.jpg` } as const;
};
