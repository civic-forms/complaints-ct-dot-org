// Shared field components (CLAUDE.md §7 native inputs, §14 accessibility).
// Form-agnostic: every string comes in through props.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatCents, parseMoneyToCents } from '../format/money.ts';

/** Characters the PDF can't print, for one field. `key` identifies the set. */
export interface Unprintable {
  key: string;
  message: string;
}

export interface ShellProps {
  /** The form's own label, shown as "On the form: …" (already formatted). */
  hint?: string;
  help?: ComponentChildren;
  /** Soft warnings and inline hints, shown under the input. */
  messages?: readonly string[];
  /** Pass for fields that can hold typed text, even when there's nothing to report (null). */
  unprintable?: Unprintable | null;
  /** The page's "answer to continue" error, when shown (its element id). */
  errorId?: string | null;
  /** The label is the page's question: render it as the h1 (one question per page). */
  heading?: boolean;
}

function describedBy(id: string, p: ShellProps, extra: string[] = []) {
  const ids = [...extra];
  if (p.errorId) ids.push(p.errorId);
  if (p.hint) ids.push(`${id}-hint`);
  if (p.help) ids.push(`${id}-help`);
  if (p.messages?.length) ids.push(`${id}-msg`);
  if (p.unprintable) ids.push(`${id}-chars`);
  return ids.length ? ids.join(' ') : undefined;
}

/** A field's label, or the page's h1 when the field is the page's question. */
function Label({
  id,
  heading,
  children,
}: {
  id: string;
  heading?: boolean;
  children: ComponentChildren;
}) {
  const label = (
    <label for={id} class="field-label">
      {children}
    </label>
  );
  return heading ? (
    <h1 class="question" tabIndex={-1}>
      {label}
    </h1>
  ) : (
    label
  );
}

function Below({ id, hint, help, messages, unprintable }: ShellProps & { id: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} class="field-hint">
          {hint}
        </p>
      )}
      {help && (
        <p id={`${id}-help`} class="field-help">
          {help}
        </p>
      )}
      {messages && messages.length > 0 && (
        <ul id={`${id}-msg`} class="field-messages">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {unprintable && (
        <p id={`${id}-chars`} class="field-messages field-chars">
          {unprintable.message}
        </p>
      )}
      {unprintable !== undefined && (
        <AnnounceOnChange setKey={unprintable?.key ?? ''} message={unprintable?.message ?? ''} />
      )}
    </>
  );
}

/**
 * Screen-reader announcement for the unprintable-character message. The visible
 * message isn't a live region; this one changes only when the *set* of
 * characters changes, so typing more letters doesn't re-announce it. When the
 * set becomes empty it is cleared silently.
 */
export function AnnounceOnChange({ setKey, message }: { setKey: string; message: string }) {
  const last = useRef(setKey);
  const [text, setText] = useState('');
  useEffect(() => {
    if (setKey === last.current) return;
    last.current = setKey;
    setText(setKey ? message : '');
  }, [setKey, message]);
  return (
    <span class="visually-hidden" aria-live="polite">
      {text}
    </span>
  );
}

interface InputAttrs {
  type?: 'text' | 'tel' | 'email';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  autoComplete?: string;
  maxLength?: number;
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  pattern?: string;
  spellcheck?: boolean;
  name?: string;
}

export interface TextFieldProps extends ShellProps, InputAttrs {
  id: string;
  label: ComponentChildren;
  value: string;
  onInput: (value: string) => void;
  /** Applied on every keystroke; the input shows the normalized value. */
  normalize?: (value: string) => string;
  required?: boolean;
  /** Suggestions shown as a <datalist>; free text is still allowed. */
  suggestions?: readonly string[];
}

export function TextField(props: TextFieldProps) {
  const {
    id,
    label,
    value,
    onInput,
    normalize,
    required,
    hint,
    help,
    messages,
    unprintable,
    errorId,
    heading,
    suggestions,
    ...attrs
  } = props;
  return (
    <div class="field">
      <Label id={id} heading={heading}>
        {label}
      </Label>
      <input
        id={id}
        class="input"
        value={value}
        list={suggestions ? `${id}-list` : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, props)}
        {...attrs}
        type={attrs.type ?? 'text'}
        onInput={(e) => {
          const input = e.currentTarget;
          const next = normalize ? normalize(input.value) : input.value;
          // Keep the DOM in step even when state doesn't change (e.g. a rejected letter).
          if (next !== input.value) input.value = next;
          onInput(next);
        }}
      />
      {suggestions && (
        <datalist id={`${id}-list`}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      <Below id={id} hint={hint} help={help} messages={messages} unprintable={unprintable} />
    </div>
  );
}

export interface TextAreaProps extends ShellProps {
  id: string;
  label: ComponentChildren;
  value: string;
  onInput: (value: string) => void;
  rows?: number;
  /** Shown after the textarea, e.g. a character count. */
  footer?: ComponentChildren;
}

export function TextArea(props: TextAreaProps) {
  const { id, label, value, onInput, rows = 8, footer, heading } = props;
  return (
    <div class="field">
      <Label id={id} heading={heading}>
        {label}
      </Label>
      <textarea
        id={id}
        class="input textarea"
        rows={rows}
        value={value}
        aria-describedby={describedBy(id, props, footer ? [`${id}-footer`] : [])}
        onInput={(e) => onInput(e.currentTarget.value)}
      />
      {footer && (
        <p id={`${id}-footer`} class="field-help">
          {footer}
        </p>
      )}
      <Below {...props} id={id} />
    </div>
  );
}

export interface MoneyFieldProps extends ShellProps {
  id: string;
  label: ComponentChildren;
  cents: number | null;
  onChange: (cents: number | null) => void;
  /** Shown while the typed text isn't an amount. */
  invalidMessage: string;
}

/** Money as typed text; state holds integer cents (§6.1). */
export function MoneyField(props: MoneyFieldProps) {
  const { id, label, cents, onChange, invalidMessage } = props;
  const [text, setText] = useState(() => formatCents(cents));
  // Follow outside changes (e.g. a reset) without fighting the user's typing.
  useEffect(() => {
    if (parseMoneyToCents(text) !== cents) setText(formatCents(cents));
  }, [cents]);
  const invalid = text.trim() !== '' && parseMoneyToCents(text) === null;
  const messages = [...(invalid ? [invalidMessage] : []), ...(props.messages ?? [])];
  const shell = { ...props, messages };
  return (
    <div class="field">
      <Label id={id} heading={props.heading}>
        {label}
      </Label>
      <input
        id={id}
        class="input input-money"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, shell)}
        onInput={(e) => {
          const next = e.currentTarget.value;
          setText(next);
          onChange(parseMoneyToCents(next));
        }}
        onBlur={() => {
          if (!invalid) setText(formatCents(parseMoneyToCents(text)));
        }}
      />
      <Below {...shell} id={id} />
    </div>
  );
}

