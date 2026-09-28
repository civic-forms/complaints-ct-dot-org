// App shell: holds the complaint state in memory and drives the wizard
// (CLAUDE.md §7). No router: the current step is state. Persistence arrives
// in Phase 5.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { todayIso } from '../core/format/date.ts';
import { WIN_ANSI } from '../core/pdf/text.ts';
import { useMediaQuery } from '../core/ui/fields.tsx';
import { initialState } from '../forms/ct-dob-security-deposit/schema.ts';
import type { StepId } from '../forms/ct-dob-security-deposit/steps/ids.ts';
import { STEPS } from '../forms/ct-dob-security-deposit/steps/index.ts';
import type { Update } from '../forms/ct-dob-security-deposit/steps/types.ts';
import { softWarnings } from '../forms/ct-dob-security-deposit/validation.ts';
import { collectUnsupportedChars } from '../forms/ct-dob-security-deposit/values.ts';
import en from '../i18n/en.json' with { type: 'json' };
import { t } from '../i18n/t.ts';
import { SOURCE_URL } from './config.ts';
import { progressOf } from './progress.ts';

const NARROW = '(max-width: 40rem)';

export function App() {
  const [state, setState] = useState(initialState);
  const [pos, setPos] = useState({ index: 0, sub: 0 });
  const narrow = useMediaQuery(NARROW);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const update: Update = (recipe) => setState(recipe);
  const unsupported = useMemo(() => collectUnsupportedChars(state, WIN_ANSI), [state]);
  const warnings = useMemo(
    () =>
      softWarnings(state, { unsupportedChars: unsupported, slotFileCounts: {}, today: todayIso() }),
    [state, unsupported],
  );

  const subCount = (index: number) => STEPS[index]?.subScreens?.(narrow) ?? 1;
  const step = STEPS[pos.index] ?? STEPS[0];
  if (!step) throw new Error('No steps');
  const sub = Math.min(pos.sub, subCount(pos.index) - 1);
  const isLast = pos.index === STEPS.length - 1;

  const next = () =>
    setPos(({ index }) => {
      if (sub < subCount(index) - 1) return { index, sub: sub + 1 };
      return { index: Math.min(index + 1, STEPS.length - 1), sub: 0 };
    });
  const back = () =>
    setPos(({ index }) => {
      if (sub > 0) return { index, sub: sub - 1 };
      const prev = Math.max(index - 1, 0);
      return { index: prev, sub: subCount(prev) - 1 };
    });
  const goTo = (id: StepId) =>
    setPos({
      index: Math.max(
        STEPS.findIndex((s) => s.id === id),
        0,
      ),
      sub: 0,
    });

  // §14: step changes move focus to the step heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, [pos.index, sub]);

  const progress = progressOf(STEPS, pos.index);
  const subs = subCount(pos.index);
  const { Component } = step;

  return (
    <div class="page">
      <header class="site-header">
        {/* Welcome's h1 is the app name already. */}
        {pos.index > 0 && <p class="site-name">{en.app.name}</p>}
        {progress && (
          <div class="progress">
            <label for="progress-bar">
              {t(en.nav.progress, { n: progress.n, total: progress.total })}
              {subs > 1 && (
                <span class="sub-progress">
                  {' · '}
                  {t(en.nav.subProgress, { n: sub + 1, total: subs })}
                </span>
              )}
            </label>
            <progress id="progress-bar" value={progress.n} max={progress.total} />
          </div>
        )}
      </header>

      <main class="main">
        <h1 ref={heading} tabIndex={-1}>
          {step.title}
        </h1>
        <Component
          key={step.id}
          state={state}
          update={update}
          goTo={goTo}
          next={next}
          unsupported={unsupported}
          warnings={warnings}
          sub={sub}
          narrow={narrow}
        />
        {(pos.index > 0 || !step.hideNext) && (
          <nav class="wizard-nav" aria-label={en.nav.stepsLabel}>
            {pos.index > 0 && (
              <button type="button" class="button button-secondary" onClick={back}>
                {en.nav.back}
              </button>
            )}
            {!step.hideNext && !(isLast && sub >= subs - 1) && (
              <button type="button" class="button button-primary" onClick={next}>
                {en.nav.next}
              </button>
            )}
          </nav>
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
