// The email the user sends (CLAUDE.md §8.6): a mailto: link for the
// download + mailto tier. Subject and body text come from the form module.

/** CRLF line endings, as email expects. */
export const toCrlf = (text: string): string => text.replace(/\r?\n/g, '\r\n');

/** `mailto:` with the subject and body URL-encoded (line breaks as %0D%0A). */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const query = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(toCrlf(body))}`,
  ];
  return `mailto:${to}?${query.join('&')}`;
}
