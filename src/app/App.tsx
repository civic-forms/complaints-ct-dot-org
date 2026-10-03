// App shell: holds the complaint state and drives the wizard (CLAUDE.md §7).
// No router: the current page is state, mirrored into history (history.ts) so
// the browser's and phone's Back move between pages. One question per page;
// Continue needs the page's answer (or "Skip for now" where offered), and is
// never disabled. Uploaded files live beside the answers. Drafts are saved in
// the mode chosen on Welcome (drafts.ts, §9.2); erase clears every tab (§9.3).

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { revokeAllObjectUrls } from '../core/blob-urls.ts';
import { EraseDialog } from '../core/erase/EraseDialog.tsx';
import {
  createRemoteEraseHandler,
  type EraseFrom,
  eraseAll,
  installBfcacheGuard,
  startOrReload,
  stepBackTo,
} from '../core/erase/erase.ts';
import {
  listenToTabs,
  type OtherTabs,
  openTabChannel,
  otherTabsLine,
  prepareEraseDialog,
  randomId,
} from '../core/erase/tabs.ts';
import { todayIso } from '../core/format/date.ts';
import { WIN_ANSI } from '../core/pdf/text.ts';
import { sessionStorageOrNull } from '../core/storage/draft-store.ts';
import { deleteDatabase, indexedDbOrNull } from '../core/storage/idb-store.ts';
import { Notice } from '../core/ui/fields.tsx';
import { emptyUploads } from '../core/uploads/store.ts';
import { deriveSlots, type SlotId } from '../forms/ct-dob-security-deposit/checklist.ts';
import { DB_NAME, STORAGE_PREFIX } from '../forms/ct-dob-security-deposit/draft.ts';
import { initialState } from '../forms/ct-dob-security-deposit/schema.ts';
import { normalizeGates } from '../forms/ct-dob-security-deposit/situation.ts';
import type { StepId } from '../forms/ct-dob-security-deposit/steps/ids.ts';
import { PAGES } from '../forms/ct-dob-security-deposit/steps/index.ts';
import type {
  AppControls,
  Update,
  UpdateUploads,
} from '../forms/ct-dob-security-deposit/steps/types.ts';
import { slotFileCounts } from '../forms/ct-dob-security-deposit/uploads.ts';
import { softWarnings } from '../forms/ct-dob-security-deposit/validation.ts';
import { collectUnsupportedChars } from '../forms/ct-dob-security-deposit/values.ts';
import en from '../i18n/en.json' with { type: 'json' };
import { t } from '../i18n/t.ts';
import { SOURCE_URL } from './config.ts';
import { type BootResult, createDrafts, type Failure, type Mode } from './drafts.ts';
import { BASE_PAGE, entryPage, popAction, resumePath, shouldPush } from './history.ts';
import {
  canContinue,
  chapterProgress,
  type EditSession,
  editAction,
  isRelevant,
  nextIndex,
  pendingIds,
} from './progress.ts';
import { SiteHeader } from './SiteHeader.tsx';

const ERROR_ID = 'page-error';
const INTERSTITIAL: StepId = 'review.moreInfoNeeded';
const BASE_PATH = import.meta.env.BASE_URL;
const indexOf = (id: string) =>
  Math.max(
    PAGES.findIndex((p) => p.id === id),
    0,
  );

/** An edit from Review, and the page it started on (Back from the interstitial). */
type Edit = EditSession<StepId> & { origin: StepId };

type Found = Extract<BootResult, { kind: 'found' }>;

interface Notices {
  /** From the load: erase confirmed or not, or an expired draft cleared. */
  boot: 'erased' | 'eraseFailed' | 'expired' | null;
  /** Another tab erased; stays until dismissed. */
  remote: boolean;
  storage: Failure | null;
  /** Session mode after a reload: slots whose files need adding again. */
  readd: SlotId[];
}

/** What listeners registered once at load call, kept current on every render. */
interface Handlers {
  showFromHistory: (index: number) => void;
  pageId: StepId;
  canShow: (page: string) => boolean;
  reset: () => void;
  remoteErase: () => void;
  storageFailed: (failure: Failure) => void;
}

const NO_NOTICES: Notices = { boot: null, remote: false, storage: null, readd: [] };

const isBaseEntry = (state: unknown) => entryPage(state) === BASE_PAGE;

