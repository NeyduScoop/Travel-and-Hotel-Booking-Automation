# Framework Architecture

## Layers
```
tests/{smoke,regression,e2e}/<module>/   assertions and journeys
  └─ fixtures/                           test.fixture → module.fixture → base.fixture (+ auth.session)
       ├─ utils/flows.ts                 reusable journey steps (to cart, complete cart, pay & confirm)
       ├─ pages/<module>/                page objects: locators and user actions
       │    └─ components/               widgets shared across pages
       ├─ utils/confirmation.ts          IntegrityCheck (expected vs actual confirmation data)
       ├─ data/ + utils/data.factory.ts  canonical data and fresh future dates
       └─ config/                        environments, safety flags, timeouts, browsers
reporters/summary-reporter.ts           PASS/FAIL/BLOCKED/SKIPPED per module and suite + secret scrubbing
```

## Page objects
| Area | Page objects |
|---|---|
| Common | `BasePage`: hydration settle, PRIME modal, app error dialog + `withAppRetry`. Also `NavigationPage`, `LoginPage` (customer/PRIME and affiliate sign-in, verified), `CartPage` (shared checkout, `proceedToPayment`, supplier questions, add-ons, payment), `ConfirmationPage` (`/summary/<id>`) |
| Flights | `FlightSearchPage` (incl. multi-city legs), `FlightResultsPage` (deep link, card parsing, best-deals grid, group dropdowns, PRIME price, layovers, leg times/durations), `FlightDetailsPage`, `FlightBookingPage` (next-flight selection rule + app retry) |
| Hotels | `HotelSearchPage`, `HotelResultsPage` (new-tab `openDeal`), `HotelDetailsPage`, `HotelBookingPage` (surfaces `Select2` failures) |
| Packages | `PackageSearchPage` (+ `PackageFallbackLog`), `PackageBuilderPage` (hotel step → room → flight step → package cart) |
| Tours | `TourSearchPage`, `TourResultsPage`, `TourDetailsPage` (option rule) |
| Visa | `VisaHomePage` (destination resolution in priority order), `VisaPackagePage` |
| Prime | `PrimeHomePage`, `PrimeMembershipPage`, `PrimeBookingPage` (member badge, Main Traveller snapshot, saved travellers, PRIME discount) |
| Affiliate | `AffiliateSessionPage` (stored session, implied dashboard routes) |
| Travel Add-ons | `TravelAddonsPage`, `AddonSelectionPage` |

## Components
| Component | Purpose |
|---|---|
| `search/LocationAutocomplete` | `wk-location` autocomplete, hydration-safe; clicks innermost options only (grouped city options nest airports) |
| `search/MultiCityLeg` | One multi-city leg (From/To/Departure/Cabin class) |
| `date-picker/DatePicker` | `wk-datepicker` single/range |
| `passengers/TravellerSelector` | `wk-pax` counters and child ages, hydration-safe open |
| `filters/FilterPanel`, `sorting/SortBar` | Results filters and sorting |
| `forms/ContactForm` | `contact.*`-scoped email/phone |
| `forms/TravellerForm` | `traveller.N.*`-scoped fields; title options; disabled-gender handling; fill / fillMissing (PRIME) / snapshot; saved travellers; passport upload |
| `forms/CountrySelect` | `wk-cs` searchable country picker (retried) |
| `booking/OrderSummary`, `booking/PriceBreakdown` | Summary CTA amounts; **independent** line-item parsing and expected-total computation |
| `booking/TripAddons` | "Enhance Your Trip" add/remove |
| `payment/PaymentSection` | Payment radiogroup (names read from the ARIA snapshot), selection, Make Payment amount, payment-card total, route policy, Pay at Bank submit, card-route gateway detection |
| `modals/PrimeModal` | Defensive PRIME landing modal handling (REG-022) |

