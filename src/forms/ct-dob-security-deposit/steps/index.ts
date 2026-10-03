// The wizard's page registry (CLAUDE.md §7): pages.ts (order, relevance,
// answers, fills) plus each page's title and component. Question pages have no
// title: their question is the h1.

import type { FunctionComponent } from 'preact';
import en from '../../../i18n/en.json' with { type: 'json' };
import { Comments } from './Comments.tsx';
import { Confirmation } from './Confirmation.tsx';
import { Disclaimer } from './Disclaimer.tsx';
import {
  CheckCashed,
  DepositReturned,
  FullAmountReturned,
  InterestPaid,
  InterestPayments,
  MonthlyRent,
  NeededDocs,
  OtherDeposit,
  OtherDepositPaid,
  ReturnedAmount,
  SecurityDeposit,
} from './deposit.tsx';
import { DocumentsIntro, slotPage } from './documents.tsx';
import type { StepId } from './ids.ts';
import {
  CashForKeys,
  Correspondence,
  CourtAction,
  DocketNumber,
  OtherProperties,
  PropertyAddresses,
  RoommateNames,
  Roommates,
} from './more-questions.tsx';
import {
  ForwardingAddressSlot,
  FwdGiven,
  FwdInWriting,
  FwdProofAvailable,
} from './new-address.tsx';
import { PAGE_SPECS } from './pages.ts';
import {
  LandlordAddress,
  LandlordEmail,
  LandlordName,
  LandlordPhone,
  TenantAddress,
  TenantEmail,
  TenantName,
  TenantPhone,
} from './person.tsx';
import { MoreInfoNeeded, Review } from './Review.tsx';
import {
  HousingComplex,
  LastRentPaid,
  MoveIn,
  MoveOut,
  RentalAddress,
  Terms,
  TypeOfRental,
} from './rental.tsx';
import { Send } from './Send.tsx';
import { chapterIntro, confirmType } from './shared.tsx';
import { Signature, Statements } from './sign.tsx';
import { Age62OrOlder, MovedOut, NoTypeNote, OverLimitHeld } from './situation.tsx';
import type { PageDef, StepProps } from './types.ts';
import { Welcome } from './Welcome.tsx';

const c = en.chapters;
const p = en.pages;

type Entry = { Component: FunctionComponent<StepProps>; title?: string; hideNext?: boolean };