export function App() {
  const [state, setState] = useState(initialState);
  const [uploads, setUploads] = useState(emptyUploads<SlotId>);
  const [index, setIndex] = useState(0);
  const [edit, setEdit] = useState<Edit | null>(null);
  // Bumped on each Continue without an answer, so focus moves to the error again.
  const [errorTap, setErrorTap] = useState(0);
  const firstRender = useRef(true);

  const [booting, setBooting] = useState(true);
  const [found, setFound] = useState<Found | null>(null);
  const [notices, setNotices] = useState<Notices>(NO_NOTICES);
  const [savingMode, setSavingMode] = useState<Mode | null>(null);
  const [dialog, setDialog] = useState<{ from: EraseFrom; otherTabs: OtherTabs } | null>(null);
  const [counting, setCounting] = useState(false);
  const [remotelyErased, setRemotelyErased] = useState(false);
  const [erasing, setErasing] = useState(false);
  // Read synchronously by history and erase handlers, before a re-render.
  const erasingRef = useRef(false);
  /** History is being stepped back to Welcome (erase): ignore its popstates. */
  const steppingRef = useRef(false);
  const cancelCount = useRef<() => void>(() => {});

  // Latest handlers for listeners registered once.
  const latest = useRef<Handlers>({
    showFromHistory: () => {},
    pageId: 'welcome',
    canShow: () => false,
    reset: () => {},
    remoteErase: () => {},
    storageFailed: () => {},
  });

  // Created once per page load.
  const services = useMemo(() => {
    const session = sessionStorageOrNull();
    const idb = indexedDbOrNull();
    const drafts = createDrafts({
      session,
      idb,
      onFailure: (f) => latest.current.storageFailed(f),
      onRemoteDeleted: () => latest.current.remoteErase(),
    });
    const remoteErase = createRemoteEraseHandler({
      prefix: STORAGE_PREFIX,
      saver: drafts.saver,
      session,
      db: drafts.db,
      revokeAll: revokeAllObjectUrls,
      reset: () => latest.current.reset(),
    });
    return {
      session,
      idb,
      drafts,
      remoteErase,
      channel: openTabChannel(STORAGE_PREFIX),
      tabId: randomId(),
    };
  }, []);
  const { drafts } = services;

  const update: Update = (recipe) => setState((s) => normalizeGates(recipe(s)));
  const updateUploads: UpdateUploads = setUploads;
  const unsupported = useMemo(() => collectUnsupportedChars(state, WIN_ANSI), [state]);
  const warnings = useMemo(
    () =>
      softWarnings(state, {
        unsupportedChars: unsupported,
        slotFileCounts: slotFileCounts(state, uploads),
        today: todayIso(),
      }),
    [state, uploads, unsupported],
  );

  const page = PAGES[index] ?? PAGES[0];
  if (!page) throw new Error('No pages');
  const answered = canContinue(page, state);
  const showError = errorTap > 0 && !answered;
  const started = state.meta.storageMode !== null;

  /**
   * Shows page `i`. A move within the app pushes a history entry right away, in
   * the tap's handler: before the new page renders (so iOS's swipe preview of
   * the entry being left shows that page) and never after a quick Back.
   */
  const show = (i: number, opts: { fromHistory?: boolean } = {}) => {
    const to = PAGES[i]?.id;
    if (!opts.fromHistory && to && shouldPush(entryPage(history.state), to)) {
      history.pushState({ page: to }, '');
    }
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
  /** The app's Back is the browser's: the previous page visited (history.ts). */
  const back = () => history.back();
  /** Shows a page reached through history (Back, Forward, swipe), adding no entry. */
  const showFromHistory = (i: number) => {
    if (i === index) return;
    if (edit) {
      // Back from the interstitial returns to the edited page, as before the detour.
      if (page.id === INTERSTITIAL && PAGES[i]?.id === edit.origin) {
        setEdit({ ...edit, detour: false });
      } else setEdit(leaving(edit));
    }
    show(i, { fromHistory: true });
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

  /** Back to an empty form on Welcome (erase, here or in another tab). */
  const reset = () => {
    setState(initialState());
    setUploads(emptyUploads<SlotId>());
    setEdit(null);
    setFound(null);
    setSavingMode(null);
    setErrorTap(0);
    setIndex(0);
  };

  const remoteErase = () => {
    if (!services.remoteErase()) return;
    cancelCount.current();
    setCounting(false);
    setDialog(null);
    setRemotelyErased(true);
    setNotices({ ...NO_NOTICES, remote: true });
    // Back to this tab's Welcome entry, so its Back/Forward reach no filled page.
    steppingRef.current = true;
    void stepBackTo(history, isBaseEntry).finally(() => {
      steppingRef.current = false;
    });
  };

  latest.current = {
    showFromHistory,
    pageId: page.id,
    canShow: (id) =>
      id === INTERSTITIAL ? edit !== null : started && isRelevant(PAGES, indexOf(id), state),
    reset,
    remoteErase,
    storageFailed: (failure) => {
      setSavingMode(null);
      setNotices((n) => ({ ...n, storage: failure }));
    },
  };

  // Load: history's base entry, other tabs, the bfcache guard, and any saved draft.
  useEffect(() => {
    history.replaceState({ page: BASE_PAGE }, '');
    installBfcacheGuard(BASE_PATH);
    const stopListening = listenToTabs(services.channel, services.tabId, () =>
      latest.current.remoteErase(),
    );
    const onPop = (event: PopStateEvent) => {
      if (erasingRef.current || steppingRef.current) return;
      const current = latest.current;
      const act = popAction(entryPage(event.state), current.pageId, current.canShow, indexOf);
      if (act.kind === 'show') current.showFromHistory(indexOf(act.page));
      else if (act.kind === 'skipBack') history.back();
      else if (act.kind === 'stay') history.replaceState({ page: current.pageId }, '');
    };
    const onHide = () => void drafts.saver.flush();
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', onHide);

    drafts.boot().then((result) => {
      if (result.kind === 'erased' || result.kind === 'eraseFailed') {
        // Prune the pre-erase entries that are now forward of this one.
        history.pushState({ page: BASE_PAGE }, '');
      }
      if (result.kind === 'found') setFound(result);
      else if (result.kind !== 'none') setNotices({ ...NO_NOTICES, boot: result.kind });
      // Telemetry (Phase 6): known_issue draft_expired and erase_used expiry.
      setBooting(false);
    });
    return () => {
      stopListening();
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // Save after changes (debounced; nothing until a mode is chosen).
  useEffect(() => {
    if (!booting && !erasingRef.current) drafts.update({ state, uploads, page: page.id });
  }, [state, uploads, page.id, booting]);

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

  const reload = () => location.replace(BASE_PATH);

  const start = (mode: Mode) =>
    startOrReload({
      remotelyErased,
      reload,
      start: () => {
        const next = { ...state, meta: { ...state.meta, storageMode: mode } };
        setState(next);
        setSavingMode(mode);
        setNotices(NO_NOTICES);
        // Telemetry (Phase 6): storage_mode_chosen { mode }.
        void drafts.start(mode, { state: next, uploads, page: page.id });
        advance();
      },
    });

  const resume = () =>
    startOrReload({
      remotelyErased,
      reload,
      start: () => {
        if (!found) return;
        const { mode, snapshot, filesToReadd } = found;
        setFound(null);
        setState(snapshot.state);
        setUploads(snapshot.uploads);
        setSavingMode(mode);
        void drafts.start(mode, snapshot);
        const derived = new Set(deriveSlots(snapshot.state).map((s) => s.id));
        setNotices({ ...NO_NOTICES, readd: filesToReadd.filter((id) => derived.has(id)) });
        // Telemetry (Phase 6): draft_resumed.
        const saved = indexOf(snapshot.page);
        const target =
          saved > 0 && isRelevant(PAGES, saved, snapshot.state)
            ? saved
            : nextIndex(PAGES, 0, snapshot.state);
        // An entry for each page up to the saved one, so Back walks the form.
        const applies = (i: number) =>
          !PAGES[i]?.detourOnly && isRelevant(PAGES, i, snapshot.state);
        for (const id of resumePath(PAGES, target, applies)) history.pushState({ page: id }, '');
        show(target, { fromHistory: true });
      },
    });

  const switchMode = (mode: Mode) => {
    setSavingMode(mode);
    update((s) => ({ ...s, meta: { ...s.meta, storageMode: mode } }));
    void drafts.switchMode(mode);
  };

  /** Counts the other tabs first, so the dialog opens with its final text. */
  const openErase = (from: EraseFrom) => {
    if (counting || erasingRef.current) return;
    setCounting(true);
    cancelCount.current = prepareEraseDialog(services.channel, (otherTabs) => {
      setCounting(false);
      setDialog({ from, otherTabs });
    });
  };

  const erase = () => {
    // Telemetry (Phase 6): erase_used { from }.
    setDialog(null);
    erasingRef.current = true;
    setErasing(true);
    void eraseAll({
      prefix: STORAGE_PREFIX,
      saver: drafts.saver,
      channel: services.channel,
      session: services.session,
      db: drafts.db,
      deleteDb: () => deleteDatabase(services.idb, DB_NAME),
      revokeAll: revokeAllObjectUrls,
      reset,
      backToBase: () => stepBackTo(history, isBaseEntry),
      replace: (url) => location.replace(url),
      basePath: BASE_PATH,
    });
  };

  const erasePrompt = dialog ? (
    <EraseDialog
      open
      copy={en.eraseDialog}
      otherTabsLine={otherTabsLine(dialog.otherTabs, {
        one: en.eraseDialog.tabsOne,
        many: (n) => t(en.eraseDialog.tabsMany, { n }),
        unknown: en.eraseDialog.tabsUnknown,
      })}
      onCancel={() => setDialog(null)}
      onConfirm={erase}
    />
  ) : null;

  if (erasing) {
    return (
      <div class="page">
        <main class="main">
          <p role="status">{en.eraseDialog.erasing}</p>
        </main>
      </div>
    );
  }

  const dismiss = (key: keyof Notices) => () =>
    setNotices((n) => ({ ...n, [key]: NO_NOTICES[key] }));
  const welcomeNotices = (
    <>
      {notices.boot === 'erased' && <Notice>{en.notices.erased}</Notice>}
      {notices.boot === 'expired' && <Notice>{en.notices.expired}</Notice>}
      {notices.boot === 'eraseFailed' && (
        <Notice kind="warning">
          <p>{en.notices.eraseFailed}</p>
          <button type="button" class="button button-primary" onClick={erase}>
            {en.notices.eraseRetry}
          </button>
        </Notice>
      )}
      {notices.remote && (
        <Notice onDismiss={dismiss('remote')} dismissLabel={en.common.dismiss}>
          {en.notices.remoteErased}
        </Notice>
      )}
    </>
  );
  const readdLabels = deriveSlots(state).filter((s) => notices.readd.includes(s.id));
  const pageNotices = (
    <>
      {notices.storage && (
        <Notice kind="warning" onDismiss={dismiss('storage')} dismissLabel={en.common.dismiss}>
          {notices.storage === 'quota' ? en.notices.storageFull : en.notices.storageFailed}
        </Notice>
      )}
      {readdLabels.length > 0 && (
        <Notice onDismiss={dismiss('readd')} dismissLabel={en.common.dismiss}>
          <p>{en.notices.filesToReadd}</p>
          <ul>
            {readdLabels.map((slot) => (
              <li key={slot.id}>{slot.label}</li>
            ))}
          </ul>
        </Notice>
      )}
    </>
  );

  const app: AppControls = {
    start,
    resume: found ? resume : null,
    canStart: notices.boot !== 'eraseFailed',
    openErase,
    erasePending: counting,
    notices: welcomeNotices,
  };

  const progress = chapterProgress(PAGES, index, state);
  const chapterTitle = progress ? en.chapters[progress.chapter].title : '';
  const isLast = nextIndex(PAGES, index, state) === index && !edit;
  const primaryLabel = !edit
    ? en.nav.continue
    : action?.to === 'page'
      ? en.nav.continue
      : en.nav.saveAndReturn;
  const { Component } = page;

  return (
    <div class="page">
      <SiteHeader
        showName={index > 0}
        savingMode={savingMode}
        showSaving={started && !remotelyErased}
        erasePending={counting}
        onErase={() => openErase('header')}
        onSwitch={switchMode}
      >
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
      </SiteHeader>

      <main class="main">
        {booting ? null : (
          <>
            {index > 0 && pageNotices}
            {page.title && <h1 tabIndex={-1}>{page.title}</h1>}
            <Component
              key={page.id}
              state={state}
              update={update}
              uploads={uploads}
              updateUploads={updateUploads}
              goTo={goTo}
              next={advance}
              unsupported={unsupported}
              warnings={warnings}
              pageError={showError ? ERROR_ID : null}
              app={app}
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
          </>
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
      {erasePrompt}
    </div>
  );
}
