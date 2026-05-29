/**
 * Strips HTML tags, limits length, and trims whitespace.
 * Use before storing any user‑generated text.
 */
export function sanitizeInput(str, maxLength = 5000) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, maxLength);
}
