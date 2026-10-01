// The packet size panel (CLAUDE.md §8.5): the live meter, and over the warning
// level "Compress more" and the largest files with Remove. Shown on every slot
// page (estimate) and on Review (the built preview's real size).

import { useState } from 'preact/hooks';
import { SMALLER } from '../../../core/images/presets.ts';
import { largestAttachments, pdfShare } from '../../../core/pdf/budget.ts';
import { CAP_MB, formatMb, SizeMeter } from '../../../core/ui/size-meter.tsx';
import { imageFile } from '../../../core/uploads/ingest.ts';
import {
  releaseFile,
  removeFile,
  replaceFiles,
  type UploadedFile,
} from '../../../core/uploads/store.ts';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import type { DepositComplaintState } from '../schema.ts';
import { attachedFiles, estimatePacketBytes, type SlotUploads } from '../uploads.ts';
import type { UpdateUploads } from './types.ts';

const m = en.sizeMeter;

export interface PacketSizeProps {
  state: DepositComplaintState;
  uploads: SlotUploads;
  updateUploads: UpdateUploads;
  /** The real size of a built packet; otherwise the meter shows an estimate. */
  actualBytes?: number | null;
}

type Work = 'idle' | 'working' | 'done' | 'failed';

export function PacketSize({ state, uploads, updateUploads, actualBytes }: PacketSizeProps) {
  const [work, setWork] = useState<Work>('idle');
  const attached = attachedFiles(state, uploads);
  const bytes = actualBytes ?? estimatePacketBytes(state, uploads);
  const compressible = attached.flatMap(({ file }) =>
    file.kind === 'image' && file.preset !== SMALLER.id ? [file] : [],
  );
  const mostlyPdf = pdfShare(attached.map((a) => ({ kind: a.file.kind, bytes: a.bytes }))) > 0.5;

  const compressMore = async () => {
    setWork('working');
    // Telemetry (Phase 6): compress_more_used.
    try {
      const replacements = new Map<string, UploadedFile>();
      for (const file of compressible) {
        // From the compressed color copy: the original was discarded on add (§8.5).
        replacements.set(file.id, await imageFile(file.color, file.name, SMALLER, file.id));
      }
      updateUploads((u) => replaceFiles(u, replacements));
      for (const file of compressible) releaseFile(file);
      setWork('done');
    } catch {
      setWork('failed');
    }
  };

  const remove = (slot: (typeof attached)[number]['slot'], file: UploadedFile) => {
    releaseFile(file);
    updateUploads((u) => removeFile(u, slot.id, file.id));
  };

  return (
    <>
      <SizeMeter
        id="packet-size"
        bytes={bytes}
        label={m.label}
        text={t(actualBytes != null ? m.actual : m.estimate, {
          size: formatMb(bytes),
          cap: CAP_MB,
        })}
        messages={{ warn: t(m.warn, { cap: CAP_MB }), over: t(m.over, { cap: CAP_MB }) }}
      >
        {compressible.length > 0 && (
          <>
            <button
              type="button"
              class="button button-secondary"
              disabled={work === 'working'}
              onClick={compressMore}
            >
              {m.compressMore}
            </button>
            <p class="field-help">{m.compressHelp}</p>
          </>
        )}
        {mostlyPdf && <p>{m.pdfNote}</p>}
        {attached.length > 0 && (
          <>
            <h3 class="size-largest-heading">{m.largestHeading}</h3>
            <ul class="plain-list size-largest">
              {largestAttachments(attached).map(({ slot, file, bytes: size }) => (
                <li key={file.id}>
                  {t(m.largestRow, { name: file.name, slot: slot.label, size: formatMb(size) })}{' '}
                  <button type="button" class="link-button" onClick={() => remove(slot, file)}>
                    {en.upload.remove}
                    <span class="visually-hidden"> {file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </SizeMeter>
      <p class="field-help size-status" aria-live="polite">
        {work === 'working'
          ? m.compressing
          : work === 'done'
            ? m.compressed
            : work === 'failed'
              ? m.compressFailed
              : ''}
      </p>
    </>
  );
}
