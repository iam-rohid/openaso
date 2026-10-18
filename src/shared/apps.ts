/** Temporary (pre-launch) apps use this id prefix; App Store ids are always numeric. */
export const TEMPORARY_APP_PREFIX = "tmp_";
export const TEMPORARY_APP_NAME_MAX = 30;

/** Matches an App Store track id or a temporary app id. */
export const APP_ID_PATTERN = /^(?:\d+|tmp_[a-z0-9]+)$/;

export const isTemporaryAppId = (id: string) => id.startsWith(TEMPORARY_APP_PREFIX);

/** Accepts "123", "id123" or a full apps.apple.com URL. */
export function parseAppId(query: string): string | null {
  const match = query.trim().match(/(?:^|\/id|^id)(\d{6,})(?:\D|$)/);
  return match ? match[1] : null;
}
