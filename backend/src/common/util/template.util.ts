export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
/** Deliberately small, escaped subset of the project's existing HTML templates. */
export function renderTemplate(
  template: string,
  values: Record<string, unknown>,
  arrays: Record<string, Record<string, unknown>[]> = {},
) {
  let html = template.replace(
    /{{#each (\w+)}}([\s\S]*?){{\/each}}/g,
    (_all, key: string, body: string) =>
      (arrays[key] ?? [])
        .map((row, index) =>
          body
            .replace(/{{@index \+ 1}}/g, String(index + 1))
            .replace(/{{this\.(\w+)}}/g, (_match, k: string) =>
              escapeHtml(row[k]),
            ),
        )
        .join(""),
  );
  html = html.replace(/{{(\w+)}}/g, (_match, key: string) =>
    escapeHtml(values[key]).replace(/\r?\n/g, "<br>"),
  );
  return html;
}
