// One evidence slot (CLAUDE.md §8.4, §8.5): add photos or PDFs, see
// thumbnails and page counts, reorder and remove, and the per-slot grayscale
// toggle. The same slot can appear on more than one page (the forwarding-address
// slot is also on the Documents step); files live in one store keyed by slot
// id, so the packet index counts it once.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { STANDARD } from '../../../core/images/presets.ts';
import { CheckboxField } from '../../../core/ui/fields.tsx';
import { type IngestError, ingestFile } from '../../../core/uploads/ingest.ts';
import {
  addFiles,
  moveFile,
  releaseFile,
  removeFile,
  setGrayscale,
  type UploadedFile,
} from '../../../core/uploads/store.ts';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import { deriveSlots, type SlotId } from '../checklist.ts';
import { grayscaleFor } from '../uploads.ts';
import { PacketSize } from './packet-size.tsx';
import type { StepProps } from './types.ts';

const u = en.upload;

type FileError = { id: number; name: string; error: IngestError | 'unexpected' };

export const pagesText = (count: number) => (count === 1 ? u.pageOne : t(u.pageMany, { count }));
const filesText = (count: number) => (count === 1 ? u.fileOne : t(u.fileMany, { count }));

export function SlotUpload({
  slotId,
  state,
  uploads,
  updateUploads,
}: Pick<StepProps, 'state' | 'uploads' | 'updateUploads'> & { slotId: SlotId }) {
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<FileError[]>([]);
  // Where focus goes after a move or remove re-renders the list.
  const focusNext = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  // Before paint: moving a list item blurs it, so restore focus right away.
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const slot = deriveSlots(state).find((s) => s.id === slotId);
  if (!slot) return null;
  const files = uploads.files[slotId] ?? [];
  const gray = grayscaleFor(slot, uploads);
  const pages = files.reduce((sum, f) => sum + f.pages, 0);
  const inputId = `upload-${slotId}`;
  const errorsId = `${inputId}-errors`;

  const onPick = async (input: HTMLInputElement) => {
    const picked = [...(input.files ?? [])];
    input.value = '';
    if (picked.length === 0) return;
    const failed: FileError[] = [];
    setErrors([]);
    // One at a time, so only one photo is decoded in memory at once (§8.5).
    for (const [i, file] of picked.entries()) {
      if (mounted.current) setProgress({ n: i + 1, total: picked.length });
      try {
        const result = await ingestFile(file, STANDARD);
        if (result.ok) updateUploads((s) => addFiles(s, slotId, [result.file]));
        else failed.push({ id: i, name: result.name, error: result.error });
      } catch (error) {
        // Telemetry (Phase 6): operation_failed add_file.
        if (import.meta.env.DEV) console.error(error);
        failed.push({ id: i, name: file.name, error: 'unexpected' });
      }
    }
    if (!mounted.current) return;
    setProgress(null);
    setErrors(failed);
    setStatus(u.done);
  };

  const move = (file: UploadedFile, by: -1 | 1) => {
    // Keep focus on the moved file's button; at the end of the list, on its other one.
    const to = files.indexOf(file) + by;
    const hasUp = to > 0;
    const hasDown = to < files.length - 1;
    const keep = by === -1 ? (hasUp ? 'up' : 'down') : hasDown ? 'down' : 'up';
    focusNext.current = `${file.id}-${keep}`;
    updateUploads((s) => moveFile(s, slotId, file.id, by));
  };

  const remove = (file: UploadedFile) => {
    releaseFile(file);
    focusNext.current = inputId;
    updateUploads((s) => removeFile(s, slotId, file.id));
    setStatus(t(u.removed, { name: file.name }));
  };

  return (
    <div class="slot">
      <p class={slot.appDefined ? 'slot-label' : 'slot-label verbatim'}>{slot.label}</p>
      {slot.hint && <p class="field-help">({slot.hint})</p>}
      {slot.help && <p class="field-help">{slot.help}</p>}
      {slot.note && <p class="field-help">{slot.note}</p>}

      <div class="field upload-field">
        <label for={inputId} class="field-label">
          {u.addLabel}
        </label>
        <p id={`${inputId}-help`} class="field-help">
          {u.addHelp}
        </p>
        <input
          id={inputId}
          class="file-input"
          type="file"
          multiple
          accept="image/*,application/pdf"
          disabled={progress !== null}
          aria-describedby={`${inputId}-help${errors.length ? ` ${errorsId}` : ''}`}
          onChange={(e) => onPick(e.currentTarget)}
        />
        <p class="field-help" aria-live="polite">
          {progress ? t(u.adding, progress) : status}
        </p>
        {errors.length > 0 && (
          <ul id={errorsId} class="field-messages upload-errors">
            {errors.map((e) => (
              <li key={e.id}>{t(u.errors[e.error], { name: e.name })}</li>
            ))}
          </ul>
        )}
      </div>

      {files.length > 0 && (
        <>
          <p class="field-help">
            {t(u.slotSummary, { files: filesText(files.length), pages: pagesText(pages) })}
          </p>
          <ol class="file-list">
            {files.map((file, i) => (
              <li key={file.id} class="file-item">
                {file.kind === 'image' ? (
                  <img class={gray ? 'thumb thumb-gray' : 'thumb'} src={file.thumbUrl} alt="" />
                ) : (
                  <span class="thumb thumb-pdf" aria-hidden="true">
                    {u.pdfBadge}
                  </span>
                )}
                <div class="file-meta">
                  <span class="file-name">{file.name}</span>
                  <span class="field-help">{pagesText(file.pages)}</span>
                </div>
                <div class="file-actions">
                  {i > 0 && (
                    <button
                      id={`${file.id}-up`}
                      type="button"
                      class="button button-quiet"
                      onClick={() => move(file, -1)}
                    >
                      {u.moveUp}
                      <span class="visually-hidden"> {file.name}</span>
                    </button>
                  )}
                  {i < files.length - 1 && (
                    <button
                      id={`${file.id}-down`}
                      type="button"
                      class="button button-quiet"
                      onClick={() => move(file, 1)}
                    >
                      {u.moveDown}
                      <span class="visually-hidden"> {file.name}</span>
                    </button>
                  )}
                  <button type="button" class="button button-quiet" onClick={() => remove(file)}>
                    {u.remove}
                    <span class="visually-hidden"> {file.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <CheckboxField
        id={`${inputId}-gray`}
        label={u.grayscale}
        checked={gray}
        onChange={(on) => updateUploads((s) => setGrayscale(s, slotId, on))}
      />

      <PacketSize state={state} uploads={uploads} updateUploads={updateUploads} />
    </div>
  );
}
