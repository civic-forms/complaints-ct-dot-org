// Every object URL the app creates goes through here, so the erase routine
// (CLAUDE.md §9.3) can revoke them all.

const urls = new Set<string>();

export function createObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  urls.add(url);
  return url;
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
  urls.delete(url);
}

export function revokeAllObjectUrls(): void {
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
}