export interface DateFieldProps extends ShellProps {
  id: string;
  label: ComponentChildren;
  /** ISO "YYYY-MM-DD" or null. */
  value: string | null;
  onChange: (value: string | null) => void;
}

export function DateField(props: DateFieldProps) {
  const { id, label, value, onChange } = props;
  return (
    <div class="field">
      <Label id={id} heading={props.heading}>
        {label}
      </Label>
      <input
        id={id}
        class="input input-date"
        type="date"
        value={value ?? ''}
        aria-describedby={describedBy(id, props)}
        onInput={(e) => onChange(e.currentTarget.value || null)}
      />
      <Below {...props} id={id} />
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: ComponentChildren;
}

export interface ChoiceGroupProps<T extends string> extends ShellProps {
  name: string;
  legend: ComponentChildren;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Content the question is about (e.g. text quoted from a form), shown between it and the options. */
  description?: ComponentChildren;
  /** Follow-up content, shown directly under the options. */
  children?: ComponentChildren;
}

/** Native radios in a fieldset (YES/NO, NOT SURE, Residential/Vacation). */
export function ChoiceGroup<T extends string>(props: ChoiceGroupProps<T>) {
  const { name, legend, options, value, onChange, children, description } = props;
  const extra = description ? [`${name}-desc`] : [];
  return (
    <fieldset class="field choice" aria-describedby={describedBy(name, props, extra)}>
      <legend class="field-label">
        {props.heading ? (
          <h1 class="question" tabIndex={-1}>
            {legend}
          </h1>
        ) : (
          legend
        )}
      </legend>
      {description && (
        <div id={`${name}-desc`} class="choice-description">
          {description}
        </div>
      )}
      <Below {...props} id={name} />
      <div class="choice-options">
        {options.map((o) => (
          <label key={o.value} class="choice-option">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {children && <div class="follow-up">{children}</div>}
    </fieldset>
  );
}

export interface CheckboxFieldProps {
  id: string;
  label: ComponentChildren;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Extra text under the label (e.g. a neutral definition). */
  description?: ComponentChildren;
}

export function CheckboxField({ id, label, checked, onChange, description }: CheckboxFieldProps) {
  return (
    <div class="checkbox">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <label for={id}>{label}</label>
      {description && (
        <p id={`${id}-desc`} class="field-help checkbox-desc">
          {description}
        </p>
      )}
    </div>
  );
}

export interface TextListProps extends ShellProps {
  id: string;
  items: readonly string[];
  onChange: (items: string[]) => void;
  itemLabel: (n: number) => string;
  addLabel: string;
  removeLabel: (n: number) => string;
  autoComplete?: string;
}

/** A repeatable list of text inputs; always shows at least one. */
export function TextList(props: TextListProps) {
  const { id, items, onChange, itemLabel, addLabel, removeLabel, autoComplete } = props;
  const rows = items.length ? items : [''];
  const set = (i: number, v: string) => onChange(rows.map((r, j) => (j === i ? v : r)));
  return (
    <div class="list">
      {rows.map((item, i) => (
        <div class="list-row" key={i}>
          <TextField
            id={`${id}-${i}`}
            label={itemLabel(i + 1)}
            value={item}
            autoComplete={autoComplete}
            onInput={(v) => set(i, v)}
          />
          {rows.length > 1 && (
            <button
              type="button"
              class="button button-quiet"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              {removeLabel(i + 1)}
            </button>
          )}
        </div>
      ))}
      <button type="button" class="button button-secondary" onClick={() => onChange([...rows, ''])}>
        {addLabel}
      </button>
      <Below {...props} id={id} />
    </div>
  );
}

export function Notice({
  children,
  kind = 'info',
  onDismiss,
  dismissLabel,
}: {
  children: ComponentChildren;
  kind?: 'info' | 'warning';
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  return (
    <div class={`notice notice-${kind}`} role="note">
      <div class="notice-body">{children}</div>
      {onDismiss && (
        <button type="button" class="button button-quiet" onClick={onDismiss}>
          {dismissLabel}
        </button>
      )}
    </div>
  );
}

/** An external link that opens in a new tab (§12). */
export function ExternalLink({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
