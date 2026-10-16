/** Temporary (pre-launch) apps use this id prefix; App Store ids are always numeric. */
export const TEMPORARY_APP_PREFIX = "tmp_";
export const TEMPORARY_APP_NAME_MAX = 30;

/** Matches an App Store track id or a temporary app id. */
export const APP_ID_PATTERN = /^(?:\d+|tmp_[a-z0-9]+)$/;

export const isTemporaryAppId = (id: string) => id.startsWith(TEMPORARY_APP_PREFIX);
