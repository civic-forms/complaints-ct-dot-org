// Live packet size meter (CLAUDE.md §8.5): a native <meter> against the 10 MB
// cap, warning above 8 MB. Sizes are shown to the user only. Copy via props.

import type { ComponentChildren } from 'preact';
import { type BudgetStatus, budgetStatus, CAP_BYTES, WARN_BYTES } from '../pdf/budget.ts';

const MB = 1024 * 1024;

/** One decimal, e.g. "3.2". */
export const formatMb = (bytes: number) => (bytes / MB).toFixed(1);
export const CAP_MB = String(CAP_BYTES / MB);

export interface SizeMeterProps {
  id: string;
  bytes: number;
  label: string;
  /** e.g. "About 3.2 MB of 10 MB". */
  text: string;
  /** Messages for the warning and over-cap states. */
  messages: Record<Exclude<BudgetStatus, 'ok'>, string>;
  /** Shown under the warning (e.g. "Compress more" and the largest files). */
  children?: ComponentChildren;
}

export function SizeMeter({ id, bytes, label, text, messages, children }: SizeMeterProps) {
  const status = budgetStatus(bytes);
  return (
    <section class={`size-meter size-${status}`} aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} class="field-label">
        {label}
      </p>
      <meter
        id={id}
        min={0}
        max={CAP_BYTES}
        low={WARN_BYTES}
        high={WARN_BYTES}
        optimum={0}
        value={Math.min(bytes, CAP_BYTES)}
        aria-describedby={`${id}-text`}
      />
      <p id={`${id}-text`} class="field-help">
        {text}
      </p>
      {status !== 'ok' && (
        <div class={`notice notice-warning`} role="status">
          <div class="notice-body">
            <p>{messages[status]}</p>
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
