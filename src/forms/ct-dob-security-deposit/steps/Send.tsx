// Send (CLAUDE.md §7, §8.6): builds the final signed PDF on entering and
// keeps it in memory, then offers the best way this browser has to email it:
//   1. the share sheet (no await before navigator.share(), or Safari refuses);
//   2. otherwise, download + a mailto: link;
//   3. on desktop, also an .eml draft for Outlook-style mail apps;
//   and always a plain Download PDF link.
// Everything stays disabled while §6.3 hard requirements are missing.

import { useEffect, useState } from 'preact/hooks';
import { createObjectUrl, revokeObjectUrl } from '../../../core/blob-urls.ts';
import { budgetStatus } from '../../../core/pdf/budget.ts';
import { canCopy, canShareFiles, isDesktop, sendTier } from '../../../core/send/capabilities.ts';
import { downloadUrl } from '../../../core/send/download.ts';
import { buildEml } from '../../../core/send/eml.ts';
import { mailtoUrl } from '../../../core/send/message.ts';
import { Notice } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { DOB, formUpdatePending } from '../config.ts';
import { emailMessage, packetFilename } from '../send.ts';
import { missingRequired } from '../validation.ts';
import { PacketSize } from './packet-size.tsx';
import { IssueList } from './Review.tsx';
import type { StepProps } from './types.ts';

const s = en.steps.send;

type Packet =
  | { status: 'idle' | 'building' | 'error' }
  | { status: 'ready'; file: File; bytes: Uint8Array; url: string };

/** Kept as long as a slow mail app might take to read the download. */
const EML_URL_LIFETIME_MS = 60_000;

