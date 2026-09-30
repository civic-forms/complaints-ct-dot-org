// Schema → AcroForm field names and drawn coordinates for sdcompform-rev-2026.pdf
// (Rev 8/26). Field inventory: CLAUDE.md §5.2 (`pnpm form:dump`). When the State
// revises the form, this file and verbatim.json are what change (§5.3).

import type { ComplaintType } from './schema.ts';
import verbatim from './verbatim.json' with { type: 'json' };

const labels = verbatim.fieldLabels;
const q = verbatim.page1Labels;

/** Groups used to disambiguate repeated labels ("City/Town") on the continuation page. */
export type TextGroup = 'tenant' | 'landlord' | 'rental' | null;

export interface TextFieldEntry {
  /** Schema path the value comes from (the fill step formats it). */
  path: TextPath;
  field: string;
  /** The form's printed label, for the continuation page heading. */
  label: string;
  group: TextGroup;
  multiline?: true;
}

export type TextPath =
  | `tenant.${'name' | 'street' | 'city' | 'state' | 'zip' | 'daytimePhone' | 'email'}`
  | `landlord.${'name' | 'street' | 'city' | 'state' | 'zip' | 'daytimePhone' | 'email'}`
  | `rental.${
      | 'unitStreet'
      | 'housingComplexName'
      | 'city'
      | 'state'
      | 'zip'
      | 'moveInDate'
      | 'moveOutDate'
      | 'monthlyRentCents'
      | 'lastRentPaidDate'
      | 'securityDepositCents'
      | 'otherDepositCents'}`
  | 'questions.interestPaid.payments'
  | 'questions.depositReturned.amountCents'
  | 'questions.courtAction.docketNumber'
  | 'questions.roommates.names'
  | 'questions.landlordOtherProperties.addresses'
  | 'additionalComments';

export const TEXT_FIELDS: readonly TextFieldEntry[] = [
  { path: 'tenant.name', field: 'Your Name', label: labels.tenant.name, group: 'tenant' },
  { path: 'tenant.street', field: 'Your Address', label: labels.tenant.street, group: 'tenant' },
  { path: 'tenant.city', field: 'CityTown', label: labels.tenant.city, group: 'tenant' },
  { path: 'tenant.state', field: 'State', label: labels.tenant.state, group: 'tenant' },
  { path: 'tenant.zip', field: 'Zip Code', label: labels.tenant.zip, group: 'tenant' },
  {
    path: 'tenant.daytimePhone',
    field: 'Daytime Telephone Number',
    label: labels.tenant.daytimePhone,
    group: 'tenant',
  },
  {
    path: 'tenant.email',
    field: 'Email Address Optional',
    label: labels.tenant.email,
    group: 'tenant',
  },
  {
    path: 'landlord.name',
    field: 'Landlords Name',
    label: labels.landlord.name,
    group: 'landlord',
  },
  {
    path: 'landlord.street',
    field: 'Street Address',
    label: labels.landlord.street,
    group: 'landlord',
  },
  { path: 'landlord.city', field: 'CityTown_2', label: labels.landlord.city, group: 'landlord' },
  { path: 'landlord.state', field: 'State_2', label: labels.landlord.state, group: 'landlord' },
  { path: 'landlord.zip', field: 'Zip Code_2', label: labels.landlord.zip, group: 'landlord' },
  {
    path: 'landlord.daytimePhone',
    field: 'Daytime Telephone Number_2',
    label: labels.landlord.daytimePhone,
    group: 'landlord',
  },
  {
    path: 'landlord.email',
    field: 'Email Address Optional_2',
    label: labels.landlord.email,
    group: 'landlord',
  },
  {
    path: 'rental.unitStreet',
    field: 'Rental Unit Street Address',
    label: labels.rental.unitStreet,
    group: 'rental',
  },
  { path: 'rental.city', field: 'CityTown_3', label: labels.rental.city, group: 'rental' },
  { path: 'rental.state', field: 'State_3', label: labels.rental.state, group: 'rental' },
  { path: 'rental.zip', field: 'Zip Code_3', label: labels.rental.zip, group: 'rental' },
  {
    path: 'rental.housingComplexName',
    field: 'Name of Housing Complex if any',
    label: labels.rental.housingComplexName,
    group: 'rental',
  },
  {
    path: 'rental.moveInDate',
    field: 'Move In Date',
    label: labels.rental.moveInDate,
    group: 'rental',
  },
  {
    path: 'rental.moveOutDate',
    field: 'Move Out Date',
    label: labels.rental.moveOutDate,
    group: 'rental',
  },
  {
    path: 'rental.securityDepositCents',
    field: 'Amount of Security Deposit',
    label: labels.rental.securityDepositCents,
    group: 'rental',
  },
  {
    path: 'rental.otherDepositCents',
    field: 'Amount of any Other Deposit',
    label: labels.rental.otherDepositCents,
    group: 'rental',
  },
  {
    path: 'rental.monthlyRentCents',
    field: 'Amount of Monthly Rent',
    label: labels.rental.monthlyRentCents,
    group: 'rental',
  },
  {
    path: 'rental.lastRentPaidDate',
    field: 'Date You Last Paid Rent',
    label: labels.rental.lastRentPaidDate,
    group: 'rental',
  },
  // Follow-ups: rendered only when their question is YES (§6.2).
  { path: 'questions.interestPaid.payments', field: 'IfYes', label: q.interestPaid, group: null },
  {
    path: 'questions.depositReturned.amountCents',
    field: 'Yes Amount',
    label: q.depositReturned,
    group: null,
  },
  {
    path: 'questions.courtAction.docketNumber',
    field:
      'Has there been any court action involving this rental if YES enter docket number YES NO',
    label: q.courtAction,
    group: null,
  },
  {
    path: 'questions.roommates.names',
    field: 'Did you have roommates or corenters if YES please provide their names YES NO',
    label: q.roommates,
    group: null,
  },
  {
    path: 'questions.landlordOtherProperties.addresses',
    field: 'Does the landlord own other properties if YES list the address NO YES',
    label: q.landlordOtherProperties,
    group: null,
  },
  {
    path: 'additionalComments',
    field: 'Additional Comments Attach additional pages if necessary',
    label: q.additionalComments,
    group: null,
    multiline: true,
  },
];

