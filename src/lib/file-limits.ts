// Vercel Functions accept at most 4.5 MB per request. Multipart form metadata
// needs headroom, so Server Action file inputs are capped at 3 MB total.
export const SERVER_ACTION_FILE_MAX_BYTES = 3 * 1024 * 1024;