const PAGE_UI: Record<StepId, Entry> = {
  welcome: { Component: Welcome, hideNext: true },

  'situation.intro': { Component: chapterIntro('situation'), title: c.situation.title },
  'situation.movedOut': { Component: MovedOut },
  'situation.age62OrOlder': { Component: Age62OrOlder },
  'situation.overLimitHeld': { Component: OverLimitHeld },
  'situation.confirm.currentTenant62PlusExcessOverOneMonth': {
    Component: confirmType('currentTenant62PlusExcessOverOneMonth'),
  },
  'situation.confirm.currentTenantUnder62ExcessOverTwoMonths': {
    Component: confirmType('currentTenantUnder62ExcessOverTwoMonths'),
  },
  'situation.confirm.currentTenantNoEscrowInfo': {
    Component: confirmType('currentTenantNoEscrowInfo'),
  },
  'situation.noTypeNote': { Component: NoTypeNote },

  'deposit.intro': { Component: chapterIntro('deposit'), title: c.deposit.title },
  'deposit.monthlyRent': { Component: MonthlyRent },
  'deposit.securityDeposit': { Component: SecurityDeposit },
  'deposit.otherDepositPaid': { Component: OtherDepositPaid },
  'deposit.otherDeposit': { Component: OtherDeposit },
  'deposit.depositReturned': { Component: DepositReturned },
  'deposit.returnedAmount': { Component: ReturnedAmount },
  'deposit.checkCashed': { Component: CheckCashed },
  'deposit.fullAmountReturned': { Component: FullAmountReturned },
  'deposit.confirm.formerTenantDepositNotReturned': {
    Component: confirmType('formerTenantDepositNotReturned'),
  },
  'deposit.noTypeNote': { Component: NoTypeNote },
  'deposit.interestPaid': { Component: InterestPaid },
  'deposit.interestPayments': { Component: InterestPayments },
  'deposit.neededDocs': { Component: NeededDocs, title: en.steps.needs.title },

  'newAddress.intro': { Component: chapterIntro('newAddress'), title: c.newAddress.title },
  'newAddress.fwdGiven': { Component: FwdGiven },
  'newAddress.fwdInWriting': { Component: FwdInWriting },
  'newAddress.fwdProofAvailable': { Component: FwdProofAvailable },
  'newAddress.forwardingAddressSlot': { Component: ForwardingAddressSlot, title: p.slotTitle },

  'aboutYou.intro': { Component: chapterIntro('aboutYou'), title: c.aboutYou.title },
  'aboutYou.name': { Component: TenantName },
  'aboutYou.address': { Component: TenantAddress, title: p.tenantAddress },
  'aboutYou.phone': { Component: TenantPhone },
  'aboutYou.email': { Component: TenantEmail },

  'landlord.intro': { Component: chapterIntro('landlord'), title: c.landlord.title },
  'landlord.name': { Component: LandlordName },
  'landlord.address': { Component: LandlordAddress, title: p.landlordAddress },
  'landlord.phone': { Component: LandlordPhone },
  'landlord.email': { Component: LandlordEmail },

  'rental.intro': { Component: chapterIntro('rental'), title: c.rental.title },
  'rental.address': { Component: RentalAddress, title: p.rentalAddress },
  'rental.housingComplex': { Component: HousingComplex },
  'rental.typeOfRental': { Component: TypeOfRental },
  'rental.terms': { Component: Terms },
  'rental.moveIn': { Component: MoveIn },
  'rental.moveOut': { Component: MoveOut },
  'rental.lastRentPaid': { Component: LastRentPaid },

  'moreQuestions.intro': { Component: chapterIntro('moreQuestions'), title: c.moreQuestions.title },
  'moreQuestions.cashForKeys': { Component: CashForKeys },
  'moreQuestions.roommates': { Component: Roommates },
  'moreQuestions.roommateNames': { Component: RoommateNames },
  'moreQuestions.otherProperties': { Component: OtherProperties },
  'moreQuestions.propertyAddresses': { Component: PropertyAddresses },
  'moreQuestions.correspondence': { Component: Correspondence },
  'moreQuestions.courtAction': { Component: CourtAction },
  'moreQuestions.docketNumber': { Component: DocketNumber },

  'documents.intro': { Component: DocumentsIntro, title: c.documents.title },
  'documents.depositProof': { Component: slotPage('depositProof'), title: p.slotTitle },
  'documents.rentalAgreement': { Component: slotPage('rentalAgreement'), title: p.slotTitle },
  'documents.correspondence': { Component: slotPage('correspondence'), title: p.slotTitle },
  'documents.forwardingAddress': { Component: slotPage('forwardingAddress'), title: p.slotTitle },
  'documents.proofOfAge': { Component: slotPage('proofOfAge'), title: p.slotTitle },
  'documents.overageLetter62': { Component: slotPage('overageLetter62'), title: p.slotTitle },
  'documents.overageLetter': { Component: slotPage('overageLetter'), title: p.slotTitle },
  'documents.escrowLetter': { Component: slotPage('escrowLetter'), title: p.slotTitle },
  'documents.certifiedMailReceipt': {
    Component: slotPage('certifiedMailReceipt'),
    title: p.slotTitle,
  },
  'documents.certifiedMailReturnReceipt': {
    Component: slotPage('certifiedMailReturnReceipt'),
    title: p.slotTitle,
  },
  'documents.cashForKeysAgreement': {
    Component: slotPage('cashForKeysAgreement'),
    title: p.slotTitle,
  },
  'documents.other': { Component: slotPage('other'), title: p.slotTitle },

  comments: { Component: Comments, title: c.comments.title },
  disclaimer: { Component: Disclaimer, title: en.disclaimer.heading, hideNext: true },
  review: { Component: Review, title: c.review.title },
  'review.moreInfoNeeded': { Component: MoreInfoNeeded, title: p.moreInfoNeededTitle },
  'sign.statements': { Component: Statements, title: c.sign.title },
  'sign.signature': { Component: Signature, title: c.sign.title },
  send: { Component: Send, title: c.send.title },
  confirmation: { Component: Confirmation, title: en.steps.confirmation.title, hideNext: true },
};

export const PAGES: readonly PageDef[] = PAGE_SPECS.map((spec) => ({
  ...spec,
  ...PAGE_UI[spec.id],
}));
