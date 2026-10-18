/**
 * Object keys of an Editor photo in R2 (written by the app and by the
 * Cloudflare service). The same list is built in SQL by
 * private.edit_photos_queue_deletion(); change both together.
 */
export const editPhotoPrefix = (photo: {
  readonly galleryId: number;
  readonly id: number;
  readonly studioId: number;
}) => `editor/${photo.studioId}/${photo.galleryId}/${photo.id}/`;

export const editPhotoKeys = (photo: {
  readonly galleryId: number;
  readonly id: number;
  readonly studioId: number;
}) => {
  const prefix = editPhotoPrefix(photo);

  return {
    prefix,
    original: `${prefix}original.jpg`,
    before: `${prefix}before.jpg`,
    result: `${prefix}result.jpg`,
    preview: `${prefix}preview.jpg`,
    zones: `${prefix}zones.jpg`,
    framed: `${prefix}framed.jpg`,
    framedPreview: `${prefix}framed-preview.jpg`,
    info: `${prefix}info.json`,
    status: `${prefix}status.json`,
  } as const;
};
