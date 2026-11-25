# CI/CD Guide (GitHub Actions)

Pushing to GitHub needs the owner's authorisation; nothing is pushed by the automation agent.

| Workflow | Triggers | Runs | Booking flags |
|---|---|---|---|
| `smoke-tests.yml` | **every push** (any branch); manual | typecheck → `npm run test:smoke` | forced `false` |
| `regression-tests.yml` | **every push** (any branch); manual (environment, browser, extra tag) | typecheck → `--grep @regression` (+ tag) | forced `false` (booking-creating checks report BLOCKED) |
| **`e2e-tests.yml`** | **manual only** (`workflow_dispatch`) | typecheck → selected `@e2e` scope, 2 workers | **explicit opt-in inputs**, default `false` |

There is **no scheduled run** (owner instruction, 2026-11-24): `scheduled-regression.yml` was removed. E2E stays manual because it creates real DEVTEST bookings and needs the opt-in inputs.

## E2E workflow safety
- **Never automatic:** there is no pull-request or push trigger, so it runs only when someone dispatches it.
- **Environments:** DEVTEST by default; PREPROD optional; PRODUCTION is not offered.
- **Opt-in inputs:** `allow_booking_submission` and `allow_payment_authentication` both default to **false**. Unticked, booking journeys report BLOCKED (PAYMENT AUTHORISATION REQUIRED).
- **Approval gate:** the job runs in GitHub Environment `e2e-devtest` or `e2e-preprod`. **Add required reviewers** to these environments (Settings → Environments) so every E2E run needs approval.
- **Secrets:** come only from repository or environment secrets, and are scrubbed from text artifacts by the summary reporter. Signed-in specs record no trace, video or screenshot.
- **Artifacts:** uploaded even when tests fail (`if: ${{ !cancelled() }}`). The run summary lists failed and BLOCKED tests with reasons.

## Required configuration
Secrets: repository **Settings → Secrets and variables → Actions → Secrets → New repository secret** (or per Environment). Variables: same page, **Variables** tab. Names must match exactly; values are never printed and are scrubbed from artifacts.

| Name | Type | Used by | Without it |
|---|---|---|---|
| `PRIME_EMAIL`, `PRIME_PASSWORD` | Secret | all | PRIME sign-in tests BLOCKED (MISSING CREDENTIALS) |
| `AFFILIATE_EMAIL`, `AFFILIATE_PASSWORD` | Secret | all | affiliate tests BLOCKED |
| `TEST_CARD_NUMBER`, `TEST_CARD_EXPIRY`, `TEST_CARD_CVV`, `TEST_CARD_PIN`, `TEST_CARD_OTP` | Secret (test-mode card only) | `e2e-tests.yml` | card route BLOCKED |
| `KALABASH_PHONE`, `KALABASH_PASSWORD`, `KALABASH_PIN` | Secret | `e2e-tests.yml` | PRIME Kalabash fallback BLOCKED |
| `TEST_ENV` | Variable | all | defaults to `DEVTEST` |
| `TIME_OF_TRAVEL` | Variable (not secret) | regression, E2E | test-data value (`12:00 AM`) |
| `e2e-devtest`, `e2e-preprod` | Environments with required reviewers | `e2e-tests.yml` | — |

### Authentication in CI without committing `.env`
`.env` stays local and git-ignored. Every credential the tests read from `.env` is read from `process.env`, and the workflows map each GitHub secret to the same variable name (`PRIME_EMAIL: ${{ secrets.PRIME_EMAIL }}` …). So adding the secrets above is all that is needed; no code reads `.env` in CI. With GitHub CLI: `gh secret set PRIME_EMAIL` (prompts for the value, nothing is echoed). Pull-request runs from forks never receive secrets, so those tests report BLOCKED there.

### Passport OCR image
CI uses the committed **synthetic specimen** `data/common/passport-specimen/specimen-passport.jpg` (fictional canonical lead adult, valid ICAO 9303 MRZ, "SPECIMEN" watermark; regenerate with `npm run passport:specimen`). DEVTEST OCR reads it (verified 2026-11-24, all 6 fields match). The real ID stays git-ignored in `data/common/passport-images/` and is used only when `PASSPORT_IMAGE_PATH` and `PASSPORT_EXPECTED_PATH` are set.

## Tags
`@smoke @regression @e2e` · `@flights @hotels @packages @tours @visa @travel-addons @prime @prime-flights @prime-hotels @affiliate` · `@payment @confirmation` · `@positive @negative @boundary @critical`

## Validation performed
- The workflow files were parsed with Playwright's bundled YAML parser and checked structurally by a local script. The checks covered: triggers, least-privilege permissions, concurrency, timeouts, checkout, Node 22, `npm ci`, browser install, typecheck, that every `npm run` script exists, that artifacts upload on failure, no `|| true` on test commands, and no hard-coded credentials. **Result: all valid.**
- The E2E workflow has no PR trigger, its booking input defaults to `false`, and it is gated by a GitHub Environment.
- `actionlint` was not run (downloading it was not permitted in this session). Run it locally or on the first PR.
