// Review (CLAUDE.md §7): the summary grouped by chapter, with an Edit link on
// every row that opens that question's page; the missing-required list
// (§6.3); the warnings list; and the unsigned preview PDF, built on entering
// once the disclaimer is accepted. App-only answers aren't shown: this is what
// goes on the form.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { createObjectUrl, revokeObjectUrl } from '../../../core/blob-urls.ts';
import { todayIso } from '../../../core/format/date.ts';
import en from '../../../i18n/en.json' with { type: 'json' };
import { isDisclaimerAccepted } from '../disclaimer.ts';
import type { TextPath } from '../field-map.ts';
import { COMPLAINT_TYPES, type DepositComplaintState, type YesNoNotSure } from '../schema.ts';
import { type Issue, missingRequired, softWarnings } from '../validation.ts';
import { textValue } from '../values.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { CHAPTER_IDS, type ChapterId, type StepId } from './ids.ts';
import { type FormPath, pageOfPath, specOf } from './pages.ts';
import type { StepProps } from './types.ts';

const r = en.steps.review;
const labels = verbatim.fieldLabels;
const q = verbatim.page1Labels;
const opt = verbatim.optionLabels;

type Preview =
  | { status: 'idle' | 'building' | 'error' }
  | { status: 'ready'; url: string; bytes: number };

interface Row {
  label: string;
  value: ComponentChildren;
  /** The page that asks for it. */
  page: StepId;
}

const chapterTitle = (id: ChapterId) => en.chapters[id].title;

function answer(value: YesNoNotSure): string {
  if (value === 'yes') return opt.yes;
  if (value === 'no') return opt.no;
  if (value === 'not_sure') return opt.notSure;
  return r.notAnswered;
}

function summary(state: DepositComplaintState): { chapter: ChapterId; rows: Row[] }[] {
  const text = (path: TextPath, label: string): Row => ({
    label,
    value: textValue(path, state) || <span class="muted">{r.empty}</span>,
    page: pageOfPath(path),
  });
  const choice = (path: FormPath, label: string, value: ComponentChildren): Row => ({
    label,
    value,
    page: pageOfPath(path),
  });
  const person = (who: 'tenant' | 'landlord') =>
    (['name', 'street', 'city', 'state', 'zip', 'daytimePhone', 'email'] as const).map((key) =>
      text(`${who}.${key}`, labels[who][key]),
    );
  const { rental, questions: qs } = state;
  const checkedTypes = COMPLAINT_TYPES.filter((type) => state.complaintTypes[type]);
  const terms = [rental.terms.lease && opt.lease, rental.terms.monthToMonth && opt.monthToMonth]
    .filter(Boolean)
    .join(', ');
  const yesNo = (path: FormPath, label: string, value: YesNoNotSure, followUp?: Row): Row[] => [
    choice(path, label, answer(value)),
    ...(value === 'yes' && followUp ? [followUp] : []),
  ];
  return [
    {
      chapter: 'situation',
      rows: [
        {
          label: verbatim.complaintIntro,
          value: checkedTypes.length ? (
            <ul class="plain-list">
              {checkedTypes.map((type) => (
                <li key={type} class="verbatim">
                  {verbatim.complaintTypes[type]}
                </li>
              ))}
            </ul>
          ) : (
            <span class="muted">{r.none}</span>
          ),
          page: 'situation.movedOut',
        },
      ],
    },
    {
      chapter: 'deposit',
      rows: [
        text('rental.monthlyRentCents', labels.rental.monthlyRentCents),
        text('rental.securityDepositCents', labels.rental.securityDepositCents),
        text('rental.otherDepositCents', labels.rental.otherDepositCents),
        ...yesNo(
          'yesNo.depositReturned',
          q.depositReturned,
          qs.depositReturned.answer,
          text('questions.depositReturned.amountCents', en.fields.questions.depositReturnedAmount),
        ),
        ...(qs.depositReturned.answer === 'yes'
          ? yesNo('yesNo.checkCashed', q.checkCashed, qs.depositReturned.checkCashed)
          : []),
        ...yesNo(
          'yesNo.interestPaid',
          q.interestPaid,
          qs.interestPaid.answer,
          text('questions.interestPaid.payments', q.interestPaid),
        ),
      ],
    },
    { chapter: 'aboutYou', rows: person('tenant') },
    { chapter: 'landlord', rows: person('landlord') },
    {
      chapter: 'rental',
      rows: [
        text('rental.unitStreet', labels.rental.unitStreet),
        text('rental.city', labels.rental.city),
        text('rental.state', labels.rental.state),
        text('rental.zip', labels.rental.zip),
        text('rental.housingComplexName', labels.rental.housingComplexName),
        choice(
          'typeOfRental',
          labels.rental.typeOfRental,
          rental.typeOfRental ? opt[rental.typeOfRental] : r.notAnswered,
        ),
        choice('terms.lease', labels.rental.terms, terms || <span class="muted">{r.none}</span>),
        text('rental.moveInDate', labels.rental.moveInDate),
        text('rental.moveOutDate', labels.rental.moveOutDate),
        text('rental.lastRentPaidDate', labels.rental.lastRentPaidDate),
      ],
    },
    {
      chapter: 'moreQuestions',
      rows: [
        choice('cashForKeys', q.cashForKeys, answer(qs.cashForKeys.answer)),
        ...yesNo(
          'yesNo.roommates',
          q.roommates,
          qs.roommates.answer,
          text('questions.roommates.names', q.roommates),
        ),
        ...yesNo(
          'yesNo.landlordOtherProperties',
          q.landlordOtherProperties,
          qs.landlordOtherProperties.answer,
          text('questions.landlordOtherProperties.addresses', q.landlordOtherProperties),
        ),
        ...yesNo(
          'yesNo.correspondenceReceived',
          q.correspondenceReceived,
          qs.correspondenceReceived.answer,
        ),
        ...yesNo(
          'yesNo.courtAction',
          q.courtAction,
          qs.courtAction.answer,
          text('questions.courtAction.docketNumber', en.fields.questions.docketNumber),
        ),
      ],
    },
    {
      chapter: 'comments',
      rows: [
        {
          label: q.additionalComments,
          value: state.additionalComments.trim() ? (
            <span class="pre-wrap">{state.additionalComments.trim()}</span>
          ) : (
            <span class="muted">{r.empty}</span>
          ),
          page: 'comments',
        },
      ],
    },
  ];
}

