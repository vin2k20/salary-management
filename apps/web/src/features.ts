/**
 * Whether import and export are on in this build. They are built and tested, but paused unless
 * the build sets VITE_FILE_TRANSFERS=enabled (and the API sets FILE_TRANSFERS=enabled): on the
 * free server plan, large files take the API's whole CPU share (D59).
 */
export function fileTransfersEnabled(): boolean {
  return import.meta.env.VITE_FILE_TRANSFERS === 'enabled';
}
