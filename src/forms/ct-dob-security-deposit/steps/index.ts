// The wizard's step registry (CLAUDE.md §7), in order. Progress numbers are
// computed from `inProgress`, never hard-coded.

import en from '../../../i18n/en.json' with { type: 'json' };
import { Comments } from './Comments.tsx';
import { Disclaimer } from './Disclaimer.tsx';
import { Documents } from './Documents.tsx';
import { Money } from './Money.tsx';
import { MORE_QUESTIONS_COUNT, MoreQuestions } from './MoreQuestions.tsx';
import { Needs } from './Needs.tsx';
import { AboutYou, Landlord } from './Person.tsx';
import { Rental } from './Rental.tsx';
import { Review } from './Review.tsx';
import { Sign } from './Sign.tsx';
import { Situation } from './Situation.tsx';
import type { StepDef } from './types.ts';
import { Welcome } from './Welcome.tsx';

const s = en.steps;

export const STEPS: readonly StepDef[] = [
  { id: 'welcome', title: en.app.name, inProgress: false, Component: Welcome, hideNext: true },
  { id: 'situation', title: s.situation.title, inProgress: true, Component: Situation },
  { id: 'needs', title: s.needs.title, inProgress: true, Component: Needs },
  { id: 'aboutYou', title: s.aboutYou.title, inProgress: true, Component: AboutYou },
  { id: 'landlord', title: s.landlord.title, inProgress: true, Component: Landlord },
  { id: 'rental', title: s.rental.title, inProgress: true, Component: Rental },
  { id: 'money', title: s.money.title, inProgress: true, Component: Money },
  {
    id: 'moreQuestions',
    title: s.moreQuestions.title,
    inProgress: true,
    Component: MoreQuestions,
    subScreens: (narrow) => (narrow ? MORE_QUESTIONS_COUNT : 1),
  },
  { id: 'documents', title: s.documents.title, inProgress: true, Component: Documents },
  { id: 'comments', title: s.comments.title, inProgress: true, Component: Comments },
  {
    id: 'disclaimer',
    title: en.disclaimer.heading,
    inProgress: true,
    Component: Disclaimer,
    hideNext: true,
  },
  { id: 'review', title: s.review.title, inProgress: true, Component: Review },
  { id: 'sign', title: s.sign.title, inProgress: true, Component: Sign },
];