type GoTo = StepProps['goTo'];

function EditLink({ page, what, goTo }: { page: StepId; what: string; goTo: GoTo }) {
  return (
    <button
      type="button"
      class="link-button edit-link"
      onClick={() => goTo(page, { fromReview: true })}
    >
      {en.nav.edit}
      <span class="visually-hidden"> {what}</span>
    </button>
  );
}

function IssueList({ issues, goTo }: { issues: readonly Issue[]; goTo: GoTo }) {
  const byChapter = CHAPTER_IDS.map((chapter) => ({
    chapter,
    items: issues.filter((i) => specOf(i.step).chapter === chapter),
  })).filter((g) => g.items.length > 0);
  return (
    <>
      {byChapter.map(({ chapter, items }) => (
        <div key={chapter} class="issue-group">
          <h3>{chapterTitle(chapter)}</h3>
          <ul>
            {items.map((issue) => {
              const text =
                issue.label && issue.message ? (
                  <>
                    <span class="issue-label">{issue.label}:</span> {issue.message}
                  </>
                ) : (
                  issue.label || issue.message
                );
              return (
                <li key={`${issue.id}:${issue.message}`}>
                  {text}{' '}
                  <EditLink page={issue.step} what={issue.label || issue.message} goTo={goTo} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export function Review({ state, goTo, unsupported }: StepProps) {
  const accepted = isDisclaimerAccepted(state);
  const [preview, setPreview] = useState<Preview>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  // Build the unsigned preview on entering. A build finishing after the user
  // has left is ignored and its URL never created.
  useEffect(() => {
    if (!accepted) return;
    let active = true;
    let url: string | null = null;
    setPreview({ status: 'building' });
    import('../preview.ts')
      .then((m) => m.buildPacket(state, {}, 'preview'))
      .then((packet) => {
        if (!active) return;
        url = createObjectUrl(
          new Blob([packet.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        );
        setPreview({ status: 'ready', url, bytes: packet.bytes.length });
      })
      .catch(() => {
        if (active) setPreview({ status: 'error' });
      });
    return () => {
      active = false;
      if (url) revokeObjectUrl(url);
    };
  }, [attempt]);

  const missing = missingRequired(state);
  const warnings = softWarnings(state, {
    unsupportedChars: unsupported,
    slotFileCounts: {},
    packetBytes: preview.status === 'ready' ? preview.bytes : null,
    today: todayIso(),
  });

  return (
    <>
      <p>{r.intro}</p>

      <section class="section preview" aria-live="polite">
        {!accepted && (
          <p>
            {r.previewNeedsDisclaimer}{' '}
            <button
              type="button"
              class="link-button"
              onClick={() => goTo('disclaimer', { fromReview: true })}
            >
              {r.previewNeedsDisclaimerLink}
            </button>
          </p>
        )}
        {preview.status === 'building' && <p>{r.previewBuilding}</p>}
        {preview.status === 'error' && (
          <p>
            {r.previewError}{' '}
            <button type="button" class="link-button" onClick={() => setAttempt((n) => n + 1)}>
              {r.previewRetry}
            </button>
          </p>
        )}
        {preview.status === 'ready' && (
          <a
            class="button button-primary"
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {r.previewButton} <span class="visually-hidden">{en.common.opensNewTab}</span>
          </a>
        )}
      </section>

      <section class="section" aria-labelledby="missing-heading">
        <h2 id="missing-heading">{r.missingHeading}</h2>
        {missing.length ? <IssueList issues={missing} goTo={goTo} /> : <p>{r.missingNone}</p>}
      </section>

      {warnings.length > 0 && (
        <section class="section" aria-labelledby="warnings-heading">
          <h2 id="warnings-heading">{r.warningsHeading}</h2>
          <p class="field-help">{r.warningsIntro}</p>
          <IssueList issues={warnings} goTo={goTo} />
        </section>
      )}

      {summary(state).map(({ chapter, rows }) => (
        <section key={chapter} class="section summary" aria-labelledby={`summary-${chapter}`}>
          <h2 id={`summary-${chapter}`}>{chapterTitle(chapter)}</h2>
          <dl>
            {rows.map((row, i) => (
              <div key={i} class="summary-row">
                <dt>
                  {row.label} <EditLink page={row.page} what={row.label} goTo={goTo} />
                </dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}

/** The edit detour's interstitial: names the change, never what the answers mean. */
export function MoreInfoNeeded() {
  return <p class="lead">{en.pages.moreInfoNeeded}</p>;
}