## Payment architecture
1. `CartPage.proceedToPayment()` presses *Proceed to Pay*. This **creates the booking**. The method captures the booking id from `GET …/Payment/Get/<id>/<product>`, recovers from the app's "Something went wrong" dialog through its own **Try Again**, and waits for the `Payment method` radiogroup.
2. `PaymentSection.preferredRoute()` picks Pay at Bank first, then Card, and never Kalabash Wallet.
3. `utils/flows.ts payAndConfirm()`:
   - Pay at Bank: submits and waits for `/summary/<id>`.
   - Card: requires `ALLOW_TEST_PAYMENT_AUTHENTICATION`. `startCardRoute()` follows to the hosted gateway and raises `PaymentBlockedError` on a bot challenge or on unobserved gateway screens. The error becomes a categorised **BLOCKED**.
4. Safety gates live in fixtures: `requireCartCreation`, `requireBookingSubmission`, `requirePaymentAuthentication`, all driven by `config/environment.config.ts safety`.

Payment options observed on DEVTEST (2026-11-15):
| Product | Options |
|---|---|
| Flights / PRIME Flights | Bank Transfer (Auto Ticketing), Kalabash Wallet, Card payment (+ "Pay Small Small") |
| Travel Add-ons | Card, Bank Transfer Payment (Instant Ticketing), Book and Pay With ID, **Pay at Bank** |

## Authentication architecture
- `LoginPage.login()` covers the customer/PRIME flow: email → Continue → "Enter your password" → Sign in → "You're signed in" → Continue to Wakanow → header "My account" with a PRIME badge.
- `LoginPage.loginAsAffiliate()` covers the affiliate flow: `/auth/affiliate` → Affiliate ID or email + Password → `POST /api/affiliate/login` → "You're signed in".
- `fixtures/auth.session.ts` does one real sign-in per account, serialised across workers with a lock because concurrent sign-ins to one account hang. The cached state (git-ignored `playwright/.auth/`, 20 min) is applied to each test's own context as cookies and localStorage. `signedInPrime` and `signedInAffiliate` use it.
- `credentialSafeArtifacts` disables trace, video and screenshot for signed-in specs. The summary reporter scrubs secret values from artifacts.

## Affiliate architecture
- **Not in the UI:** the affiliate identity is not shown anywhere. The session is localStorage `wk_affiliate_agent` plus the `wk_access_token` cookie, and the header still says "Log in/Sign up". `/affiliate` and `/affiliate/dashboard` return 404.
- **Session checks:** `AffiliateSessionPage` verifies the session through storage and cookies, and records the dashboard-route results.
- **Booking (user-approved approach):** a normal booking made while signed in (Travel Add-ons + Pay at Bank). The E2E test checks session retention at every stage and looks for affiliate or agent fields in the booking API responses.

## Confirmation validation
`utils/confirmation.ts IntegrityCheck`:
- **Comparisons:** `equal` (exact or numeric), `contains`, `containsAny` (accepted renderings, e.g. `dateVariants()`), and `notApplicable` (requires a reason).
- **Reporting:** `assert()` attaches the full expected-vs-actual Markdown table, then fails once, listing every mismatch.
- **Use:** every E2E test builds one table covering booking reference, status, amount, route, dates, travellers, product details, add-ons, currency and the independent price integrity.

## E2E architecture
- **Layout:** `tests/e2e/<module>/` holds one journey per spec, built from `utils/flows.ts`: `flightToCart`, `addonsToCart`, `tourToCart`, `hotelToCart`, `completeStandardCart`, `payAndConfirm`, `priceIntegrity`.
- **Isolation:** journeys run independently with 2 workers and use spread future dates (`DataFactory.e2eOffsetDays`) to limit duplicate-booking clashes.
- **Ownership:** detailed validations stay in regression; E2E reuses the same page objects.
- **Fallbacks:** the package fallback rule (Project.md §12) is enforced by `PackageFallbackLog`. Visa resolves destinations in configured priority order and never substitutes an unconfigured one.

## Diagnostics
- **Failure artifacts:** screenshot, video and trace on failure (off for signed-in specs). `console-and-network.json` with first-party 4xx/5xx is attached to failures.
- **Annotations:** `observe()` records timings and facts; `booking` annotations record every booking id created.
- **Reporting:** `execution-summary.{md,json}` gives totals by module and by suite, failed tests with errors, and blocked tests with categorised reasons.
