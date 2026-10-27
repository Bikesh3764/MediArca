/**
 * Profile photos only come from the upload endpoint (POST /api/auth/avatar), which stores them
 * under `avatars/<userId>-…`. Profile forms may remove the photo or send the current one back,
 * but not point it at any other address: an outside URL could track visitors, and a URL of
 * someone else's file used to get that file deleted on the next upload (FIX-052).
 */
export const AVATAR_URL_MESSAGE = 'Upload a photo instead of entering a link.';

/** Error message for an avatarUrl sent in a profile form, or null when it's fine. */
export const avatarUrlProblem = (value: unknown, current: string | null | undefined): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && value === current) return null;
  return AVATAR_URL_MESSAGE;
};

/** The storage key of this user's own uploaded photo, or null if the URL isn't one of theirs. */
export const ownAvatarKey = (avatarUrl: string | null | undefined, userId: string): string | null => {
  if (!avatarUrl) return null;
  let key = avatarUrl;
  if (/^https?:\/\//i.test(avatarUrl)) {
    try {
      key = new URL(avatarUrl).pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }
  return key.startsWith(`avatars/${userId}-`) && !key.includes('..') ? key : null;
};