export function Send({ state, uploads, updateUploads, goTo }: StepProps) {
  const missing = missingRequired(state);
  const ready = missing.length === 0;
  const [packet, setPacket] = useState<Packet>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const [shareFailed, setShareFailed] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [showUpdate, setShowUpdate] = useState(formUpdatePending);
  const filename = packetFilename(state);
  const { subject, body } = emailMessage(state);

  // The final packet, built on entering and again if the files change here
  // ("Compress more" or Remove). A build that finishes after leaving is dropped.
  useEffect(() => {
    if (!ready) {
      setPacket({ status: 'idle' });
      return;
    }
    let active = true;
    let url: string | null = null;
    setPacket({ status: 'building' });
    import('../preview.ts')
      .then((m) => m.buildPacket(state, uploads, 'final'))
      .then((built) => {
        if (!active) return;
        const bytes = built.bytes as Uint8Array<ArrayBuffer>;
        const file = new File([bytes], filename, { type: 'application/pdf' });
        url = createObjectUrl(file);
        // Telemetry (Phase 6): packet_built { size_bucket, page_bucket }.
        setPacket({ status: 'ready', file, bytes, url });
      })
      .catch(() => {
        // Telemetry (Phase 6): operation_failed build_packet.
        if (active) setPacket({ status: 'error' });
      });
    return () => {
      active = false;
      if (url) revokeObjectUrl(url);
    };
  }, [ready, attempt, uploads]);

  const built = packet.status === 'ready' ? packet : null;
  const tier = sendTier(Boolean(built) && !shareFailed && canShareFiles(built?.file as File));

  // Tier 1. Synchronous from the tap: nothing is awaited before share().
  const share = () => {
    if (!built) return;
    try {
      navigator.share({ files: [built.file], title: subject, text: body }).then(
        () => {
          // Telemetry (Phase 6): send_method_used share_sheet.
        },
        (error: unknown) => {
          // Cancelling the sheet is not a failure. Telemetry (Phase 6): known_issue share_cancelled.
          if ((error as { name?: string } | null)?.name === 'AbortError') return;
          // Telemetry (Phase 6): known_issue share_rejected.
          setShareFailed(true);
        },
      );
    } catch {
      setShareFailed(true);
    }
  };

  // Tier 2.
  const downloadAndMail = () => {
    if (!built) return;
    downloadUrl(built.url, filename);
    // Telemetry (Phase 6): send_method_used mailto.
    window.location.href = mailtoUrl(DOB.email, subject, body);
  };

  // Tier 3.
  const openEml = () => {
    if (!built) return;
    const text = buildEml({ to: DOB.email, subject, body, filename, pdf: built.bytes });
    const url = createObjectUrl(new Blob([text], { type: 'message/rfc822' }));
    downloadUrl(url, filename.replace(/\.pdf$/, '.eml'));
    // Telemetry (Phase 6): send_method_used eml.
    setTimeout(() => revokeObjectUrl(url), EML_URL_LIFETIME_MS);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(DOB.email).then(
      () => setCopied('copied'),
      () => setCopied('failed'),
    );
  };

  // Fixing a sign page returns straight here with Continue; anything else is
  // an edit that returns to Review, as from Review itself.
  const fix: StepProps['goTo'] = (id, opts) => (id.startsWith('sign.') ? goTo(id) : goTo(id, opts));

  const copyable = canCopy();

  return (
    <>
      {showUpdate && (
        <Notice onDismiss={() => setShowUpdate(false)} dismissLabel={en.common.dismiss}>
          {en.common.formUpdatePending}
        </Notice>
      )}
      <p class="lead">{s.intro}</p>

      {!ready && (
        <section class="section" aria-labelledby="send-missing">
          <h2 id="send-missing">{en.steps.review.missingHeading}</h2>
          <p>{s.missingIntro}</p>
          <IssueList issues={missing} goTo={fix} />
        </section>
      )}

      <section class="section send-to" aria-labelledby="send-to-heading">
        <h2 id="send-to-heading">{s.toHeading}</h2>
        <p class="send-address">{DOB.email}</p>
        {copyable ? (
          <p>
            <button type="button" class="button button-secondary" onClick={copyAddress}>
              {s.copy}
            </button>
          </p>
        ) : (
          <p class="field-help">{s.selectToCopy}</p>
        )}
        <p class="field-help send-status" aria-live="polite">
          {copied === 'copied' ? s.copied : copied === 'failed' ? s.copyFailed : ''}
        </p>
        <p>{s.pasteNote}</p>
      </section>

      <section class="section send-actions" aria-live="polite">
        {packet.status === 'building' && <p>{s.building}</p>}
        {packet.status === 'error' && (
          <p>
            {s.error}{' '}
            <button type="button" class="link-button" onClick={() => setAttempt((n) => n + 1)}>
              {s.retry}
            </button>
          </p>
        )}
        {shareFailed && <p>{s.shareFailed}</p>}
        {tier === 'share' ? (
          <button type="button" class="button button-primary" disabled={!built} onClick={share}>
            {s.share}
          </button>
        ) : (
          <>
            <button
              type="button"
              class="button button-primary"
              disabled={!built}
              onClick={downloadAndMail}
              aria-describedby="send-attach-note"
            >
              {s.mailto}
            </button>
            <p id="send-attach-note" class="field-help">
              {s.attachNote}
            </p>
          </>
        )}
        {isDesktop() && (
          <>
            <button
              type="button"
              class="button button-secondary"
              disabled={!built}
              onClick={openEml}
              aria-describedby="send-eml-help"
            >
              {s.eml}
            </button>
            <p id="send-eml-help" class="field-help">
              {s.emlHelp}
            </p>
          </>
        )}
        <p class="send-download">
          {built ? (
            <a href={built.url} download={filename}>
              {s.download}
            </a>
          ) : (
            <>
              <span class="link-disabled" aria-disabled="true">
                {s.download}
              </span>
              {!ready && <span class="field-help"> {s.downloadUnavailable}</span>}
            </>
          )}
        </p>
      </section>

      {built && budgetStatus(built.bytes.length) !== 'ok' && (
        <PacketSize
          state={state}
          uploads={uploads}
          updateUploads={updateUploads}
          actualBytes={built.bytes.length}
        />
      )}

      <p>{s.afterSend}</p>
    </>
  );
}
