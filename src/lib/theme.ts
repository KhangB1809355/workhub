/** Cookie read by the root layout to render the saved light/dark theme on the server. */
export const THEME_COOKIE = 'workhub_theme';

/** Client only: remember the theme for the next page load (1 year). */
export function saveThemeCookie(dark: boolean) {
  document.cookie = `${THEME_COOKIE}=${dark ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
}
