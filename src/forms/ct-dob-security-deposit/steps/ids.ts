// Chapter and page ids (CLAUDE.md §7), in flow order. Kept apart from the page
// components so validation and (later) telemetry can use them without loading
// any UI. Page ids are `chapter.page` and name what the page holds (§4).

export const CHAPTER_IDS = [
  'situation',
  'deposit',
  'newAddress',
  'aboutYou',
  'landlord',
  'rental',
  'moreQuestions',
  'documents',
  'comments',
  'disclaimer',
  'review',
  'sign',
  'send',
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

export const STEP_IDS = [
  'welcome',

  'situation.intro',
  'situation.movedOut',
  'situation.age62OrOlder',
  'situation.overLimitHeld',
  'situation.confirm.currentTenant62PlusExcessOverOneMonth',
  'situation.confirm.currentTenantUnder62ExcessOverTwoMonths',
  'situation.confirm.currentTenantNoEscrowInfo',
  'situation.noTypeNote',

  'deposit.intro',
  'deposit.monthlyRent',
  'deposit.securityDeposit',
  'deposit.otherDepositPaid',
  'deposit.otherDeposit',
  'deposit.depositReturned',
  'deposit.returnedAmount',
  'deposit.checkCashed',
  'deposit.fullAmountReturned',
  'deposit.confirm.formerTenantDepositNotReturned',
  'deposit.noTypeNote',
  'deposit.interestPaid',
  'deposit.interestPayments',
  'deposit.neededDocs',

  'newAddress.intro',
  'newAddress.fwdGiven',
  'newAddress.fwdInWriting',
  'newAddress.fwdProofAvailable',
  'newAddress.forwardingAddressSlot',

  'aboutYou.intro',
  'aboutYou.name',
  'aboutYou.address',
  'aboutYou.phone',
  'aboutYou.email',

  'landlord.intro',
  'landlord.name',
  'landlord.address',
  'landlord.phone',
  'landlord.email',

  'rental.intro',
  'rental.address',
  'rental.housingComplex',
  'rental.typeOfRental',
  'rental.terms',
  'rental.moveIn',
  'rental.moveOut',
  'rental.lastRentPaid',

  'moreQuestions.intro',
  'moreQuestions.cashForKeys',
  'moreQuestions.roommates',
  'moreQuestions.roommateNames',
  'moreQuestions.otherProperties',
  'moreQuestions.propertyAddresses',
  'moreQuestions.correspondence',
  'moreQuestions.courtAction',
  'moreQuestions.docketNumber',

  'documents.intro',
  'documents.depositProof',
  'documents.rentalAgreement',
  'documents.correspondence',
  'documents.forwardingAddress',
  'documents.proofOfAge',
  'documents.overageLetter62',
  'documents.overageLetter',
  'documents.escrowLetter',
  'documents.certifiedMailReceipt',
  'documents.certifiedMailReturnReceipt',
  'documents.cashForKeysAgreement',
  'documents.other',

  'comments',
  'disclaimer',
  'review',
  'review.moreInfoNeeded',
  'sign.statements',
  'sign.signature',
  'send',
  'confirmation',
] as const;

export type StepId = (typeof STEP_IDS)[number];
