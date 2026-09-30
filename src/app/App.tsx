// App shell: holds the complaint state in memory and drives the wizard
// (CLAUDE.md §7). No router: the current page is state. One question per
// page; Continue needs the page's answer (or "Skip for now" where offered),
// and is never disabled. Persistence arrives in Phase 5.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { todayIso } from '../core/format/date.ts';
import { WIN_ANSI } from '../core/pdf/text.ts';
import { initialState } from '../forms/ct-dob-security-deposit/schema.ts';
import { normalizeGates } from '../forms/ct-dob-security-deposit/situation.ts';
import type { StepId } from '../forms/ct-dob-security-deposit/steps/ids.ts';
import { PAGES } from '../forms/ct-dob-security-deposit/steps/index.ts';
import type { Update } from '../forms/ct-dob-security-deposit/steps/types.ts';
import { softWarnings } from '../forms/ct-dob-security-deposit/validation.ts';
import { collectUnsupportedChars } from '../forms/ct-dob-security-deposit/values.ts';
import en from '../i18n/en.json' with { type: 'json' };
import { t } from '../i18n/t.ts';
import { SOURCE_URL } from './config.ts';
import {
  canContinue,
  chapterProgress,
  type EditSession,
  editAction,
  newlyPending,
  nextIndex,
  pendingIds,
  prevIndex,
} from './progress.ts';

const ERROR_ID = 'page-error';
const INTERSTITIAL: StepId = 'review.moreInfoNeeded';
const indexOf = (id: StepId) =>
  Math.max(
    PAGES.findIndex((p) => p.id === id),
    0,
  );

/** An edit from Review, and the page it started on (Back from the interstitial). */
type Edit = EditSession<StepId> & { origin: StepId };

export function App() {
  const [state, setState] = useState(initialState);
  const [index, setIndex] = useState(0);
  const [edit, setEdit] = useState<Edit | null>(null);
  // Bumped on each Continue without an answer, so focus moves to the error again.
  const [errorTap, setErrorTap] = useState(0);
  const firstRender = useRef(true);

  const update: Update = (recipe) => setState((s) => normalizeGates(recipe(s)));
  const unsupported = useMemo(() => collectUnsupportedChars(state, WIN_ANSI), [state]);
  const warnings = useMemo(
    () =>
      softWarnings(state, { unsupportedChars: unsupported, slotFileCounts: {}, today: todayIso() }),
    [state, unsupported],
  );

  const page = PAGES[index] ?? PAGES[0];
  if (!page) throw new Error('No pages');
  const answered = canContinue(page, state);
  const showError = errorTap > 0 && !answered;

  const show = (i: number) => {
    setErrorTap(0);
    if (PAGES[i]?.id === 'review') setEdit(null);
    setIndex(i);
  };
  /** During an edit, a page left unanswered never starts a detour later. */
  const leaving = (session: Edit): Edit =>
    pendingIds(PAGES, state).has(page.id)
      ? { ...session, before: new Set([...session.before, page.id]) }
      : session;

  const action = edit ? editAction(PAGES, edit, page.id, state) : null;

  /** Continue, Skip, and the Disclaimer's own button (no answer check). */
  const advance = () => {
    if (!edit || !action) {
      show(nextIndex(PAGES, index, state));
      return;
    }
    const session = leaving(edit);
    const next = editAction(PAGES, session, page.id, state);
    if (next.to === 'review') show(indexOf('review'));
    else if (next.to === 'interstitial') {
      setEdit({ ...session, detour: true });
      show(indexOf(INTERSTITIAL));
    } else {
      setEdit(session);
      show(indexOf(next.id));
    }
  };
  const primary = () => {
    if (!answered) {
      setErrorTap((n) => n + 1);
      return;
    }
    advance();
  };
  const back = () => {
    if (edit && page.id === INTERSTITIAL) {
      setEdit({ ...edit, detour: false });
      show(indexOf(edit.origin));
      return;
    }
    if (edit) setEdit(leaving(edit));
    show(prevIndex(PAGES, index, state));
  };
  const secondaryNext = () => {
    if (edit) setEdit(leaving(edit));
    show(nextIndex(PAGES, index, state));
  };
  const goTo = (id: StepId, opts: { fromReview?: boolean } = {}) => {
    if (opts.fromReview) {
      setEdit({ before: pendingIds(PAGES, state), detour: false, origin: id });
    }
    show(indexOf(id));
  };

  // §14: page changes move focus to the page's h1.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [index]);

  // Continue without an answer: focus moves to the error.
  useEffect(() => {
    if (errorTap > 0) document.getElementById(ERROR_ID)?.focus();
  }, [errorTap]);

  const progress = chapterProgress(PAGES, index, state);
  const chapterTitle = progress ? en.chapters[progress.chapter].title : '';
  const isLast = nextIndex(PAGES, index, state) === index && !edit;
  const primaryLabel = !edit
    ? en.nav.continue
    : action?.to === 'page'
      ? en.nav.continue
      : en.nav.saveAndReturn;
  const detourCount = edit ? newlyPending(PAGES, edit.before, state).length : 0;
  const { Component } = page;

  return (
    <div class="page">
      <header class="site-header">
        {/* Welcome's h1 is the app name already. */}
        {index > 0 && <p class="site-name">{en.app.name}</p>}
        {progress && (
          <div class="progress">
            <label for="progress-bar">
              {progress.n === null
                ? chapterTitle
                : t(en.nav.chapterProgress, {
                    chapter: chapterTitle,
                    n: progress.n,
                    total: progress.total,
                  })}
            </label>
            <progress id="progress-bar" value={progress.chapterN} max={progress.chapterTotal} />
          </div>
        )}
      </header>

      <main class="main">
        {page.title && <h1 tabIndex={-1}>{page.title}</h1>}
        <Component
          key={page.id}
          state={state}
          update={update}
          goTo={goTo}
          next={advance}
          unsupported={unsupported}
          warnings={warnings}
          pageError={showError ? ERROR_ID : null}
          detourCount={detourCount}
        />
        {showError && page.answer && (
          <p id={ERROR_ID} class="page-error" tabIndex={-1}>
            {page.answer.kind === 'choice' ? en.errors.chooseAnswer : en.errors.enterOrSkip}
          </p>
        )}
        {(index > 0 || !page.hideNext) && (
          <nav class="wizard-nav" aria-label={en.nav.stepsLabel}>
            {index > 0 && (
              <button type="button" class="button button-secondary" onClick={back}>
                {en.nav.back}
              </button>
            )}
            {edit && page.id !== INTERSTITIAL && nextIndex(PAGES, index, state) !== index && (
              <button type="button" class="button button-secondary" onClick={secondaryNext}>
                {en.nav.next}
              </button>
            )}
            {!page.hideNext && !isLast && (
              <button type="button" class="button button-primary" onClick={primary}>
                {primaryLabel}
              </button>
            )}
          </nav>
        )}
        {page.answer?.skippable && !answered && (
          <p class="skip">
            <button type="button" class="link-button" onClick={advance}>
              {en.nav.skip}
            </button>
          </p>
        )}
      </main>

      <footer class="site-footer">
        <p>{en.footer.independent}</p>
        <p>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            {en.footer.source}
          </a>
        </p>
      </footer>
    </div>
  );
}
