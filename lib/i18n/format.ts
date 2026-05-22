export function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}

export type AuthErrorKey = keyof import("./types").Dictionary["auth"]["errors"];
