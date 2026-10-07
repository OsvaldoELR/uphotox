/**
 * Only allow same-origin relative paths as post-auth redirects, so `?next=`
 * can't be used as an open redirect.
 */
export const safeRedirectPath = (
  path: string | null | undefined,
  fallback = "/"
) => {
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }

  return path;
};
