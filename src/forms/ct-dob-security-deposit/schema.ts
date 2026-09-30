// State schema (CLAUDE.md §6.1).

export type YesNo = 'yes' | 'no' | null;
export type YesNoNotSure = 'yes' | 'no' | 'not_sure' | null;
/** "YYYY-MM-DD" */
export type ISODate = string | null;
/** Integer cents. */
export type Cents = number | null;

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface ComplaintTypes {
  formerTenantDepositNotReturned: boolean;
  currentTenant62PlusExcessOverOneMonth: boolean;
  currentTenantUnder62ExcessOverTwoMonths: boolean;
  currentTenantNoEscrowInfo: boolean;
}

export type ComplaintType = keyof ComplaintTypes;

/** The form's order (page 2) and the checklist's (page 3). */
export const COMPLAINT_TYPES: readonly ComplaintType[] = [
  'formerTenantDepositNotReturned',
  'currentTenant62PlusExcessOverOneMonth',
  'currentTenantUnder62ExcessOverTwoMonths',
  'currentTenantNoEscrowInfo',
];

export type Person = Address & { name: string; daytimePhone: string; email: string };

export interface DepositComplaintState {
  meta: {
    schemaVersion: 1;
    formId: 'ct-dob-security-deposit';
    formVariant: 'en';
    formRevision: 'Rev 8/26';
    disclaimerVersion: string | null;
    disclaimerAcceptedAt: string | null; // ISO timestamp
    storageMode: 'session' | 'device' | null;
    savedAt: string | null; // ISO timestamp, drives 30-day expiry
  };
  /**
   * Printed on the form. Derived from `gates` by normalizeGates() (situation.ts)
   * on every update; never set directly by the wizard.
   */
  complaintTypes: ComplaintTypes;
  /**
   * App-only answers (§6.1, §7 question pattern). Never printed, never shown on
   * Review. They decide which pages appear and which types can be confirmed.
   */
  gates: {
    movedOut: YesNo;
    age62OrOlder: YesNo;
    overLimitHeld: YesNoNotSure;
    bankInfoGiven: YesNoNotSure;
    fullAmountReturned: YesNoNotSure;
    /** No prints $0.00 in Amount of any Other Deposit (the user's own answer, §2.2). */
    otherDepositPaid: YesNo;
    /** "Does this describe your situation?" Cleared when the type becomes unreachable. */
    confirmed: Record<ComplaintType, YesNo>;
  };
  /** App-only: the forwarding-address questions for former tenants. */
  forwardingAddress: {
    fwdGiven: YesNo;
    fwdInWriting: YesNoNotSure;
    fwdProofAvailable: YesNoNotSure;
  };
  tenant: Person;
  landlord: Person;
  rental: {
    unitStreet: string;
    housingComplexName: string;
    city: string;
    state: string;
    zip: string; // state defaults "CT"
    typeOfRental: 'residential' | 'vacation' | null;
    terms: { lease: boolean; monthToMonth: boolean };
    moveInDate: ISODate;
    moveOutDate: ISODate;
    monthlyRentCents: Cents;
    lastRentPaidDate: ISODate;
    securityDepositCents: Cents;
    otherDepositCents: Cents;
  };
  questions: {
    cashForKeys: { answer: YesNoNotSure };
    depositReturned: { answer: YesNo; amountCents: Cents; checkCashed: YesNo };
    landlordOtherProperties: { answer: YesNo; addresses: string[] };
    interestPaid: {
      answer: YesNo;
      payments: { date: ISODate; amountCents: Cents }[];
    };
    roommates: { answer: YesNo; names: string[] };
    correspondenceReceived: { answer: YesNo };
    courtAction: { answer: YesNo; docketNumber: string };
  };
  additionalComments: string;
  /**
   * Read and sign (§7 step 12). None of this is persisted (§9.2): the signature
   * is re-drawn, the statements re-acknowledged, and the date reset to today.
   */
  signature: { pngDataUrl: string | null; signedDate: ISODate; statementsRead: boolean };
}

const emptyPerson = (): Person => ({
  name: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  daytimePhone: '',
  email: '',
});

export function initialState(): DepositComplaintState {
  return {
    meta: {
      schemaVersion: 1,
      formId: 'ct-dob-security-deposit',
      formVariant: 'en',
      formRevision: 'Rev 8/26',
      disclaimerVersion: null,
      disclaimerAcceptedAt: null,
      storageMode: null,
      savedAt: null,
    },
    complaintTypes: {
      formerTenantDepositNotReturned: false,
      currentTenant62PlusExcessOverOneMonth: false,
      currentTenantUnder62ExcessOverTwoMonths: false,
      currentTenantNoEscrowInfo: false,
    },
    gates: {
      movedOut: null,
      age62OrOlder: null,
      overLimitHeld: null,
      bankInfoGiven: null,
      fullAmountReturned: null,
      otherDepositPaid: null,
      confirmed: {
        formerTenantDepositNotReturned: null,
        currentTenant62PlusExcessOverOneMonth: null,
        currentTenantUnder62ExcessOverTwoMonths: null,
        currentTenantNoEscrowInfo: null,
      },
    },
    forwardingAddress: { fwdGiven: null, fwdInWriting: null, fwdProofAvailable: null },
    // Tenant state stays blank: many former tenants have moved out of state.
    tenant: emptyPerson(),
    landlord: emptyPerson(),
    rental: {
      unitStreet: '',
      housingComplexName: '',
      city: '',
      state: 'CT',
      zip: '',
      typeOfRental: null,
      terms: { lease: false, monthToMonth: false },
      moveInDate: null,
      moveOutDate: null,
      monthlyRentCents: null,
      lastRentPaidDate: null,
      securityDepositCents: null,
      otherDepositCents: null,
    },
    questions: {
      cashForKeys: { answer: null },
      depositReturned: { answer: null, amountCents: null, checkCashed: null },
      landlordOtherProperties: { answer: null, addresses: [] },
      interestPaid: { answer: null, payments: [] },
      roommates: { answer: null, names: [] },
      correspondenceReceived: { answer: null },
      courtAction: { answer: null, docketNumber: '' },
    },
    additionalComments: '',
    signature: { pngDataUrl: null, signedDate: null, statementsRead: false },
  };
}
