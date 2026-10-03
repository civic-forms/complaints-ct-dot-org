// Erase across tabs (CLAUDE.md §9.3). Tabs of the app in one browser talk on a
// BroadcastChannel named with the storage prefix. Messages carry only a type
// and random ids, never anything the user entered:
//   ping/pong: count the other open tabs before the erase dialog opens;
//   erase: every other tab stops saving and clears itself.

export type TabMessage =
  | { type: 'ping'; id: string }
  | { type: 'pong'; id: string; from: string }
  | { type: 'erase' };

export interface TabChannel {
  post(message: TabMessage): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: (message: TabMessage) => void): () => void;
  close(): void;
}

/** Other open tabs, or 'unknown' where BroadcastChannel isn't supported. */
export type OtherTabs = number | 'unknown';

export const PING_WAIT_MS = 200;

export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function parseMessage(data: unknown): TabMessage | null {
  const m = data as Partial<Record<string, unknown>> | null;
  if (!m || typeof m !== 'object') return null;
  if (m.type === 'erase') return { type: 'erase' };
  if (m.type === 'ping' && typeof m.id === 'string') return { type: 'ping', id: m.id };
  if (m.type === 'pong' && typeof m.id === 'string' && typeof m.from === 'string') {
    return { type: 'pong', id: m.id, from: m.from };
  }
  return null;
}

/** The channel, or null where BroadcastChannel is missing or fails. */
export function openTabChannel(name: string): TabChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    const channel = new BroadcastChannel(name);
    return {
      post: (message) => {
        try {
          channel.postMessage(message);
        } catch {
          // A closed channel: nothing to tell.
        }
      },
      subscribe: (listener) => {
        const handler = (event: MessageEvent) => {
          const message = parseMessage(event.data);
          if (message) listener(message);
        };
        channel.addEventListener('message', handler);
        return () => channel.removeEventListener('message', handler);
      },
      close: () => channel.close(),
    };
  } catch {
    return null;
  }
}

/** Answers other tabs' pings, and calls `onErase` when another tab erases. */
export function listenToTabs(
  channel: TabChannel | null,
  tabId: string,
  onErase: () => void,
): () => void {
  if (!channel) return () => {};
  return channel.subscribe((message) => {
    if (message.type === 'ping') channel.post({ type: 'pong', id: message.id, from: tabId });
    else if (message.type === 'erase') onErase();
  });
}

/** Distinct tabs that answered this ping. */
export function countTabs(messages: readonly TabMessage[], pingId: string): number {
  const from = new Set<string>();
  for (const m of messages) if (m.type === 'pong' && m.id === pingId) from.add(m.from);
  return from.size;
}

/**
 * Pings the other tabs, collects answers for a fixed `waitMs`, then calls
 * `open` with the count, so the dialog opens with its final text. Without a
 * channel it opens at once with 'unknown'. Returns a cancel function.
 */
export function prepareEraseDialog(
  channel: TabChannel | null,
  open: (otherTabs: OtherTabs) => void,
  waitMs = PING_WAIT_MS,
): () => void {
  if (!channel) {
    open('unknown');
    return () => {};
  }
  const id = randomId();
  const received: TabMessage[] = [];
  const unsubscribe = channel.subscribe((message) => received.push(message));
  channel.post({ type: 'ping', id });
  const timer = setTimeout(() => {
    unsubscribe();
    open(countTabs(received, id));
  }, waitMs);
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

/** The dialog's line about other tabs; null when there are none. */
export function otherTabsLine(
  otherTabs: OtherTabs,
  copy: { one: string; many: (n: number) => string; unknown: string },
): string | null {
  if (otherTabs === 'unknown') return copy.unknown;
  if (otherTabs === 0) return null;
  return otherTabs === 1 ? copy.one : copy.many(otherTabs);
}
