# CLAUDE.md — [App Name]

> **App name is undecided** (chosen closer to launch). In UI copy and legal text
> it appears as `{appName}`, filled from `i18n/en.json` → `app.name`. Until then
> `app.name` = "Security Deposit Helper (working name)". Never hard-code the
> name anywhere else. Operator: **[Operator Name]**. Repo: **[repo URL]**.
> Planned host: a subdomain of `complaintsct.org` (e.g. `deposits.complaintsct.org`
> or `housing.complaintsct.org/security-deposits` — base path is configurable).

This file is the source of truth for architecture and product decisions. Read it
fully before making changes. If an implementation detail here turns out to be
wrong (e.g. the form's field layout), stop and report it rather than silently
working around it.

**Keep this file current.** When a decision is made or an open question is
answered (e.g. the Phase 1 field inventory), update this file in the same commit
as the code that depends on it, so it always describes the app as built. Changes
to §2 (constraints), §10 (disclaimer), §11 (security headers), or §19
(telemetry) need explicit maintainer approval first; propose them, don't just
make them.

---

## 1. What this is

A free, open-source, mobile-first static web app that helps Connecticut tenants
prepare the State of Connecticut Department of Banking (DOB) **Rental Security
Deposit Complaint Form** (Rev 8/26), attach their supporting documents, and send
the resulting single PDF from **their own email account** to `DOB.SD@CT.GOV`.

The app is a **digital typewriter and compiler**: the user types every answer,
the app places those answers on the official form, compresses and appends their
evidence, and hands the finished packet to their mail app.

---

## 2. Non-negotiable constraints

These are hard rules. Do not relax them without an explicit instruction from the
maintainer.

### 2.1 Nothing to steal (security by design)

- **No backend.** Static files only. No server functions, no API routes, no database.
- **No accounts, no sign-in, no cookies, no third-party scripts, no CDNs, no
  error-monitoring SDKs, no session replay, no heatmaps, no fingerprinting.** All
  fonts and libraries are bundled and served from the same origin.
- **Nothing the user types or uploads ever leaves the device** except in the
  email the user sends themselves.
- **Anonymous telemetry is allowed only as defined in §19**: allowlisted event
  names and enum/pattern-validated properties, sent by our own tiny sender (no
  vendor script) to exactly one analytics endpoint.
- **The only network request after load is that telemetry endpoint.** Enforced by
  CSP `connect-src` listing only that origin, or `'none'` when telemetry is
  unconfigured (see §11). Any other feature needing a network request is out of
  scope.
- The app must work identically with telemetry disabled. Telemetry failures are
  swallowed silently and never affect the user.
- All PDF generation, image processing, and storage happen in the browser.
- Ensure Cloudflare's automatic Web Analytics beacon injection is **disabled** on
  the Pages project (it would load a third-party script and break the CSP).

### 2.1a Runs for free

Operating cost must be effectively $0 beyond the domain registration.

- Hosting: Cloudflare Pages free tier. CI: GitHub Actions (free for public repos).
- Analytics: a free tier or free-for-non-commercial plan only (§19.1). If free
  limits are ever exceeded, telemetry is turned off by unsetting its env var;
  the app keeps working.
- No paid services, no services that require a credit card to stay running, and
  no self-hosted servers.

### 2.2 Unauthorized Practice of Law (UPL) guardrails

The app must never make legal choices for the user.
The line is legal _advice_ (applying the law to this user's facts), not
information in general.

- The user selects every complaint type and answers every question. **Never
  pre-select, recommend, or compute** a complaint type or a factual answer (e.g.
  do not compare deposit to rent and suggest box 3).
  **Allowed:** formatting and convenience defaults (rental state `"CT"`, signature
  date = today, phone/money/date formatting) and reusing information the user
  already entered elsewhere in the wizard.
- **No generated narrative.** Additional Comments and all free-text fields contain
  only what the user typed. No AI, no templates, no example sentences, no
  sentence starters (e.g. never "My landlord failed to…").
  **Allowed:** neutral prompts such as "Anything else you want the Department to
  know, in your own words."
- Text the user checks or signs (complaint types, footnotes, page 2 statements,
  attestation, checklist labels, forwarding-address note) is shown **verbatim**
  from `verbatim.json`, never replaced, paraphrased, or translated by the app.
  **Allowed:** a neutral plain-language definition shown _alongside_ the verbatim
  text (e.g. "Periodic rent: your regular rent payment"), never in place of it.
- Help text may: restate the form's own instructions; neutrally define a term;
  say where to find information ("The docket number is printed at the top of
  court papers"); or link to official and legal-aid sources (§12, plus DOB's
  Tenant/Landlord Education page). The app does **not** write its own summaries
  of the law (e.g. deadlines, penalties), because they go stale when the law
  changes. Help text must never say what the user _should_ claim, write, or
  choose.
- Validation may flag **logical inconsistencies** neutrally (see §6.3) but must
  not block on them or suggest which answer is correct.
- The evidence checklist is derived mechanically from the form's own page 3
  checklist and the user's own answers. That's the form's instructions, not strategy.

### 2.3 Low maintenance

- Minimal dependencies (see §3). Prefer platform features over libraries.
- Everything that changes when the state revises the form lives in
  `src/forms/ct-dob-security-deposit/` as config/data, not scattered logic.

---

## 3. Tech stack

| Concern           | Choice                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Language          | TypeScript, `strict: true`                                                                                                   |
| Build             | Vite                                                                                                                         |
| UI                | Preact (hooks; no router library — wizard step is state)                                                                     |
| Styling           | Plain CSS with custom properties (design tokens). No CSS framework, no component library                                     |
| PDF               | `pdf-lib` + `@pdf-lib/fontkit`                                                                                               |
| Font              | Noto Sans (OFL), bundled locally, embedded with `subset: true`                                                               |
| Signature         | Hand-written canvas component (Pointer Events) — no library                                                                  |
| Image compression | Hand-written canvas pipeline — no library                                                                                    |
| Lint/format       | Biome                                                                                                                        |
| Unit tests        | Vitest                                                                                                                       |
| E2E               | Playwright, **one** smoke test, WebKit project only                                                                          |
| Package manager   | pnpm, version pinned via `packageManager` in `package.json`; committed `pnpm-lock.yaml`. Supply-chain settings in §3.1       |
| Node              | Pinned in `.nvmrc` (current LTS)                                                                                             |
| Hosting           | Cloudflare Pages free tier, building from the repo via its Git integration (headers generated into `dist/_headers`)          |
| Telemetry         | Hand-written sender (`fetch` keepalive / `sendBeacon`) to a cookieless analytics tool chosen later (§19). No vendor SDK      |
| Source maps       | `build.sourcemap: true` — deployed publicly (the source is public anyway; lets anyone verify the live code matches the repo) |
| CI                | GitHub Actions                                                                                                               |
| License           | MIT                                                                                                                          |

Runtime dependencies are limited to: `preact`, `pdf-lib`, `@pdf-lib/fontkit`.
Adding any other runtime dependency requires maintainer approval.

### 3.1 pnpm supply-chain settings

In `pnpm-workspace.yaml` (or `.npmrc`, per the pinned pnpm version's docs):

- `minimumReleaseAge: 1440` (1 day). Do not raise it much: it also delays
  security patches, and when set explicitly pnpm enforces it strictly (installs
  fail rather than fall back). A Dependabot security PR for a same-day release may
  fail CI until the release is a day old; that's expected, re-run it.
- Dependency lifecycle/install scripts stay blocked (pnpm default). Keep the
  build-script allowlist empty unless something genuinely breaks; any addition
  requires maintainer approval.

### 3.2 package.json scripts (maintainer utilities)

```json
"watcher:status": "gh workflow view form-watch.yml",
"watcher:enable": "gh workflow enable form-watch.yml && gh workflow run form-watch.yml"
```

These need the GitHub CLI installed locally and `gh auth login` once. They are
not project dependencies. Document them in the README's maintenance section.

Browser targets: roughly the last two years of Safari/iOS (16+), Chrome, Firefox,
Edge. Accessibility target: **WCAG 2.1 AA**.

---

## 4. Repository layout

```
/
├─ CLAUDE.md
├─ README.md
├─ LICENSE                      (MIT)
├─ .nvmrc
├─ package.json                 (packageManager: pnpm@<pinned>)
├─ pnpm-workspace.yaml          (supply-chain settings, §3.1)
├─ biome.json
├─ vite.config.ts               (base path from env: VITE_BASE_PATH, default "/";
│                                sourcemap true; injects VITE_APP_VERSION = short
│                                git commit SHA)
├─ public/
│  └─ fonts/NotoSans-*.ttf
├─ scripts/
│  ├─ dump-form-fields.ts       (Phase 1: AcroForm inventory)
│  ├─ extract-form-text.ts      (Phase 1: verify verbatim.json; dev-only)
│  └─ gen-headers.ts            (post-build: writes dist/_headers with CSP, §11)
├─ src/
│  ├─ main.tsx
│  ├─ app/                      (app shell, wizard controller, step registry)
│  ├─ core/                     (form-agnostic, reusable across future tools)
│  │  ├─ pdf/                   (packet assembly, text fitting, exhibit pages, index page)
│  │  ├─ images/                (decode, orient, resize, compress)
│  │  ├─ signature/             (canvas pad → trimmed PNG)
│  │  ├─ send/                  (share sheet, mailto, .eml builder)
│  │  ├─ storage/               (draftStore interface + session/IndexedDB backends)
│  │  ├─ erase/                 (erase routine + dialog)
│  │  ├─ format/                (dates, money, phone)
│  │  ├─ telemetry/             (events.ts allowlist, sender, error capture, §19)
│  │  └─ ui/                    (shared field components)
│  ├─ forms/
│  │  └─ ct-dob-security-deposit/
│  │     ├─ template/
│  │     │  ├─ sdcompform-rev-2026.pdf
│  │     │  └─ template.sha256
│  │     ├─ schema.ts           (state types + initial state)
│  │     ├─ fieldMap.ts         (schema path → AcroForm field OR coordinates)
│  │     ├─ verbatim.json       (exact form text shown in UI)
│  │     ├─ checklist.ts        (derive evidence slots from state)
│  │     ├─ validation.ts
│  │     ├─ steps/              (wizard step components)
│  │     └─ config.ts           (DOB email, phones, form URL, filename pattern)
│  ├─ i18n/
│  │  └─ en.json                (ALL UI strings; no hard-coded copy in components)
│  └─ styles/
│     ├─ tokens.css
│     └─ base.css
├─ tests/
│  ├─ unit/
│  ├─ fixtures/                 (sample states, sample images/PDFs)
│  └─ e2e/smoke.spec.ts
└─ .github/
   ├─ workflows/ci.yml
   ├─ workflows/form-watch.yml
   └─ dependabot.yml
```

**Core vs. form boundary:** `src/core/` must not import from `src/forms/`. A future
tool (or the Spanish form in v2) adds a new folder under `src/forms/` and reuses
core. Do **not** build a generic form-definition framework now; just keep the
boundary clean.

**i18n:** v1 is English only, but all UI copy goes through `i18n/en.json` and
state includes `meta.formVariant: "en"` so a Spanish variant (official DOB
Spanish form, separate field map and verbatim file) can be added later without
refactoring.

---

## 5. The official form

- Source page: https://portal.ct.gov/dob/consumer/consumer-complaints/rental-security-deposit-complaints
- File: `sdcompform-rev-2026.pdf`, footer "Rev 8/26". 3 pages, US Letter.
  - Page 1: tenant, landlord, rental info, yes/no questions, additional comments.
  - Page 2: complaint types, acknowledgments, signature, date.
  - Page 3: documentation checklist (no fields; include it unchanged in the packet).
- The template is **committed to the repo** with its SHA-256. Never fetch it at
  runtime. At app start (dev builds) and in tests, verify the hash.

### 5.1 Known form rules

- **Dates must be `MM/DD/YY`** (two-digit year). Store ISO `YYYY-MM-DD`; format
  only at render.
- "Type or print clearly in dark ink" → render all text in black, ≥ 9pt where
  space allows (auto-shrink down to 7pt minimum before overflowing, §8.3).
- "Terms of Rental (check all that applied)" → Lease and Month-To-Month are
  **independent** checkboxes.
- The DOB web page says complainants must complete all items. Where users don't
  know an answer (e.g. landlord phone), let them type "Unknown" rather than
  leaving it blank.
- Email is an accepted submission method per the form header.

### 5.2 Unknowns to resolve in Phase 1 (do not guess)

1. Is the PDF an AcroForm with fillable fields? Field names, types, pages,
   rects, checkbox export values?
2. Which yes/no question has the third **NOT SURE** option? (Spanish version
   suggests Cash for Keys; confirm on English.)
3. Is Type of Rental (Residential / Vacation) a single choice or two checkboxes?
4. Exact positions of any field not represented in the AcroForm.

Record the answers in `fieldMap.ts` and update §5.2 of this file.

### 5.3 When the State publishes a new form revision

Nothing here runs automatically. The form watcher (§16) only opens an issue.
This procedure starts only when the maintainer, in a Claude Code session, asks
to "handle issue #N"; then follow these steps in order.

1. **Replace, don't archive.** Download the new PDF from the URL in the issue,
   save it in `template/` under its new filename, delete the old file in the same
   commit, and update `template.sha256`, `meta.formRevision`, and the filename in
   config. Git history is the archive; never keep old revisions in the working
   tree. For comparison, read the previous revision temporarily from git
   (`git show <old-commit>:<path>`), and don't commit it back.
2. **Inventory and stop.** Rerun `dump-form-fields.ts` and `extract-form-text.ts`
   on both revisions and report the differences, classified as: text-only
   changes; fields moved or resized; fields added or removed; checklist or page 2
   statement changes. **Stop for maintainer review**, as in Phase 1.
3. **Apply, based on the review:**
   - Text only → update `verbatim.json` (and `fieldLabels`).
   - Fields moved → update `fieldMap.ts`.
   - Fields added/removed → update `schema.ts`, the relevant wizard steps,
     `checklist.ts`, and validation. Bump `meta.schemaVersion` and add a
     migration so saved drafts from the old revision still load, with new
     questions shown as unanswered and removed fields dropped.
   - Changes to complaint types, page 2 statements, attestation, or checklist are
     §2.2 verbatim text: show the maintainer the exact before/after.
4. **Verify.** Run all tests, generate sample packets from the fixtures, and stop
   for the maintainer's visual check of the PDFs before merging.
5. **Record.** Add a row to the README's form revision log (revision, date
   adopted, commit), update §5 and §13 of this file, and set
   `formUpdatePending` back to `false` (§12) if it was turned on. Close the issue.

---

## 6. State schema

### 6.1 Types (`schema.ts`)

```ts
type YesNo = 'yes' | 'no' | null;
type YesNoNotSure = 'yes' | 'no' | 'not_sure' | null; // apply to whichever question the dump shows
type ISODate = string | null; // "YYYY-MM-DD"
type Cents = number | null; // integer cents

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface DepositComplaintState {
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
  complaintTypes: {
    formerTenantDepositNotReturned: boolean; // box 1
    currentTenant62PlusExcessOverOneMonth: boolean; // box 2
    currentTenantUnder62ExcessOverTwoMonths: boolean; // box 3
    currentTenantNoEscrowInfo: boolean; // box 4
  };
  tenant: Address & { name: string; daytimePhone: string; email: string };
  landlord: Address & { name: string; daytimePhone: string; email: string };
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
  signature: { pngDataUrl: string | null; signedDate: ISODate };
}
```

Tenant `state` defaults to `""` (many former tenants have moved out of state).
Rental `state` defaults to `"CT"`.

### 6.2 Follow-up field rule

If an answer changes from YES to NO, **keep** follow-up values in state (in case
they switch back) but **do not render** them on the PDF and do not require their
evidence slots.

### 6.3 Validation

**Hard-required** (block **Send**, never step navigation): at least one complaint
type; tenant name; tenant street/city/state/zip; landlord name; rental
street/city/zip; disclaimer accepted; signature drawn; attestation acknowledged.
Users can move freely between steps with anything missing. Inline hints appear as
they type. The Review step lists every missing required item with a link back to
its step, and the Send button stays disabled until that list is empty.

**Soft warnings** (show, never block):

- Empty non-optional fields → "The form asks for this. If you don't know, you
  can type 'Unknown'." (Emails are optional on the form: no warning.)
- Box 1 checked together with any of boxes 2–4 → neutral note: "Box 1 is for
  former tenants; boxes 2–4 are for current tenants. Please check your selection."
- Boxes 2 and 3 both checked → neutral note about the age ranges.
- Move-out date before move-in date; dates in the future (except signature date = today).
- A YES answer with its follow-up empty.
- A required evidence slot with no files.
- Packet size over budget (§8.5).

Warnings are phrased as observations, never as advice about which answer is right.

---

## 7. Wizard flow

One step per screen. Progress indicator. Back always available. On mobile, the
"More questions" step shows one question per sub-screen with its follow-up
appearing directly under YES.

**Question wording.** Ask each field as a plain-language question (e.g. "What
day did you move in?" for "Move In Date"). Rules:

- The plain question must ask for **exactly the same thing** as the form's field,
  no narrower and no broader. It may not add, drop, or reinterpret any part of
  the form's question.
- Under each question, show the form's own label in small secondary text:
  "On the form: Move In Date" (from `verbatim.json` → `page1Labels` /
  `fieldLabels`). This lets users match their answers to the printed form and the
  review screen.
- For YES/NO questions whose wording carries a specific meaning (Cash for Keys,
  check cashed, court action, correspondence, interest paid), keep the form's
  wording as the question and add a neutral definition beneath if helpful,
  unless a rewording is clearly equivalent. When in doubt, use the form's wording.
- Plain-language questions live in `i18n/en.json`. `verbatim.json` stays the
  exact form text.
- This does **not** apply to text the user checks or signs (§2.2): complaint
  types, footnotes, page 2 statements, attestation, checklist labels, and the
  forwarding-address note are always shown verbatim.

| #   | Step                | Contents                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Welcome             | What the tool does, time estimate. **Short non-blocking notice:** "Not legal advice. Not a government website. We count anonymous usage to improve the tool; we never collect what you type or upload." with link to Privacy. Device choice as the two start buttons (§9.1). Link to DOB's page for the official Spanish form (fires `spanish_form_link_clicked`). Links to legal help (§12). |
| 1   | Your situation      | The four complaint types, verbatim, as checkboxes + footnotes verbatim. Soft consistency notes.                                                                                                                                                                                                                                                                                               |
| 2   | What you'll need    | Evidence checklist derived from selected types (§8.4). If box 1 is checked, show the forwarding-address note verbatim. Never blocks.                                                                                                                                                                                                                                                          |
| 3   | About you           | Name, current address, daytime phone, email (optional).                                                                                                                                                                                                                                                                                                                                       |
| 4   | Your landlord       | Name, address, daytime phone, email (optional).                                                                                                                                                                                                                                                                                                                                               |
| 5   | The rental          | Unit street, housing complex (optional), city/state/zip, type of rental, terms, move-in, move-out.                                                                                                                                                                                                                                                                                            |
| 6   | Money               | Monthly rent, date last paid rent, security deposit, other deposit, deposit returned (+amount, +check cashed), interest paid (+repeatable date/amount rows).                                                                                                                                                                                                                                  |
| 7   | More questions      | Cash for Keys, roommates (+names), landlord's other properties (+addresses), correspondence received, court action (+docket number).                                                                                                                                                                                                                                                          |
| 8   | Documents           | One upload slot per derived checklist item (§8.4), plus the optional "Other documents" slot last. Thumbnails, per-slot page count, reorder/remove, per-slot grayscale toggle, live size meter.                                                                                                                                                                                                |
| 9   | Additional comments | Free textarea. Neutral prompt only (§2.2). Character count. Note that long text continues on an extra page.                                                                                                                                                                                                                                                                                   |
| 10  | Disclaimer          | Clickwrap from §10. Two unchecked checkboxes; button disabled until both checked. Store `disclaimerVersion` + timestamp in state. **No PDF is built until this is accepted.** If a resumed draft has an older `disclaimerVersion`, show it again.                                                                                                                                             |
| 11  | Review              | HTML summary grouped by step with "Edit" links; missing-required list (§6.3); warnings list; "Preview PDF" (opens blob URL in new tab). Builds an **unsigned preview** PDF on entering, with a light "PREVIEW, NOT SIGNED" header on each form page.                                                                                                                                          |
| 12  | Read and sign       | Page 2 statements verbatim, "I have read the statements above" checkbox, the form's attestation sentence verbatim directly above the signature pad, date (defaults to today, editable). Kept separate from the disclaimer: this screen is the State's text only.                                                                                                                              |
| 13  | Send                | Builds the **final signed** PDF on entering (no preview header) and keeps it in memory; tiered send (§8.6). DOB address shown large with Copy button. Plain "Download PDF" always visible. Send disabled while §6.3 hard requirements are missing.                                                                                                                                            |
| 14  | Confirmation        | "Check your Sent folder." DOB phone numbers for follow-up. "I've sent it" → offers erase dialog. Shared-computer erase section (§9.3). "Something not working? Let us know" link (§19.5).                                                                                                                                                                                                     |

Header on every step: "Start over and erase" link (opens erase dialog) and, in
device mode, the "Saved on this device · Erase" indicator.

When `formUpdatePending` is `true` (§12), show a dismissible notice on the
Welcome and Send steps: "The State recently updated this form. We're updating
this tool; for now your complaint will use the previous version of the form."
Hidden when `false`.

**Native inputs only:** `<input type="date">`, `inputmode="decimal"` for money,
`type="tel"`, `type="email"`, `autocomplete` attributes on name/address/phone/email,
native radios/checkboxes, `<input type="file">`, `<dialog>`.

---

## 8. PDF packet

### 8.1 Packet order

1. Form pages 1–3 (filled, flattened).
2. Continuation page(s), only if any text overflowed (§8.3).
3. Attachment index page.
4. Exhibit pages, grouped by checklist slot in checklist order.

All added pages are US Letter (612 × 792 pt), 0.5in margins, Noto Sans, black.

### 8.2 Filling the form

- If AcroForm: fill by field name from `fieldMap.ts`, set text via embedded Noto
  Sans, `form.updateFieldAppearances(font)`, then `form.flatten()`.
- If not (or for fields missing from the AcroForm): draw text at
  `{ page, x, y, maxWidth, maxHeight? }` from `fieldMap.ts`.
- Checkboxes on a flat PDF: draw an "X" centered in the box rect.
- Formatting at render: dates `MM/DD/YY`; money `$1,250.00`; phone
  `(860) 555-0123` when 10 digits, otherwise as typed.
- Multi-value fields: interest payments render as `MM/DD/YY – $X.XX; …`;
  roommate names and property addresses joined with `; `.
- Characters the embedded font can't encode: replace with `?` and log a
  warning in dev (Noto Sans covers Latin/Greek/Cyrillic; emoji will be replaced).
  Normalize input with `String.prototype.normalize("NFC")`.

### 8.3 Overflow

For each text field: measure with `font.widthOfTextAtSize` (and line-wrap for
multi-line fields). Try sizes from 10pt down to 7pt. If it still doesn't fit,
write `See continuation page` in the field and put the full text on a
continuation page titled "Continuation of Security Deposit Complaint Form",
with the tenant name and each overflowed field's form label as a subheading.
Additional Comments is the most likely overflow; test with 3,000+ characters.

### 8.4 Evidence slots (`checklist.ts`)

Derived deterministically from state. Labels come verbatim from the form's page
3 checklist.

| Condition                         | Slot                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Always                            | Proof that you paid a security deposit (receipt or front and back of cancelled check)                                                                                                                                                                        |
| Always (optional: "if available") | Copy of rental agreement(s)                                                                                                                                                                                                                                  |
| Always                            | Copy of any correspondence received or sent regarding the complaint                                                                                                                                                                                          |
| Box 1                             | Proof that you provided your landlord written notice of your forwarding address                                                                                                                                                                              |
| Box 2                             | Proof of Age (copy of state or federal ID)                                                                                                                                                                                                                   |
| Box 2                             | Letter asking that overage be returned (with proof of age provided to landlord)                                                                                                                                                                              |
| Box 3                             | Letter asking that the overage be returned                                                                                                                                                                                                                   |
| Box 4                             | Letter to the landlord asking for written notice of the deposit amount and the financial institution                                                                                                                                                         |
| Box 2, 3, or 4                    | Certified Mail Receipt                                                                                                                                                                                                                                       |
| Box 2, 3, or 4                    | Certified Mail Return Receipt                                                                                                                                                                                                                                |
| cashForKeys = yes                 | Copy of the Cash for Keys agreement                                                                                                                                                                                                                          |
| correspondenceReceived = yes      | Hint on the correspondence slot: "include the envelope" (form's own words)                                                                                                                                                                                   |
| Always, last, optional            | **Other documents (optional)** — help text: "Anything else you want the Department to see." Neutral: never suggest what kinds of documents to add. This slot is app-defined, not from the form; it's a single config entry so it can be removed if DOB asks. |

Every slot is optional to fill (never blocks Send); empty checklist slots appear as
soft warnings on Review. Dedupe slots. A slot may hold multiple files; each file may produce multiple pages.
For the Proof of Age slot, show a neutral note: "The form says the Department may
share your documents with your landlord. You may cover information you don't
want shared."

### 8.5 Uploads and size budget

- Accept `image/*` and `application/pdf`.
- **Images:** decode with `createImageBitmap(file, { imageOrientation: "from-image" })`;
  if decoding fails (e.g. unsupported HEIC), show an error asking the user to
  retake/export as JPEG. Resize to max 1600px on the long edge, re-encode to
  JPEG at quality 0.7 via `canvas.toBlob`. **Compress immediately on add** and
  discard the original, to keep memory low.
- **Grayscale per slot:** a toggle on each slot. Default **on** for document
  slots (receipts, lease, letters, certified mail receipts, ID), **off** for the
  "Other documents" slot (condition photos need color). Implemented in the same
  canvas pass (luminance conversion before `toBlob`). Toggling re-encodes that
  slot's images from the already-compressed copy only if needed; keep it simple.
- **PDFs:** load with pdf-lib and `copyPages` into the packet. Encrypted or
  unreadable PDFs → clear error ("This PDF is locked. Try taking a photo or
  screenshot of it instead.").
- **Exhibit page layout:** header line at top: `[Tenant name] · Security Deposit
Complaint · Attachment {n} of {N}: {slot label} · page {p} of {P}`. Image
  scaled to fit remaining area, centered, preserving aspect ratio. Imported PDF
  pages are scaled to fit under the same header.
- **Index page:** title "Supporting Documents", table of attachment number, slot
  label, file count, and page range.
- **Size budget:** live meter. Warn at 8 MB; **hard cap 10 MB** for the final PDF
  (base64 email encoding adds ~33%). Over the cap: offer "Compress more"
  (re-encode all images at 1200px / q0.6) and list the largest attachments so the
  user can remove pages. **Splitting into multiple emails is deliberately
  deferred**; revisit only if telemetry shows `packet_built` with `over10mb`
  happening often.

### 8.6 Send (`core/send/`)

Build the final signed PDF **before** the send button is tapped (on entering the
Send step; Review builds only the unsigned preview). The button handler must call `navigator.share()` synchronously relative to the tap —
no awaits before it — or Safari will reject it for lacking user activation.

Filename: `CT-Security-Deposit-Complaint_{TenantLastName}_{YYYY-MM-DD}.pdf`
(sanitize to `[A-Za-z0-9_-]`).

Subject: `Security Deposit Complaint - {Tenant Name} - {Rental street address}`
Body:

```
Attached is my completed Security Deposit Complaint Form and supporting documents.

{Tenant Name}
{Tenant daytime phone}
```

Tiers:

1. **Share sheet** — if `navigator.canShare?.({ files: [file] })`: primary button
   "Send with your email app". Pass `files`, `title` (subject), `text` (body).
   Above it: DOB address with Copy button + "Paste this into the To line."
2. **Download + mailto** — otherwise: primary button downloads the PDF (anchor
   with `download`), then navigates to
   `mailto:DOB.SD@CT.GOV?subject=…&body=…` (URL-encoded). Note: "Attach the
   downloaded PDF before sending."
3. **`.eml` draft** — secondary button on desktop: "Open as Outlook draft".
   Builds RFC 5322 / MIME text: `To`, `Subject` (RFC 2047-encode if non-ASCII),
   `X-Unsent: 1`, `MIME-Version: 1.0`, `multipart/mixed` with a `text/plain;
charset=utf-8` part and an `application/pdf` part (`Content-Transfer-Encoding:
base64`, lines ≤ 76 chars, `Content-Disposition: attachment; filename=…`).
   CRLF line endings. Downloaded as `.eml`.
4. **Always visible:** plain "Download PDF" link.

Handle `AbortError` from share (user cancelled) silently (telemetry: `known_issue: share_cancelled`).

Telemetry: `send_method_used` with `share_sheet | mailto | eml | download_only`.

---

## 9. Storage and erase

### 9.1 Device choice (on the Welcome step)

Presented as the two start buttons, under the heading **"Can anyone else use this
device?"**:

> [ Start — don't save anything after I close this tab ] (primary; label hint:
> "Choose this if others use this device, or you're not sure")
> [ Start and save my progress on this device ] (secondary; hint: "Only if you're
> the only one who uses it")

The first button is the default/primary → session mode. Changeable later from the header menu;
switching device → session deletes the IndexedDB copy immediately.

### 9.2 `draftStore` (`core/storage/`)

```ts
interface DraftStore {
  load(): Promise<Draft | null>;
  save(draft: Draft): Promise<void>; // debounced ~500ms by caller
  clear(): Promise<void>;
}
```

- All keys namespaced by tool: prefix `security-deposit-complaint:` (IndexedDB database
  name `security-deposit-complaint-drafts`). Multiple tools may share an origin. These internal IDs come
  from the form/tool, not the app name, so renaming the app never orphans
  saved drafts.
- **Session mode:** text state JSON in `sessionStorage`. Photos are **not**
  persisted (memory only). If the tab reloads, typed answers survive; photos
  must be re-added (show a notice listing empty slots).
- **Device mode:** IndexedDB stores text state + compressed image/PDF blobs.
- **Never persist the signature** in either mode; it is re-drawn at the end.
- **30-day expiry:** on load, if `meta.savedAt` (updated on every save) is older
  than 30 days, clear and start fresh (show a short notice).
- One message for every browser, no browser detection. Next to the "Saved on this
  device" indicator: "Saved on this device for up to 30 days. Some browsers,
  especially Safari on iPhone, may clear it sooner if you don't visit for a while."

- On load with an existing draft: "Continue your saved form" / "Start over"
  (Start over → erase dialog).
- Wrap all storage calls in try/catch; storage failure must degrade to
  memory-only with a notice, never crash.

### 9.3 Erase (`core/erase/`)

One routine used everywhere (header link, confirmation page, "Start over"):

1. Clear `sessionStorage` keys with the `security-deposit-complaint:` prefix **and** delete the
   IndexedDB database — both, regardless of mode.
2. `URL.revokeObjectURL` for every object URL created.
3. Drop references to PDF bytes, image blobs, signature canvas; reset state.
4. `location.replace(basePath)` so Back can't restore the filled page from bfcache.
5. Home screen shows "Your information has been erased."

Erase is always confirmed through a native `<dialog>` (`showModal()`):

> **Before you erase**
>
> This will remove everything you entered in this app from this browser. It
> can't reach copies saved elsewhere, so please also:
>
> • Delete the complaint PDF from your Downloads folder, if you downloaded it
> • Sign out of your email, if you signed in on this computer
>
> [ Cancel ] [ Erase now ]

Confirmation page section:

> **Using a shared or public computer?**
> [ Erase my information from this browser ]
> Closing this tab also erases what you entered here (unless you chose to save
> progress on this device).

---

## 10. Disclaimer (step 10, before Review)

`disclaimerVersion = "v0"` during development. Leave it at v0 until the text is
final and attorney-reviewed; set it to v1 at launch, then bump it on every text
change after that (a bump makes returning users with saved drafts see it again).
**Must be reviewed by a Connecticut-licensed attorney before public launch**,
including its placement (after data entry, before any PDF is produced). The short
Welcome notice (§7 step 0) sets expectations up front; this clickwrap gates the
deliverable.

> **Before we put your packet together: please read this.**
>
> **In short:** {appName} is a free tool that helps you fill out
> and send the State of Connecticut Department of Banking's Security Deposit
> Complaint Form. It is not a lawyer and cannot give you legal advice. You decide
> everything that goes on your form.
>
> **This is not legal advice.** {appName} is a document
> preparation tool. It types the information you enter onto the official state
> form and attaches the documents you upload, so you can send the packet
> yourself. It does not review your situation, tell you which boxes to check,
> suggest what to write, evaluate your evidence, or predict any outcome. Nothing
> in this tool is legal advice, and using it does not create an attorney-client
> relationship with anyone. If you have questions about your legal rights or
> options, contact a licensed Connecticut attorney or a legal aid organization
> such as Statewide Legal Services of Connecticut or CTLawHelp.org.
>
> **We are not the government.** {appName} is an independent
> open-source project. It is not affiliated with, endorsed by, or operated by the
> State of Connecticut or the Department of Banking. The Department decides
> whether and how to handle your complaint.
>
> **You are responsible for your form.** Everything on your form comes from you.
> When you sign, you are telling the State that your complaint is true and
> accurate to the best of your knowledge. Check your form carefully on the review
> screen before you send it.
>
> **What happens to your information.** Your form and documents are created on
> your device and never sent to our servers. You send the finished packet to the
> Department of Banking yourself, from your own email. To improve the tool, we
> count anonymous usage, like which steps people complete and when something
> breaks. We never collect what you type or upload, and we don't use cookies. The official form states
> that the Department may share your complaint and documents with your landlord
> and with other agencies, and that your submission may be public under
> Connecticut's Freedom of Information Act. Unless you choose to save your
> progress on this device, what you enter is erased when you close this tab.
>
> **No guarantees.** This tool is provided "as is," without warranties of any
> kind. We cannot guarantee that your email will be received or processed, or
> that your complaint will succeed. Keep a copy of your packet, and contact the
> Department if you do not hear back. To the fullest extent permitted by law,
> [Operator Name] and the project's contributors are not liable for any loss
> arising from your use of this tool.
>
> ☐ I understand that {appName} is a document preparation tool,
> not a lawyer, and that it does not give legal advice.
>
> ☐ I understand that I am responsible for the accuracy of everything I submit,
> and that I am responsible for sending my completed form to the Connecticut
> Department of Banking.
>
> **[ I agree, show my form ]**

Footer on every screen: "Independent project. Not affiliated with the State of
Connecticut." + links to Terms, Privacy, source code. Never use the state seal,
state color scheme, or the word "official" in reference to this app.

---

## 11. Security headers (`dist/_headers`, generated by `scripts/gen-headers.ts`)

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src {TELEMETRY_ORIGIN or 'none'}; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
```

Notes:

- No inline scripts or styles (Vite production build complies; verify).
- The PDF preview opens a `blob:` URL in a new tab (top-level navigation, not a
  frame), so `frame-src 'none'` is fine.
- The CSP is part of the security model: if a change needs to loosen it, stop
  and ask.
- No service worker.
- `gen-headers.ts` runs after `vite build`. It sets `connect-src` to the origin of
  `VITE_TELEMETRY_ENDPOINT` (scheme + host only), or `'none'` if unset. Never a
  wildcard, never more than one origin. A unit test covers both cases.

---

## 12. Config (`forms/ct-dob-security-deposit/config.ts`)

```ts
export const DOB = {
  email: 'DOB.SD@CT.GOV',
  phones: ['860-240-8170', '1-800-831-7225'], // from DOB web page
  formPhone: '(860) 240-8154', // printed on the form; discrepancy noted
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
```

All external links: `rel="noopener noreferrer"`, `target="_blank"`. Maintainer
verifies links and phone numbers before launch.

---

## 13. Verbatim form text (`verbatim.json`)

Transcribed from the Rev 8/26 English form. **In Phase 1, verify every string
against the template's extracted text and fix discrepancies.**

How each group is used:

- `complaintTypes`, `complaintFootnotes`, `page2Heading`, `page2Statements`,
  `attestation`, `checklist`, `forwardingAddressNote`: shown **exactly** as the
  primary text (§2.2).
- `page1Labels` / `fieldLabels`: the form's field names, used as the secondary
  "On the form: …" reference under plain-language questions (§7), on the review
  screen, and as subheadings on the continuation page. Not the primary question text.

In Phase 1, add a `fieldLabels` object with the exact label of every other
page 1 field (e.g. `"moveInDate": "Move In Date"`, `"housingComplexName": "Name
of Housing Complex (if any)"`).

```json
{
  "forwardingAddressNote": "You must provide your landlord written notice of your forwarding address. The best way is via a letter sent by certified mail with return receipt. If you cannot provide sufficient proof that you sent your landlord written notice, the Department may not be able to assist.",
  "complaintIntro": "This complaint is being filed against the landlord named above for failing to: (check all that apply)",
  "complaintTypes": {
    "formerTenantDepositNotReturned": "I am a former tenant and my landlord failed to return my security deposit",
    "currentTenant62PlusExcessOverOneMonth": "I am a current tenant, 62 years age or older, and my landlord is holding a security deposit in excess of one month's periodic rent *",
    "currentTenantUnder62ExcessOverTwoMonths": "I am a current tenant, under the age of 62, and my landlord is holding a security deposit in excess of two months' periodic rent *",
    "currentTenantNoEscrowInfo": "I am a current tenant and my landlord has not provided information regarding my escrow account * **"
  },
  "complaintFootnotes": [
    "* Department of Banking will close your complaint once tenancy is terminated",
    "** Department of Banking will confirm the security deposit is in an escrow account, we will not provide the bank account number"
  ],
  "page2Heading": "READ THE FOLLOWING BEFORE SIGNING BELOW",
  "page2Statements": [
    "In filing this complaint, I understand that the Department of Banking is not my private attorney. I should contact a private attorney if I have any questions concerning my legal rights or responsibilities. I also understand that information I submit to this agency may be considered public information subject to disclosure under the Connecticut Freedom of Information Act, Connecticut General Statutes Section 1-200 et. seq. or Section 36a-21 of the Connecticut General Statutes, which may provide additional protection from disclosure.",
    "I further understand that I may be required to testify in the event that the Department of Banking takes legal action in connection with my complaint.",
    "By filing this complaint form, I authorize the Department of Banking to speak about my complaint or share this form and additional documentation included with the person or business I am complaining about or with other regulatory agencies."
  ],
  "attestation": "The above complaint is true and accurate to the best of my knowledge.",
  "checklist": {
    "all": [
      "Proof that you paid a security deposit (receipt or front and back of cancelled check)",
      "Copy of rental agreement(s) if available",
      "Copy of any correspondence received or sent regarding the complaint"
    ],
    "formerTenantDepositNotReturned": [
      "Proof that you provided your landlord written notice of your forwarding address. The best way is via a letter sent by certified mail with return receipt."
    ],
    "currentTenant62PlusExcessOverOneMonth": [
      "Proof of Age (copy of state or federal ID)",
      "Letter asking that overage be returned, must provide landlord with proof of age",
      "Certified Mail Receipt",
      "Certified Mail Return Receipt"
    ],
    "currentTenantUnder62ExcessOverTwoMonths": [
      "Letter asking that the overage be returned",
      "Certified Mail Receipt",
      "Certified Mail Return Receipt"
    ],
    "currentTenantNoEscrowInfo": [
      "Letter to the landlord asking for written notice stating the amount of the security deposit and the name and address of the financial institution where the security deposit is being held",
      "Certified Mail Receipt",
      "Certified Mail Return Receipt"
    ]
  },
  "page1Labels": {
    "cashForKeys": "Did you accept a Cash for Keys offer? (if \"YES\", please provide a copy of the agreement)",
    "depositReturned": "Has any part of your security deposit been returned? (If \"YES\", enter the amount)",
    "checkCashed": "Has the check been cashed?",
    "landlordOtherProperties": "Does the landlord own other properties? (if \"YES\" list the address)",
    "interestPaid": "Has interest been paid on the Security Deposit (If \"YES\", include date(s) and dollar amount(s))",
    "roommates": "Did you have roommates or co-renters? (if \"YES\", please provide their names)",
    "correspondenceReceived": "Have you received any correspondence regarding your security deposit? (If \"YES\", enclose a copy including the envelope)",
    "courtAction": "Has there been any court action involving this rental? (if \"YES\", enter docket number)",
    "additionalComments": "Additional Comments (Attach additional pages if necessary)"
  }
}
```

---

## 14. UI and styling

- `tokens.css`: colors (light + dark via `prefers-color-scheme`), spacing scale,
  type scale, radius, focus ring, **min touch target 44px**. All components use
  tokens only.
- Mobile-first single column, max content width ~40rem on desktop.
- Base font ≥ 16px (prevents iOS zoom on input focus).
- Visible focus states; every input has a `<label>`; errors linked via
  `aria-describedby`; step changes move focus to the step heading.
- Plain, calm language (~8th-grade reading level) in app copy. Legal text stays verbatim.
- Signature pad: Pointer Events, `touch-action: none` on the canvas, "Clear"
  button, keyboard-accessible alternative note (typed name is not a substitute
  for the drawn signature on the form; flag this for maintainer decision if an
  accessibility alternative is needed).
- Aesthetic: calm, trustworthy, clearly **not** a government site.

---

## 15. Testing

**Vitest (unit):**

- Date formatting ISO → `MM/DD/YY` (incl. year 2000–2099 edge cases).
- Money parsing/formatting (`"1,250"`, `"$1250.5"`, invalid input).
- Phone formatting.
- `checklist.ts` slot derivation for every complaint type combination and the
  cash-for-keys / correspondence triggers.
- Follow-up rule (§6.2): hidden follow-ups not rendered.
- Text fitting: shrink behaviour and overflow → continuation page.
- Fill round-trip: build a packet from fixture state, reload with pdf-lib, assert
  page count and (if AcroForm, before flatten) field values.
- Template SHA-256 matches `template.sha256`.
- `.eml` builder output: headers, boundary, base64 line length, CRLF.
- Erase routine clears both storage backends.
- 30-day expiry logic.
- No PDF build is possible before the disclaimer is accepted; Send disabled while hard requirements are missing.
- Telemetry (§19): every event in `events.ts` validates; an event with a
  non-allowlisted name or property value is dropped, not sent; stack-location
  sanitizer accepts only own-bundle frames and rejects extension/blob/other
  frames; per-session caps and dedupe; sender is a no-op when the endpoint is
  unset or GPC/DNT is on; sender never throws.
- `gen-headers.ts` output with and without a telemetry endpoint.

**Playwright (one smoke test, WebKit):** "Start — don't save" → fill minimal
type-1 complaint → upload a fixture image → accept disclaimer → review → sign
(synthetic pointer events) → send step → assert final PDF blob exists, size > 0, and fallback download link
works. Then erase and assert storage is empty.

**Manual, each phase:** open generated PDFs and visually check alignment. Keep
sample outputs out of the repo if they contain realistic personal data.

---

## 16. CI

**`ci.yml`** (on PR and push to main): `pnpm/action-setup` (version from
`packageManager`) → `pnpm install --frozen-lockfile` → `biome check` →
`tsc --noEmit` → `vitest run` → `pnpm build` → Playwright WebKit smoke test.

**Deploy:** Cloudflare Pages Git integration builds and deploys `main` itself (no
API token in GitHub). Pages settings: build command `pnpm build` (which runs
`vite build` then `gen-headers.ts`), output directory `dist`. Set
`VITE_TELEMETRY_*` for the **Production** environment only, so preview
deployments send no telemetry. In Phase 6, verify from the build log that
Cloudflare uses the pnpm version from `packageManager` and the Node version
from `.nvmrc`; if not, set them explicitly in Pages build settings.
`VITE_APP_VERSION` comes from Cloudflare's commit SHA env var in production
builds and from `git rev-parse --short HEAD` locally.

**`form-watch.yml`** (weekly cron + `workflow_dispatch`): fetch the DOB complaint
page, find the link whose path contains `sdcompform-rev` (English, not Spanish),
download it, compute SHA-256. If the filename or hash differs from the committed
template, open a GitHub issue (dedupe by title) with the new URL and hash. Never
auto-replace the template. The issue body includes:

- the new URL, filename, and hash, and the currently committed ones;
- "Update procedure: CLAUDE.md §5.3. To handle it, tell Claude Code: handle issue #N";
- a reminder: "Optional: set `formUpdatePending: true` in config.ts to show users
  a notice while the update is in progress."

It has two jobs:

```yaml
jobs:
  check-form:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      # ...download form, compare hash, open issue if changed...
      - name: Open an issue if this check itself failed
        if: failure()
        # Skip if an open issue titled "Form watcher failed" already exists.
        run: |
          if [ -z "$(gh issue list --state open --search 'in:title "Form watcher failed"' --json number -q '.[].number')" ]; then
            gh issue create --title "Form watcher failed" \
              --body "Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          fi
        env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}

  keepalive:
    # GitHub disables scheduled workflows in public repos after 60 days without
    # repo activity. Re-enabling via the API each run is the common workaround.
    # It is not officially documented to reset the timer; GitHub's warning email
    # and `pnpm watcher:enable` (§3.2) are the backstop.
    runs-on: ubuntu-latest
    permissions:
      actions: write
    steps:
      - run: gh workflow enable form-watch.yml
        env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}
```

**Source maps:** deployed publicly with the site (§3). To map a telemetry
`location` to source, open that deployment's `.map`, or check out the commit in
`version` and rebuild with the same lockfile.

**`dependabot.yml`**: `npm` package-ecosystem (Dependabot's name for it; it
reads `pnpm-lock.yaml`) with `open-pull-requests-limit: 0` (disables
version-update PRs); security updates are enabled in repo settings.

---

## 17. Build phases

Work phase by phase. Stop at the end of each phase and report to the maintainer.

1. **Scaffold + form inventory.** pnpm (with §3.1 settings)/Vite/Preact/TS/Biome/Vitest set up. Commit the
   template + hash. Run `scripts/dump-form-fields.ts` (field names, types, pages,
   rects, export values) and `scripts/extract-form-text.ts`. Report findings on
   §5.2 and any `verbatim.json` corrections. **Do not write fieldMap.ts until
   the maintainer reviews the dump.**
2. **PDF packet from fixtures.** `fieldMap.ts`, fill + flatten, text fitting,
   continuation page, index page, exhibit pages, size budget. No UI. Unit tests.
   Output sample PDFs for visual review.
3. **Wizard + state.** Steps 0–12 except uploads/signature, validation (Send-time
   gating), disclaimer placement, i18n strings, tokens/CSS.
4. **Uploads + signature.** Image pipeline incl. grayscale toggle, PDF import,
   slots incl. "Other documents", size meter, signature pad.
5. **Send + storage + erase.** Tiered send, `.eml`, draftStore both backends,
   device choice on Welcome, 30-day expiry, erase dialog and routine, confirmation page.
6. **Hardening + deploy.** Telemetry module (§19) with endpoint unset by default,
   `gen-headers.ts`, public source maps, verify CSP in production build (no
   violations in console), Playwright smoke test, CI workflows (incl. keepalive),
   Dependabot, Cloudflare Pages build verification (§16), README (what it is,
   privacy model, how to update the form template (pointing to §5.3),
   maintenance commands, and a **form revision log** table: revision, date
   adopted, commit; first row is Rev 8/26), Terms and
   Privacy pages (placeholders for maintainer/attorney text).
7. **After launch: slim this file** (only when the maintainer asks). Move the
   build-time detail (phases, scaffolding, the full spec) to `docs/SPEC.md`.
   Keep in `CLAUDE.md`: §1, all of §2, the maintenance commands, how to update
   the form template, the telemetry rules, and a pointer to `docs/SPEC.md`.
   Nothing in §2 may be dropped or shortened in the move.

---

## 18. Maintainer to-dos (outside the code)

- Call DOB (860-240-8170 / 1-800-831-7225): confirm max attachment size and that
  drawn e-signatures are acceptable; ask whether they want documents beyond the
  page 3 checklist (e.g. move-in/move-out condition photos) attached to an initial
  complaint; ask which phone number tenants should call about security deposit
  complaints (the form lists (860) 240-8154, DOB's web page lists 860-240-8170
  and 1-800-831-7225) and update `config.ts`; give a heads-up about
  app-originated emails; ask how long DOB keeps accepting the previous form
  revision after publishing a new one; mention the domain.
- Attorney / legal aid review of the disclaimer, Terms, and Privacy text.
- Finalize app name (consider wording that doesn't imply guaranteed recovery).
  Do this before the attorney review, since the name appears in the disclaimer.
  Renaming = change `app.name` in `i18n/en.json`.
- Register domain; decide subdomain-per-tool vs. path (code supports both).
- Usability test with 2–3 real tenants on their own phones before launch.
- Choose the analytics tool (§19.1), create the free account, set
  `VITE_TELEMETRY_ENDPOINT` and `VITE_TELEMETRY_SITE_ID` in Cloudflare Pages
  (Production environment only).
- Install the GitHub CLI and run `gh auth login` once, for `pnpm watcher:*`.
- Connect the repo to Cloudflare Pages; disable automatic Web Analytics injection.

---

## 19. Anonymous telemetry

Purpose: learn where people get stuck and what breaks, without collecting
anything a person typed, uploaded, or could be identified by.

### 19.1 Tool (maintainer decides later)

Requirements: cookieless, no cross-site tracking, supports custom events with
properties, accepts events over a plain HTTP API (so we send them ourselves
without loading a vendor script), and **free** for this project. Candidates to
evaluate (verify current pricing/limits): GoatCounter (free for non-commercial),
Umami Cloud (free hobby tier). Cloudflare Web Analytics is free but page-view
only and requires its injected script, so it doesn't fit.

Implement behind an adapter so switching tools is a one-file change:

```ts
interface TelemetryTransport {
  send(
    event: AllowedEvent,
    ctx: { version: string; step: StepId | null },
  ): void;
}
```

Config via env: `VITE_TELEMETRY_ENDPOINT`, `VITE_TELEMETRY_SITE_ID`. If
`VITE_TELEMETRY_ENDPOINT` is unset, telemetry is a no-op (default in dev and tests).

### 19.2 Rules

- All events are declared in `core/telemetry/events.ts` (with form-specific enums,
  e.g. step IDs, supplied by the form module). The sender rejects anything not
  declared there.
- Property values are **enums** or **strictly pattern-validated** strings. Never:
  free text, names, addresses, amounts, dates, file names, file sizes in exact
  bytes, error messages, URLs with query strings or fragments.
- No user or session identifiers are created or sent. Counting is aggregate only.
- Skip all telemetry when `navigator.globalPrivacyControl === true` or
  `navigator.doNotTrack === "1"`.
- Send with `fetch(url, { method: "POST", keepalive: true, credentials: "omit" })`
  (or `navigator.sendBeacon`). Wrap in try/catch; failures are ignored.
- Every event includes `version` (`VITE_APP_VERSION`, the short commit SHA; pattern `^[0-9a-f]{7,12}$|^dev$`).

### 19.3 Event allowlist (initial)

| Event                       | Properties                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `step_viewed`               | `step`: StepId enum                                                                                                  |
| `storage_mode_chosen`       | `mode`: `session \| device`                                                                                          |
| `complaint_types_selected`  | `types`: sorted, comma-joined subset of `1,2,3,4` (pattern `^[1-4](,[1-4]){0,3}$`)                                   |
| `packet_built`              | `size_bucket`: `lt2mb \| 2to5mb \| 5to8mb \| 8to10mb \| over10mb`; `page_bucket`: `lt10 \| 10to20 \| 20to40 \| gt40` |
| `compress_more_used`        | —                                                                                                                    |
| `send_method_used`          | `method`: `share_sheet \| mailto \| eml \| download_only`                                                            |
| `sent_confirmed`            | — (user tapped "I've sent it")                                                                                       |
| `erase_used`                | `from`: `header \| confirmation \| start_over \| expiry`                                                             |
| `draft_resumed`             | —                                                                                                                    |
| `spanish_form_link_clicked` | —                                                                                                                    |
| `known_issue`               | `code`: see §19.4                                                                                                    |
| `operation_failed`          | `op`, `error_type`, `location` (§19.4)                                                                               |
| `unexpected_error`          | `error_type`, `location` (§19.4)                                                                                     |

Adding an event = add it to `events.ts` + a test. No other path exists.

### 19.4 Errors

**Known issues** (handled, user-facing): `known_issue` with `code` enum, initially
`image_decode_failed`, `pdf_encrypted`, `pdf_unreadable`, `over_size_cap`,
`share_cancelled`, `share_rejected`, `storage_unavailable`, `storage_quota`,
`draft_expired`. Extend as new handled cases appear.

**Wrapped operations:** `add_file`, `compress_image`, `import_pdf`, `build_packet`,
`fill_form`, `share`, `eml_build`, `draft_save`, `draft_load`, `erase`. Any
exception inside one reports `operation_failed { op, error_type, location }`,
then is handled normally (user sees a friendly message).

**Global catch-all:** `window` `error` and `unhandledrejection` handlers report
`unexpected_error { error_type, location }`.

Field definitions:

- `error_type`: `error.name` if in the allowlist (`Error`, `TypeError`,
  `RangeError`, `SyntaxError`, `ReferenceError`, `DOMException`, `NotAllowedError`,
  `AbortError`, `QuotaExceededError`, `NotFoundError`, `InvalidStateError`,
  `SecurityError`, `DataError`, `EncodingError`), else `Other`. **Never send
  `error.message`.**
- `location`: first stack frame whose URL is on our own origin, reduced to
  `path:line:col` with origin, query, and fragment stripped. Must match
  `^[A-Za-z0-9/_.-]+\.js:\d+:\d+$`, else `unknown`. Frames from extensions,
  `blob:`, `data:`, or other origins are never sent.
- Current step is included automatically via ctx.

Map `location` back to source with that deployment's public source map, or by
rebuilding the commit in `version` (§16).

Limits: max 5 error events per page load; the same `op`+`location` or
`location` is sent at most once per page load.

### 19.5 User-initiated problem report

Confirmation page and footer: "Something not working? Let us know." Opens a
pre-filled GitHub issue URL (or `mailto:` to [maintainer email]) containing only:
app version, browser family + major version, current step, last error code or
`location`. The template says: "Please don't include personal details." The
user sees the full contents before submitting. Nothing is sent automatically.
