// Form-specific configuration (CLAUDE.md §12).

export const DOB = {
  email: 'DOB.SD@CT.GOV',
  phones: ['860-240-8170', '1-800-831-7225'], // from DOB web page
  formPhone: '(860) 240-8154', // printed on the form; discrepancy noted (§18)
  complaintPage:
    'https://portal.ct.gov/dob/consumer/consumer-complaints/rental-security-deposit-complaints',
  tenantLandlordEducation:
    'https://portal.ct.gov/dob/rental-security-deposits/rental-security-deposits/rental-security-deposits',
};

// Maintainer switch. The app can't detect a new form itself (no network requests),
// so this is flipped by hand with a one-line commit while §5.3 is in progress.
export const formUpdatePending = false;

export const LEGAL_HELP = [
  {
    name: 'Statewide Legal Services of Connecticut',
    url: 'https://www.slsct.org/',
    phone: '(800) 453-3320',
  },
  { name: 'CTLawHelp.org', url: 'https://ctlawhelp.org/' },
  {
    name: 'Volunteer Small Claims Attorney Program',
    url: 'https://jud.ct.gov/volunteer_atty_prgm.htm',
  },
  {
    name: 'County Bar Lawyer Referral Services',
    url: 'https://www.ctbar.org/public/pro-bono-legal-aid-services',
  },
];

/** File in ./template/. Update together with template.sha256 (§5.3). */
export const TEMPLATE_FILENAME = 'sdcompform-rev-2026.pdf';

/**
 * Disclaimer text version (§10). "v0" during development; "v1" at launch, then
 * bumped on every text change. No PDF is built until this version is accepted.
 */
export const DISCLAIMER_VERSION = 'v0';

/**
 * The packet's size before attachments, for the live size meter (§8.5). A
 * signed packet with no attachments is about 329 KB (`pnpm samples`); rounded
 * up so the estimate errs high. Review shows the real size of the built PDF.
 */
export const FORM_OVERHEAD_BYTES = 340 * 1024;
