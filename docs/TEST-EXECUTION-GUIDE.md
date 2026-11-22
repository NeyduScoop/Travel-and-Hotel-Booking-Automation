# Test Execution Guide

## First run
```bash
npm ci
npx playwright install chromium firefox webkit
cp .env.example .env      # add PRIME_* / AFFILIATE_* locally
npm run typecheck
npm run test:smoke
```

## Individual modules
| Module | All suites | E2E only |
|---|---|---|
| Flights | `npm run test:flights` | `npm run test:e2e:flights` |
| Hotels | `npm run test:hotels` | `npm run test:e2e:hotels` |
| Packages | `npm run test:packages` | `npm run test:e2e:packages` |
| Tours | `npm run test:tours` | `npm run test:e2e:tours` |
| Visa | `npm run test:visa` | `npm run test:e2e:visa` |
| Travel Add-ons | `npm run test:travel-addons` | `npm run test:e2e:travel-addons` |
| Prime (all PRIME) | `npm run test:prime` | `npm run test:e2e:prime` |
| PRIME Flights | `npm run test:prime-flights` | `npm run test:e2e:prime-flights` |
| PRIME Hotels | `npm run test:prime-hotels` | `npm run test:e2e:prime-hotels` |
| Affiliate | `npm run test:affiliate` | `npm run test:e2e:affiliate` |

- Regression for one module: `npx playwright test --project=chromium --grep "(?=.*@regression)(?=.*@packages)"`
- One test by title: `npx playwright test --project=chromium -g "TC-FLT-010"`

## E2E, confirmation and payment tests (create DEVTEST bookings)
These are gated. Without the flag they report **BLOCKED (PAYMENT AUTHORISATION REQUIRED)**.
```bash
# bash
ALLOW_TEST_BOOKING_SUBMISSION=true npm run test:e2e            # all journeys to confirmation
ALLOW_TEST_BOOKING_SUBMISSION=true npm run test:confirmation   # same journeys, by tag
ALLOW_TEST_BOOKING_SUBMISSION=true npm run test:payment        # payment-step checks (no payment submitted)
# PowerShell
$env:ALLOW_TEST_BOOKING_SUBMISSION='true'; npm run test:e2e
```
- **Card route:** also needs `ALLOW_TEST_PAYMENT_AUTHENTICATION=true` and `TEST_CARD_*`. On DEVTEST it currently stops at Paystack's Cloudflare bot check and reports BLOCKED.
- **Load:** use `--workers=2` or fewer for booking runs. DEVTEST returned "Something went wrong / Failed to fetch" under heavier parallel load.
- **Records created:** every booking id created appears as a `booking` annotation in the HTML report.

## Payment-option tests, safely
`@payment` tests press *Proceed to Pay* (creating an unpaid booking record) and **select** each option to verify visibility, enabled state, single selection and amounts. They never press *Make Payment*. Only E2E journeys submit, and only Pay at Bank (or the authorised card route).

## Reading results
`test-results/execution-summary.md` gives totals plus breakdowns by module and by suite, failed tests with errors, and blocked tests with categorised reasons.

| Status | Meaning |
|---|---|
| PASS | Behaviour verified |
| FAIL | An assertion failed. Triage as automation, application, data or environment |
| BLOCKED | A precondition is missing (credentials, inventory, data, authorisation, environment) |
| SKIPPED | Skipped for a non-blocking reason |
| FLAKY | Passed on retry (CI only); investigate |

> Do not pass `--reporter=...` on the command line. It replaces the configured reporters, including the summary and secret scrubbing.

## Triage
1. Open `error-context.md`. It is not available for signed-in specs, which run with artifacts off.
2. Open the trace, check `console-and-network.json`, then read the integrity table attached to E2E tests.
3. Classify the failure: AUTOMATION DEFECT · APPLICATION DEFECT · TEST DATA ISSUE · ENVIRONMENT ISSUE · MISSING CREDENTIALS · MISSING INVENTORY · PAYMENT AUTHORISATION REQUIRED · NEEDS CLARIFICATION.

## Observed timings (DEVTEST, 2026-11-14/15)
| Step | Observed |
|---|---|
| Flight results | 8–20 s |
| Hotel results | 9–15 s |
| Hotel details tab | 10–18 s |
| Tours results | 6–8 s (tours API cold start up to 10 s) |
| Add-on results | 4–5 s |
| Proceed to Pay → payment step | 9–15 s |
| Pay at Bank → confirmation | about 34 s |
| Passport OCR | about 11 s |
