# CI/CD Guide (GitHub Actions)

Nothing has been pushed or run on GitHub. That needs your authorisation.

| Workflow | Triggers | Runs | Booking flags |
|---|---|---|---|
| `smoke-tests.yml` | PRs; pushes to `main`/`master`/`develop`; manual | typecheck → `npm run test:smoke` | forced `false` |
| `regression-tests.yml` | manual (environment, browser, extra tag); pushes to `release/**` | typecheck → `--grep @regression` (+ tag) | forced `false` (booking-creating checks report BLOCKED) |
| `scheduled-regression.yml` | cron `0 2 * * 1-5`; manual | Chromium regression + Firefox/WebKit smoke | forced `false` |
| **`e2e-tests.yml`** | **manual only** (`workflow_dispatch`) | typecheck → selected `@e2e` scope, 2 workers | **explicit opt-in inputs**, default `false` |

## E2E workflow safety
- **Never automatic:** there is no pull-request or push trigger, so it runs only when someone dispatches it.
- **Environments:** DEVTEST by default; PREPROD optional; PRODUCTION is not offered.
- **Opt-in inputs:** `allow_booking_submission` and `allow_payment_authentication` both default to **false**. Unticked, booking journeys report BLOCKED (PAYMENT AUTHORISATION REQUIRED).
- **Approval gate:** the job runs in GitHub Environment `e2e-devtest` or `e2e-preprod`. **Add required reviewers** to these environments (Settings → Environments) so every E2E run needs approval.
- **Secrets:** come only from repository or environment secrets, and are scrubbed from text artifacts by the summary reporter. Signed-in specs record no trace, video or screenshot.
- **Artifacts:** uploaded even when tests fail (`if: ${{ !cancelled() }}`). The run summary lists failed and BLOCKED tests with reasons.

## Required configuration
| Name | Type | Used by |
|---|---|---|
| `PRIME_EMAIL`, `PRIME_PASSWORD` | Secret | all |
| `AFFILIATE_EMAIL`, `AFFILIATE_PASSWORD` | Secret | all |
| `TEST_CARD_NUMBER`, `TEST_CARD_EXPIRY`, `TEST_CARD_CVV`, `TEST_CARD_PIN`, `TEST_CARD_OTP` | Secret (test-mode card only) | `e2e-tests.yml` |
| `TEST_ENV` | Variable | all (default `DEVTEST`) |
| `e2e-devtest`, `e2e-preprod` | Environments with required reviewers | `e2e-tests.yml` |

## Tags
`@smoke @regression @e2e` · `@flights @hotels @packages @tours @visa @travel-addons @prime @prime-flights @prime-hotels @affiliate` · `@payment @confirmation` · `@positive @negative @boundary @critical`

## Validation performed
- All four workflow files were parsed with Playwright's bundled YAML parser and checked structurally by a local script. The checks covered: triggers, least-privilege permissions, concurrency, timeouts, checkout, Node 22, `npm ci`, browser install, typecheck, that every `npm run` script exists, that artifacts upload on failure, no `|| true` on test commands, and no hard-coded credentials. **Result: all valid.**
- The E2E workflow has no PR trigger, its booking input defaults to `false`, and it is gated by a GitHub Environment.
- `actionlint` was not run (downloading it was not permitted in this session). Run it locally or on the first PR.
