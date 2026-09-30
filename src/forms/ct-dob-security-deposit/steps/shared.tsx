// Pieces the pages share: chapter intros, the form's own text, legal help
// links, the complaint-type confirmation, and the upload slot placeholder.

import type { ComponentChildren } from 'preact';
import { ChoiceGroup, ExternalLink } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { deriveSlots, type SlotId } from '../checklist.ts';
import { LEGAL_HELP } from '../config.ts';
import type { ComplaintType } from '../schema.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import type { ChapterId } from './ids.ts';
import { kit } from './kit.ts';
import type { StepProps } from './types.ts';
import { APP_YES_NO } from './yesNo.ts';

/** A chapter's opening page: a sentence or two, then Continue. */
export function chapterIntro(chapter: ChapterId) {
  const text = (en.chapters[chapter] as { intro?: string }).intro ?? '';
  return function ChapterIntro() {
    return <p class="lead">{text}</p>;
  };
}

/** Text shown exactly as printed on the State's form (§2.2). */
export function FormText({ children }: { children: ComponentChildren }) {
  return (
    <div class="form-text">
      <p class="form-text-label">{en.common.formText}</p>
      <div class="verbatim">{children}</div>
    </div>
  );
}

export function LegalHelp({ heading = 'h2' }: { heading?: 'h2' | 'h3' }) {
  const H = heading;
  return (
    <section class="legal-help" aria-labelledby="legal-help-heading">
      <H id="legal-help-heading">{en.legalHelp.heading}</H>
      <p>{en.legalHelp.text}</p>
      <ul class="plain-list">
        {LEGAL_HELP.map((org) => (
          <li key={org.url}>
            <ExternalLink href={org.url}>{org.name}</ExternalLink>
            {'phone' in org && org.phone ? ` · ${org.phone}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The footnotes that go with a complaint type's asterisks ("*", "**"). */
export function footnotesFor(type: ComplaintType): string[] {
  const text = verbatim.complaintTypes[type];
  return verbatim.complaintFootnotes.filter((note) => {
    const marker = note.match(/^\*+/)?.[0];
    return marker !== undefined && text.split(/\s+/).includes(marker);
  });
}

/**
 * "Does this describe your situation?" for one complaint type, shown verbatim
 * with its footnotes under the question (so focus on the h1 reads it next). Only Yes checks the type on the form (§7 question
 * pattern). Yes/No only; the legal help links are always there.
 */
export function confirmType(type: ComplaintType) {
  return function ConfirmType(props: StepProps) {
    const k = kit(props);
    const notes = footnotesFor(type);
    const periodic = en.steps.periodicRent;
    return (
      <>
        <ChoiceGroup
          name={`confirm-${type}`}
          legend={en.pages.confirmQuestion}
          heading={true}
          description={
            <FormText>
              <p>{verbatim.complaintTypes[type]}</p>
              {notes.length > 0 && (
                <div class="footnotes">
                  {notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              )}
            </FormText>
          }
          help={
            // A neutral definition alongside the form's own words (§2.2).
            verbatim.complaintTypes[type].includes('periodic rent') ? (
              <>
                <strong>{periodic.periodicRentTerm}:</strong> {periodic.periodicRentDefinition}
              </>
            ) : undefined
          }
          options={APP_YES_NO}
          value={props.state.gates.confirmed[type]}
          onChange={(answer) =>
            k.patch('gates', { confirmed: { ...props.state.gates.confirmed, [type]: answer } })
          }
          errorId={k.errorId}
        />
        <LegalHelp />
      </>
    );
  };
}

/**
 * One evidence slot (§8.4). The same slot can appear on more than one page
 * (the forwarding-address slot is also on the Documents step); files will live
 * in one store keyed by slot id, so the packet index counts it once. Uploads
 * arrive in Phase 4.
 */
export function SlotUpload({ slotId, state }: { slotId: SlotId; state: StepProps['state'] }) {
  const slot = deriveSlots(state).find((s) => s.id === slotId);
  if (!slot) return null;
  return (
    <div class="slot">
      <p class={slot.appDefined ? 'slot-label' : 'slot-label verbatim'}>{slot.label}</p>
      {slot.hint && <p class="field-help">({slot.hint})</p>}
      {slot.help && <p class="field-help">{slot.help}</p>}
      {slot.note && <p class="field-help">{slot.note}</p>}
      <div class="slot-placeholder">{en.pages.slotPlaceholder}</div>
    </div>
  );
}
