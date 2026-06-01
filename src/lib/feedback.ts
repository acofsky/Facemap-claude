// Single source of truth for the feedback channel. Used by the "What's New"
// popup and the Profile → Leave feedback row.

export const FEEDBACK_EMAIL = 'general@membr-app.com';

/**
 * Open the user's mail composer addressed to the feedback inbox. Uses
 * `location.href` rather than `window.open` because iOS WKWebView handles the
 * `mailto:` scheme natively (handing it to Mail) without navigating the
 * webview — `window.open('mailto:…')` can leave a blank tab instead.
 */
export function openFeedback() {
  const subject = encodeURIComponent('Membr feedback');
  window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;
}
