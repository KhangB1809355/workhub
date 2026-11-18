/** Only Google Drive / Docs links are accepted for the shared document link. */
export const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];
export function isDriveUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && DRIVE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