/**
 * YES/NO questions: one checkbox field with two widgets whose on-values are
 * "Yes" and "No" (§5.2). Selected by setting /V and each widget's /AS.
 */
export type YesNoQuestion =
  | 'interestPaid'
  | 'correspondenceReceived'
  | 'depositReturned'
  | 'checkCashed'
  | 'courtAction'
  | 'roommates'
  | 'landlordOtherProperties';

export const YES_NO_FIELDS: Readonly<Record<YesNoQuestion, string>> = {
  interestPaid: 'Check Box8',
  correspondenceReceived: 'Check Box9',
  depositReturned: 'Check Box10',
  checkCashed: 'Check Box15', // follow-up of depositReturned (§7 step 6)
  courtAction: 'Check Box11',
  roommates: 'Check Box12',
  landlordOtherProperties: 'Check Box14',
};

export const YES_NO_ON_VALUES = { yes: 'Yes', no: 'No' } as const;

/** Type of Rental: one field, two widgets (single choice). */
export const TYPE_OF_RENTAL = {
  field: 'Check Box6',
  onValues: { residential: 'Yes', vacation: 'No' },
} as const;

/** Terms of Rental: two independent checkboxes ("check all that applied"). */
export const TERMS_FIELDS = { lease: 'Check Box7', monthToMonth: 'Check Box7a' } as const;

/** Cash for Keys: three independent checkboxes; the app keeps exactly one checked. */
export const CASH_FOR_KEYS_FIELDS = {
  yes: 'Check Box13a',
  no: 'Check Box13b',
  not_sure: 'Check Box13c',
} as const;

/** Page 2 complaint types, boxes 1–4. */
export const COMPLAINT_TYPE_FIELDS: Readonly<Record<ComplaintType, string>> = {
  formerTenantDepositNotReturned: 'Check1',
  currentTenant62PlusExcessOverOneMonth: 'Check2',
  currentTenantUnder62ExcessOverTwoMonths: 'Check3',
  currentTenantNoEscrowInfo: 'Check4',
};

/**
 * Fields the app never fills (maintainer decisions, §5.2):
 * - IfYes2: text field on the correspondence row; the printed question only
 *   asks the user to enclose a copy.
 * - Page 3 checklist boxes: the app can't verify that a required document is
 *   enclosed; the attachment index page lists what is.
 */
export const INTENTIONALLY_BLANK: readonly string[] = [
  'IfYes2',
  'Check Boxa',
  'Check Boxb',
  'Check Boxc',
  'Check Boxd',
  'Check Boxh',
  'Check Boxi',
  'Check Boxj',
  'Check Box1', // sic: the fourth box-2 line; the PDF names it this way
  'Check Boxl',
  'Check Boxm',
  'Check Boxn',
  'Check Boxp',
  'Check Boxq',
  'Check Boxt',
];

/**
 * Page 2 signature and date are printed underscores, not fields: drawn by
 * coordinates (PDF points, origin bottom-left). `pageIndex` is 0-based.
 * The printed line's baseline is y ≈ 171; the attestation sentence sits above
 * at y ≈ 207, so the signature stays below `top`.
 */
export const SIGNATURE_BOX = { pageIndex: 1, x: 94, bottom: 169, top: 204, maxWidth: 212 } as const;
export const SIGNED_DATE = { pageIndex: 1, x: 338, baseline: 173, size: 10 } as const;
