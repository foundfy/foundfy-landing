/** Replaces `{host}` in a copy template. */
export function formatHostTemplate(template: string, host: string): string {
  return template.replaceAll("{host}", host);
}
