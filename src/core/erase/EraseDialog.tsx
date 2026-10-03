// The erase confirmation (CLAUDE.md §9.3), a native <dialog> opened with
// showModal(). Copy comes in through props. It opens only once the other-tabs
// line is known, so its text never changes while it's open.

import { useEffect, useRef } from 'preact/hooks';

export interface EraseDialogCopy {
  title: string;
  intro: string;
  items: readonly string[];
  cancel: string;
  confirm: string;
}

export function EraseDialog({
  open,
  copy,
  otherTabsLine,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  copy: EraseDialogCopy;
  otherTabsLine: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby="erase-title"
      // Escape, or close() after either button.
      onClose={() => {
        if (open) onCancel();
      }}
    >
      <h2 id="erase-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      <ul>
        {copy.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {otherTabsLine && <p class="dialog-note">{otherTabsLine}</p>}
      <div class="actions">
        <button type="button" class="button button-secondary" onClick={onCancel}>
          {copy.cancel}
        </button>
        <button type="button" class="button button-primary" onClick={onConfirm}>
          {copy.confirm}
        </button>
      </div>
    </dialog>
  );
}
