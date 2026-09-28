// Fills "{name}" placeholders in UI strings. `{appName}` and `{operator}` always
// resolve from `app`, the only place they are written (CLAUDE.md header).

import en from './en.json' with { type: 'json' };

export function t(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key in values) return String(values[key]);
    if (key === 'appName') return en.app.name;
    if (key === 'operator') return en.app.operator;
    return match;
  });
}
