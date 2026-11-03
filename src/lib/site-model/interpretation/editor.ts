/**
 * Live Site Model list editing.
 *
 * Offers, audiences, and locations are one item per line. Trim, empty-line
 * removal, and length caps belong at save — not on every keystroke.
 */
export function listFieldToEditorText(values: string[]): string {
  return values.join("\n");
}

export function applyListFieldEditorChange(nextValue: string): string[] {
  return nextValue.split("\n");
}
