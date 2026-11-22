# Wakanow Playwright Automation

Playwright + TypeScript automation for **Wakanow Web V4** with three suites:

- **Smoke:** fast availability checks.
- **Regression:** detailed functional, validation, pricing and payment-step checks.
- **E2E:** full search → booking-confirmation journeys with confirmation data-integrity checks.

**Modules:** Flights · Hotels · Packages · Tours · Visa · Travel Add-ons · Prime (membership) · PRIME Flights · PRIME Hotels · Affiliate.

- **Functional specification:** the Wakanow QA project's `projects/Wakanow/Project.md` and canonical `test-data.json` (both unmodified).
- **Selectors:** every one was taken from the live DEVTEST application (2026-11-14/15). See `docs/FRAMEWORK-ARCHITECTURE.md`.

## Requirements
| Tool | Version |
|---|---|
| Node.js | 22 LTS (20+ works) |
| Playwright | 1.65.1 (pinned) |
| TypeScript | 5.9 |

## Install
```bash
npm ci
npx playwright install chromium firefox webkit   # add --with-deps on Linux CI images
cp .env.example .env                              # then fill in values locally (never commit .env)
```

## Configuration (`.env`)
| Variable | Default | Purpose |
|---|---|---|
| `TEST_ENV` | `DEVTEST` | `DEVTEST`, `PREPROD` or `PRODUCTION`; any other value stops the run |
| `BASE_URL` | — | Optional override; must be an approved Wakanow URL |
| `HEADLESS` | `true` | Headless browsers |
| `WORKERS` | 4 local / 2 CI | Parallel workers |
| `PRIME_EMAIL`, `PRIME_PASSWORD` | — | PRIME Flights / PRIME Hotels tests; **BLOCKED** if missing |
| `AFFILIATE_EMAIL`, `AFFILIATE_PASSWORD` | — | Affiliate tests; **BLOCKED** if missing |
| `ALLOW_TEST_BOOKING_SUBMISSION` | `false` | Lets tests press *Proceed to Pay* (creates a booking record) and submit *Pay at Bank* (unpaid booking) |
| `ALLOW_TEST_PAYMENT_AUTHENTICATION` | `false` | Lets tests use the card / bank-authentication route on a **test-mode** gateway |
| `TEST_CARD_NUMBER`, `…_EXPIRY`, `…_CVV`, `…_PIN`, `…_OTP` | — | Test-mode card for the card route only |

## Payment safety
- No booking is created and no payment is attempted unless the matching flag is `true`. Neither flag is ever honoured on PRODUCTION.
- **Route policy:**
  - **Pay at Bank** whenever it is offered.
  - Otherwise **Card**, choosing bank authentication when no card input is requested.
  - **Kalabash Wallet** is never used.
- Bot protection is never bypassed. DEVTEST card payments redirect to Paystack checkout, which serves a Cloudflare challenge to automated browsers, so card-route journeys report **BLOCKED**.
- Nothing is reported PASS because a button was clicked. Every E2E test reads the confirmation page and compares it field by field.

## Run
| Command | What it runs |
|---|---|
| `npm test` | Every test on Chromium |
| `npm run test:smoke` | `@smoke` |
| `npm run test:regression` | `@regression` |
| `npm run test:e2e` | `@e2e` (2 workers) |
| `npm run test:e2e:flights` / `:hotels` / `:packages` / `:tours` / `:visa` / `:travel-addons` / `:prime` / `:prime-flights` / `:prime-hotels` / `:affiliate` | One E2E module |
| `npm run test:flights` / `test:hotels` / `test:packages` / `test:tours` / `test:visa` / `test:travel-addons` / `test:prime` / `test:prime-flights` / `test:prime-hotels` / `test:affiliate` | One module, all suites |
| `npm run test:payment` / `test:confirmation` | Payment-step checks / confirmation-integrity checks |
| `npm run test:critical` | `@critical` |
| `npm run test:headed` / `test:debug` | Watch it run / Playwright Inspector |
| `npm run test:chromium` / `test:firefox` / `test:webkit` / `test:cross-browser` | Browser selection |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run report` | Open the HTML report |

Run the booking-creating E2E flows (DEVTEST, authorised runs only):
```bash
# bash
ALLOW_TEST_BOOKING_SUBMISSION=true npm run test:e2e
# PowerShell
$env:ALLOW_TEST_BOOKING_SUBMISSION='true'; npm run test:e2e
```

## Results and evidence
| Output | Location |
|---|---|
| HTML report (screenshots, videos, traces, integrity tables) | `playwright-report/` |
| PASS / FAIL / BLOCKED / SKIPPED summary per module and suite | `test-results/execution-summary.{md,json}` |
| JSON / JUnit | `test-results/results.json`, `test-results/junit.xml` |
| Failure evidence | `test-results/artifacts/<test>/` |
| Saved runs | `reports/execution/` |

**BLOCKED** means a precondition is missing, such as credentials, inventory, test data or payment authorisation. Its reason is categorised (MISSING CREDENTIALS, MISSING INVENTORY, TEST DATA ISSUE, PAYMENT AUTHORISATION REQUIRED, ENVIRONMENT ISSUE, NEEDS CLARIFICATION).

## GitHub Actions secrets and variables
| Name | Type | Used by |
|---|---|---|
| `PRIME_EMAIL`, `PRIME_PASSWORD` | Secret | all workflows |
| `AFFILIATE_EMAIL`, `AFFILIATE_PASSWORD` | Secret | all workflows |
| `TEST_CARD_NUMBER`, `TEST_CARD_EXPIRY`, `TEST_CARD_CVV`, `TEST_CARD_PIN`, `TEST_CARD_OTP` | Secret | `e2e-tests.yml` only |
| `TEST_ENV` | Variable | all workflows (default `DEVTEST`) |
| Environments `e2e-devtest`, `e2e-preprod` | Environments (add required reviewers) | `e2e-tests.yml` |

See `docs/CI-CD-GUIDE.md`.

## Documentation
- `docs/FRAMEWORK-ARCHITECTURE.md`: layers, page objects, payment, authentication, affiliate, confirmation and E2E architecture
- `docs/TEST-EXECUTION-GUIDE.md`: how to run, debug and triage
- `docs/TEST-COVERAGE.md`: every scenario with ID, suite, priority, status and spec
- `docs/CI-CD-GUIDE.md`: workflows, secrets and safety
- `docs/EXECUTION-REPORT.md`: latest validation results and defect register
- `CLAUDE.md`: maintenance rules
