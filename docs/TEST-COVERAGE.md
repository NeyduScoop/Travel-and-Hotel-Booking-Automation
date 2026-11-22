# Test Coverage Matrix

Generated on 2026-11-22 from `npx playwright test --list` (the actual test files) and the Chromium results in `reports/execution/2026-11-22`.
Regenerate after adding tests; hand-edited counts drift.

**204 tests in 35 spec files** (Smoke 40 · Regression 153 · E2E 11). Smoke also runs on Firefox and WebKit.

Chromium status in this run — PASS: 169 · FAIL: 30 · Blocked: 5 · not executed: 0.

Statuses are the **latest Chromium result for each test on 2026-11-22**. The base is the full run (`2026-11-22`, 14:30–15:58); later re-runs replace it for the tests they covered:
- `retest2`: Hotels / PRIME / Packages E2E, flight and PRIME regression.
- `retest3`: PRIME, Packages, hotel-details.
- `retest4`: PRIME E2E, run one at a time.
- `retest5-prime`: Prime membership regression run alone. Its 4 signup tests had timed out once under concurrent load.

Smoke statuses are from the full run. Visa was re-run with the updated data (Ghana passport) and is still BLOCKED, because no configured destination is offered.

Changes since the full run:
- **Hotels E2E now PASSES:** the confirmation parser was fixed, a hotel that can't be booked is skipped, and name and add-on-name differences are recorded rather than failed (owner).
- **REG-008 and TC-FLT-012 (both) pass.**
- **PRIME Hotels E2E** fails on D-27 (Paystack "Payment Successful" but Wakanow PAYMENT FAILED) and D-11.
- **PRIME Flights E2E** last failed on environment slowness. Its Kalabash fallback reached PAYMENT SUCCESSFUL in `retest2` (D-10 only).
- **Packages E2E** fails only on D-21 (₦1).

The defects behind each FAIL are in `docs/EXECUTION-REPORT.md`, sections 4, 5 and 9–11. Previous matrices are in `docs/history/` (`TEST-COVERAGE-2026-11-22-fullrun.md`, `TEST-COVERAGE-2026-11-16-run2.md`).

Status key: **Automated · PASS / FAIL** = the test exists and ran with that result (a FAIL is an application defect or an open automation issue, see `docs/EXECUTION-REPORT.md`) · **Blocked** = the test exists and reported BLOCKED with a categorised reason (missing data, inventory, credentials or payment authorisation) · **Not automated** = listed at the end with the reason.

Priority: **Critical** = tagged `@critical` (core booking path, pricing or safety); **Standard** otherwise.

## Summary by module

| Module | Smoke | Regression | E2E | Total | PASS | FAIL | Blocked |
|---|---:|---:|---:|---:|---:|---:|---:|
| PRIME Flights | 1 | 3 | 1 | 5 | 2 | 3 | 0 |
| PRIME Hotels | 1 | 1 | 1 | 3 | 1 | 2 | 0 |
| Affiliate | 2 | 4 | 1 | 7 | 4 | 3 | 0 |
| Packages | 3 | 5 | 1 | 9 | 7 | 2 | 0 |
| Travel Add-ons | 3 | 16 | 1 | 20 | 18 | 2 | 0 |
| Tours | 3 | 13 | 1 | 17 | 15 | 2 | 0 |
| Visa | 3 | 8 | 1 | 12 | 7 | 0 | 5 |
| Hotels | 4 | 22 | 1 | 27 | 24 | 3 | 0 |
| Flights | 7 | 62 | 3 | 72 | 60 | 12 | 0 |
| Prime (membership and sign-in) | 6 | 16 | 0 | 22 | 21 | 1 | 0 |
| Cross-module | 7 | 3 | 0 | 10 | 10 | 0 | 0 |
| **Total** | 40 | 153 | 11 | 204 | 169 | 30 | 5 |

A test belongs to the most specific module tag it carries (for example, a PRIME flight test counts under PRIME Flights, not Flights).

## PRIME Flights (5 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| PFL-E-01 | PRIME Flights E2E › signed-in PRIME member: account members as passengers → member fare → Paystack (Kalabash fallback) → confirmation | E2E | Critical | confirmation, payment | Automated · **FAIL** | `tests/e2e/prime-flights/prime-flights.e2e.spec.ts:16` |
| PFL-R-01 | PRIME Flights and Hotels regression › PRIME flight cards show member pricing at the advertised discount | Regression | Critical | — | Automated · **FAIL** | `tests/regression/prime/prime-booking.regression.spec.ts:35` |
| PFL-R-02 | PRIME Flights and Hotels regression › PRIME flight cart: passengers are the account's eligible PRIME members, Main Traveller kept | Regression | Critical | — | Automated · PASS | `tests/regression/prime/prime-booking.regression.spec.ts:48` |
| PFL-R-03 | PRIME Flights and Hotels regression › PRIME flight cart total equals the advertised PRIME fare and its own line items | Regression | Critical | negative | Automated · **FAIL** | `tests/regression/prime/prime-booking.regression.spec.ts:71` |
| PFL-S-01 | PRIME authentication smoke › PRIME Flights access: member fares and "Book with Prime" are offered | Smoke | Critical | — | Automated · PASS | `tests/smoke/prime/prime-auth.smoke.spec.ts:30` |

## PRIME Hotels (3 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| PHT-E-01 | PRIME Hotels E2E › signed-in PRIME member: account members as guests → room (new tab) → Paystack (Kalabash fallback) → confirmation | E2E | Critical | confirmation, payment | Automated · **FAIL** | `tests/e2e/prime-hotels/prime-hotels.e2e.spec.ts:16` |
| PHT-R-01 | PRIME Flights and Hotels regression › PRIME hotel listing, room and cart show the member discount consistently | Regression | Critical | — | Automated · **FAIL** | `tests/regression/prime/prime-booking.regression.spec.ts:86` |
| PHT-S-01 | PRIME authentication smoke › PRIME Hotels access: hotel results load for a signed-in member | Smoke | Critical | — | Automated · PASS | `tests/smoke/prime/prime-auth.smoke.spec.ts:40` |

## Affiliate (7 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| AFF-E-01 | Affiliate E2E › signed-in affiliate books Travel Add-ons with Pay at Bank; session kept and booking attributed | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/affiliate/affiliate.e2e.spec.ts:17` |
| AFF-R-01 | Affiliate regression › invalid affiliate credentials are rejected and no session is stored | Regression | Critical | negative | Automated · PASS | `tests/regression/affiliate/affiliate.regression.spec.ts:8` |
| AFF-R-02 | Affiliate regression › affiliate session is retained across navigation and reload | Regression | Critical | positive | Automated · PASS | `tests/regression/affiliate/affiliate.regression.spec.ts:19` |
| AFF-R-03 | Affiliate regression › a signed-in affiliate is recognised in the interface | Regression | Standard | negative | Automated · **FAIL** | `tests/regression/affiliate/affiliate.regression.spec.ts:29` |
| AFF-R-04 | Affiliate regression › the affiliate dashboard promised on the login page exists | Regression | Standard | negative | Automated · **FAIL** | `tests/regression/affiliate/affiliate.regression.spec.ts:37` |
| AFF-S-01 | Affiliate smoke › affiliate login screen is reachable and its form gates submission | Smoke | Critical | positive | Automated · PASS | `tests/smoke/affiliate/affiliate.smoke.spec.ts:7` |
| AFF-S-02 | Affiliate smoke › affiliate can sign in and the affiliate session is stored | Smoke | Critical | positive | Automated · PASS | `tests/smoke/affiliate/affiliate.smoke.spec.ts:15` |

## Packages (9 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| PKG-E-01 | Packages E2E › fallback destination → hotel (new tab) → room → flight → PAX → pay → confirmation | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/packages/packages.e2e.spec.ts:14` |
| PKG-R-01 | Packages regression › package fallback: configured destinations are tried in priority order until one has results | Regression | Critical | positive | Automated · PASS | `tests/regression/packages/packages.regression.spec.ts:13` |
| PKG-R-02 | Packages regression › hotel step results match the package search criteria | Regression | Standard | positive | Automated · PASS | `tests/regression/packages/packages.regression.spec.ts:37` |
| PKG-R-03 | Packages regression › package hotel details keep the listing hotel name | Regression | Standard | negative | Automated · PASS | `tests/regression/packages/packages.regression.spec.ts:52` |
| PKG-R-04 | Packages regression › room reservation advances to the round-trip flight step for the package route | Regression | Critical | positive | Automated · PASS | `tests/regression/packages/packages.regression.spec.ts:62` |
| PKG-R-05 | Packages regression › package cart contains hotel and flight, and its total equals the line items | Regression | Critical | negative | Automated · **FAIL** | `tests/regression/packages/packages.regression.spec.ts:80` |
| PKG-S-01 | Packages smoke › packages module loads from the header with the search widget | Smoke | Critical | positive | Automated · PASS | `tests/smoke/packages/packages.smoke.spec.ts:8` |
| PKG-S-02 | Packages smoke › configured departure, primary destination, dates and travellers can be entered | Smoke | Standard | positive | Automated · PASS | `tests/smoke/packages/packages.smoke.spec.ts:20` |
| PKG-S-03 | Packages smoke › building a package opens the hotel step with hotels or a valid empty state | Smoke | Critical | positive | Automated · PASS | `tests/smoke/packages/packages.smoke.spec.ts:29` |

## Travel Add-ons (20 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| ADD-E-01 | Travel Add-ons E2E › search → select two add-ons → cart → PAX (PNR, time of travel) → Pay at Bank → confirmation | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/travel-addons/travel-addons.e2e.spec.ts:12` |
| ADD-R-01 | Passenger page and form validation › Travel Add-ons: title options are all selectable and retained | Regression | Standard | positive | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:43` |
| ADD-R-02 | Passenger page and form validation › Travel Add-ons: PNR, time of travel and middle name accept valid input | Regression | Standard | positive | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:75` |
| ADD-R-03 | Passenger page and form validation › Travel Add-ons: time of travel is required | Regression | Standard | negative | Automated · **FAIL** | `tests/regression/common/passenger-forms.regression.spec.ts:86` |
| ADD-R-04 | Passenger page and form validation › Passport upload: image is accepted and OCR populates the traveller fields | Regression | Critical | — | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:118` |
| ADD-R-05 | Passenger page and form validation › Passport upload only accepts image files | Regression | Standard | negative | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:149` |
| ADD-R-06 | Passenger page and form validation › Contact email and phone keep their values after moving between fields | Regression | Standard | positive | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:155` |
| ADD-R-07 | Passenger page – completed form enables payment › Travel Add-ons: complete valid form (incl. PNR and time of travel) enables payment | Regression | Standard | positive | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:167` |
| ADD-R-08 | Payment step and booking summary › Travel Add-ons: payment options, selection and summary = payment card total | Regression | Critical | payment | Automated · PASS | `tests/regression/common/payment-and-summary.regression.spec.ts:37` |
| ADD-R-09 | Travel Add-ons regression › search without a departure airport shows no add-ons | Regression | Standard | negative | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:26` |
| ADD-R-10 | Travel Add-ons regression › search URL and heading reflect the departure and date | Regression | Standard | positive | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:33` |
| ADD-R-11 | Travel Add-ons regression › every listed add-on shows a positive adult price | Regression | Standard | positive | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:40` |
| ADD-R-12 | Travel Add-ons regression › two add-ons appear in the selection with a correct total | Regression | Critical | positive | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:45` |
| ADD-R-13 | Travel Add-ons regression › removing an add-on updates the selection and total | Regression | Standard | positive | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:59` |
| ADD-R-14 | Travel Add-ons regression › quantity follows the passenger count | Regression | Standard | boundary | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:68` |
| ADD-R-15 | Travel Add-ons regression › selection persists into the cart with the same total (booking association) | Regression | Critical | positive | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:83` |
| ADD-R-16 | Travel Add-ons regression › cart travel details accept the configured PNR and time of travel | Regression | Standard | positive | Automated · PASS | `tests/regression/travel-addons/travel-addons.regression.spec.ts:97` |
| ADD-S-01 | Travel Add-ons smoke › Travel Add-ons is reachable from the homepage sub-header tab | Smoke | Critical | positive | Automated · PASS | `tests/smoke/travel-addons/travel-addons.smoke.spec.ts:7` |
| ADD-S-02 | Travel Add-ons smoke › searching the configured departure lists available add-ons | Smoke | Critical | positive | Automated · PASS | `tests/smoke/travel-addons/travel-addons.smoke.spec.ts:17` |
| ADD-S-03 | Travel Add-ons smoke › an add-on can be selected into the selection panel | Smoke | Standard | positive | Automated · PASS | `tests/smoke/travel-addons/travel-addons.smoke.spec.ts:28` |

## Tours (17 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| TUR-E-01 | Tours E2E › Configured destination: search → tour → option → PAX + supplier questions → pay → confirmation | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/tours/tours.e2e.spec.ts:11` |
| TUR-R-01 | Passenger page and form validation › Tours: title options are all selectable and retained | Regression | Standard | positive | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:51` |
| TUR-R-02 | Passenger page and form validation › Tours: supplier questions are required before payment | Regression | Standard | negative | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:97` |
| TUR-R-03 | Passenger page and form validation › Tours: supplier questions are presented in English | Regression | Standard | negative | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:110` |
| TUR-R-04 | Payment step and booking summary › Tours: payment options, selection and summary = payment card total | Regression | Standard | payment | Automated · **FAIL** | `tests/regression/common/payment-and-summary.regression.spec.ts:67` |
| TUR-R-05 | Tours regression › search without country/destination does not run | Regression | Standard | negative | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:20` |
| TUR-R-06 | Tours regression › destination list is scoped to the selected country | Regression | Standard | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:27` |
| TUR-R-07 | Tours regression › results heading, count and URL reflect the search | Regression | Critical | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:37` |
| TUR-R-08 | Tours regression › category filter narrows the result set | Regression | Standard | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:44` |
| TUR-R-09 | Tours regression › price (low–high) sort orders "From" prices ascending | Regression | Standard | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:52` |
| TUR-R-10 | Tours regression › price (high–low) sort orders "From" prices descending | Regression | Standard | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:62` |
| TUR-R-11 | Tours regression › tour details keep the selected tour, travellers and availability options | Regression | Critical | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:72` |
| TUR-R-12 | Tours regression › tour total equals per-adult price × travellers | Regression | Critical | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:84` |
| TUR-R-13 | Tours regression › Book now is enabled once a tour option is selected | Regression | Critical | positive | Automated · PASS | `tests/regression/tours/tours.regression.spec.ts:92` |
| TUR-S-01 | Tours smoke › tours module loads; destination is gated by country | Smoke | Critical | positive | Automated · PASS | `tests/smoke/tours/tours.smoke.spec.ts:7` |
| TUR-S-02 | Tours smoke › tour search returns experiences with category filters available | Smoke | Critical | positive | Automated · PASS | `tests/smoke/tours/tours.smoke.spec.ts:16` |
| TUR-S-03 | Tours smoke › a tour can be selected and its options are shown | Smoke | Standard | positive | Automated · PASS | `tests/smoke/tours/tours.smoke.spec.ts:30` |

## Visa (12 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| VSA-E-01 | Visa E2E › configured destination: requirements → contact → Get Started → applicant → payment → confirmation | E2E | Critical | confirmation | Blocked | `tests/e2e/visa/visa.e2e.spec.ts:14` |
| VSA-R-01 | Visa regression › traveller count cannot go below one | Regression | Standard | boundary | Automated · PASS | `tests/regression/visa/visa.regression.spec.ts:27` |
| VSA-R-02 | Visa regression › passport country search filters to the configured country | Regression | Standard | positive | Automated · PASS | `tests/regression/visa/visa.regression.spec.ts:34` |
| VSA-R-03 | Visa regression › destination list is populated for the passport country | Regression | Standard | positive | Automated · PASS | `tests/regression/visa/visa.regression.spec.ts:39` |
| VSA-R-04 | Visa regression › an unknown destination returns no suggestions | Regression | Standard | negative | Automated · PASS | `tests/regression/visa/visa.regression.spec.ts:46` |
| VSA-R-05 | Visa regression › requirements are not shown without a destination | Regression | Standard | negative | Automated · PASS | `tests/regression/visa/visa.regression.spec.ts:51` |
| VSA-R-06 | Visa regression › configured destination shows requirements, documents and order summary | Regression | Critical | positive | Blocked | `tests/regression/visa/visa.regression.spec.ts:57` |
| VSA-R-07 | Visa regression › order summary total equals the Get Started amount | Regression | Standard | positive | Blocked | `tests/regression/visa/visa.regression.spec.ts:65` |
| VSA-R-08 | Visa regression › removing the consultation reduces the total by the consultation fee | Regression | Standard | positive | Blocked | `tests/regression/visa/visa.regression.spec.ts:73` |
| VSA-S-01 | Visa smoke › visa module loads with eligibility form and visa types | Smoke | Critical | positive | Automated · PASS | `tests/smoke/visa/visa.smoke.spec.ts:9` |
| VSA-S-02 | Visa smoke › traveller counter and passport country controls are functional | Smoke | Standard | positive | Automated · PASS | `tests/smoke/visa/visa.smoke.spec.ts:17` |
| VSA-S-03 | Visa smoke › visa package selection is available for a configured destination | Smoke | Critical | — | Blocked | `tests/smoke/visa/visa.smoke.spec.ts:28` |

## Hotels (27 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| HTL-E-01 | Hotels E2E › Primary destination: search → hotel (new tab) → room → guests → add-ons → pay → confirmation | E2E | Critical | confirmation | Automated · PASS | `tests/e2e/hotels/hotels.e2e.spec.ts:11` |
| HTL-R-01 | Hotels regression – details, rooms, pricing, booking hand-off › View Deal opens hotel details in a new tab within 70 s | Regression | Critical | positive | Automated · PASS | `tests/regression/hotels/hotel-details.regression.spec.ts:30` |
| HTL-R-02 | Hotels regression – details, rooms, pricing, booking hand-off › policies show the searched check-in and check-out dates | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-details.regression.spec.ts:40` |
| HTL-R-03 | Hotels regression – details, rooms, pricing, booking hand-off › room per-night price equals room total / nights | Regression | Critical | negative | Automated · **FAIL** | `tests/regression/hotels/hotel-details.regression.spec.ts:47` |
| HTL-R-04 | Hotels regression – details, rooms, pricing, booking hand-off › listing price matches the lowest room total on the details page | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-details.regression.spec.ts:56` |
| HTL-R-05 | Hotels regression – details, rooms, pricing, booking hand-off › policy content is rendered without raw HTML markup | Regression | Standard | negative | Automated · PASS | `tests/regression/hotels/hotel-details.regression.spec.ts:62` |
| HTL-R-06 | Hotels regression – details, rooms, pricing, booking hand-off › reserving a room carries the room total into the cart | Regression | Critical | positive | Automated · PASS | `tests/regression/hotels/hotel-details.regression.spec.ts:67` |
| HTL-R-07 | Hotels regression – details, rooms, pricing, booking hand-off › guest information with canonical data enables payment (not submitted) | Regression | Standard | positive | Automated · **FAIL** | `tests/regression/hotels/hotel-details.regression.spec.ts:79` |
| HTL-R-08 (REG-001) | Hotels regression – results, Umrah rules, sorting, filters › REG-001: Umrah hotels are listed with a distinct Umrah badge | Regression | Critical | positive | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:23` |
| HTL-R-09 (REG-013) | Hotels regression – results, Umrah rules, sorting, filters › REG-013 / REG-023: Umrah properties are prioritised before other properties | Regression | Critical | positive | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:29` |
| HTL-R-10 | Hotels regression – results, Umrah rules, sorting, filters › listing per-night price equals total / nights | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:37` |
| HTL-R-11 | Hotels regression – results, Umrah rules, sorting, filters › "Showing X of Y" is consistent with the cards rendered | Regression | Standard | negative | Automated · **FAIL** | `tests/regression/hotels/hotel-results.regression.spec.ts:45` |
| HTL-R-12 | Hotels regression – results, Umrah rules, sorting, filters › "Price ↑" sorts totals ascending | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:54` |
| HTL-R-13 | Hotels regression – results, Umrah rules, sorting, filters › "Price ↓" sorts totals descending | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:64` |
| HTL-R-14 | Hotels regression – results, Umrah rules, sorting, filters › hotel name filter narrows results to matching properties | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:74` |
| HTL-R-15 | Hotels regression – results, Umrah rules, sorting, filters › a non-matching hotel name filter shows no cards | Regression | Standard | negative | Automated · PASS | `tests/regression/hotels/hotel-results.regression.spec.ts:83` |
| HTL-R-16 | Hotels regression – search widget validation › empty search does not navigate to results | Regression | Standard | negative | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:11` |
| HTL-R-17 | Hotels regression – search widget validation › destination is required | Regression | Standard | negative | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:18` |
| HTL-R-18 | Hotels regression – search widget validation › past check-in dates cannot be selected | Regression | Standard | boundary | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:25` |
| HTL-R-19 | Hotels regression – search widget validation › check-out cannot be on or before check-in | Regression | Standard | boundary | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:32` |
| HTL-R-20 | Hotels regression – search widget validation › each child requires an age selection (0-17) | Regression | Standard | boundary | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:41` |
| HTL-R-21 | Hotels regression – search widget validation › room and adult counters cannot go below one | Regression | Standard | boundary | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:53` |
| HTL-R-22 | Hotels regression – search widget validation › multi-room configuration is reflected in the summary | Regression | Standard | positive | Automated · PASS | `tests/regression/hotels/hotel-search.regression.spec.ts:60` |
| HTL-S-01 | Hotels smoke › hotel module loads with the search widget | Smoke | Critical | positive | Automated · PASS | `tests/smoke/hotels/hotels.smoke.spec.ts:11` |
| HTL-S-02 | Hotels smoke › configured destination can be selected from the autocomplete | Smoke | Standard | positive | Automated · PASS | `tests/smoke/hotels/hotels.smoke.spec.ts:19` |
| HTL-S-03 | Hotels smoke › check-in/check-out dates and guest/room configuration apply | Smoke | Standard | positive | Automated · PASS | `tests/smoke/hotels/hotels.smoke.spec.ts:25` |
| HTL-S-04 | Hotels smoke › search runs and shows hotels or a valid empty state | Smoke | Critical | positive | Automated · PASS | `tests/smoke/hotels/hotels.smoke.spec.ts:33` |

## Flights (72 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| FLT-E-01 | Flights E2E › one-way departure→destination: search → select → PAX → pay → confirmation | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/flights/flights.e2e.spec.ts:62` |
| FLT-E-02 | Flights E2E › round-trip with canonical 2 adults / 1 child / 1 infant: search → select → PAX → pay → confirmation | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/flights/flights.e2e.spec.ts:72` |
| FLT-E-03 | Flights E2E › multi-city departure→destination→departure: search → select → PAX → pay → confirmation | E2E | Critical | confirmation | Automated · **FAIL** | `tests/e2e/flights/flights.e2e.spec.ts:85` |
| FLT-R-01 | Passenger page and form validation › Flights: title options per traveller type are all selectable and retained | Regression | Standard | positive | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:31` |
| FLT-R-02 | Payment step and booking summary › Flights: payment options, selection and summary = payment card total | Regression | Critical | payment | Automated · **FAIL** | `tests/regression/common/payment-and-summary.regression.spec.ts:47` |
| FLT-R-03 | Payment step and booking summary › Flights: price confirmed at the cart is the price charged at the payment step | Regression | Critical | payment, negative | Automated · PASS | `tests/regression/common/payment-and-summary.regression.spec.ts:55` |
| FLT-R-04 | Payment step and booking summary › Flights cart: adding and removing an add-on updates the total and the summary list | Regression | Critical | payment | Automated · PASS | `tests/regression/common/payment-and-summary.regression.spec.ts:75` |
| FLT-R-05 | Payment step and booking summary › Flights cart: add-ons are not pre-selected without the customer opting in | Regression | Standard | payment, negative | Automated · **FAIL** | `tests/regression/common/payment-and-summary.regression.spec.ts:97` |
| FLT-R-06 (REG-008) | Flights regression – selection, cart and traveller form › selected flight carries route, price, duration and baggage into the cart (REG-008/REG-009) | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:22` |
| FLT-R-07 | Flights regression – selection, cart and traveller form › Proceed to Pay stays disabled until traveller details are complete | Regression | Critical | negative | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:41` |
| FLT-R-08 | Flights regression – selection, cart and traveller form › required-field and format validation messages are shown | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:47` |
| FLT-R-09 | Flights regression – selection, cart and traveller form › invalid email "not-an-email" is rejected | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:65` |
| FLT-R-10 | Flights regression – selection, cart and traveller form › invalid email "missing-at.example.com" is rejected | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:65` |
| FLT-R-11 | Flights regression – selection, cart and traveller form › invalid email "user@" is rejected | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:65` |
| FLT-R-12 | Flights regression – selection, cart and traveller form › invalid email "@example.com" is rejected | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:65` |
| FLT-R-13 | Flights regression – selection, cart and traveller form › phone number length boundaries (9-11 digits) | Regression | Standard | boundary | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:74` |
| FLT-R-14 | Flights regression – selection, cart and traveller form › valid canonical traveller data enables Proceed to Pay (payment not submitted) | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:88` |
| FLT-R-15 (REG-004) | Flights regression – selection, cart and traveller form › multi-passenger booking renders one traveller block per passenger with nationality (REG-004) | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:98` |
| FLT-R-16 | Flights regression – selection, cart and traveller form › canonical 2 adult / 1 child / 1 infant traveller data can be entered | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:107` |
| FLT-R-17 | Flights regression – selection, cart and traveller form › removing the flight empties the booking summary | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-booking.regression.spec.ts:116` |
| FLT-R-18 (TC-FLT-001) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-001 round-trip search through the widget carries every criterion into results | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:29` |
| FLT-R-19 (TC-FLT-002) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-002 multi-city: every configured leg can be entered and searched | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:52` |
| FLT-R-20 (TC-FLT-003) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-003 multi-city results show every searched departure and destination | Regression | Critical | negative | Automated · **FAIL** | `tests/regression/flights/flight-critical.regression.spec.ts:69` |
| FLT-R-21 (TC-FLT-004) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-004 cabin "Economy" is retained in criteria and results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:85` |
| FLT-R-22 (TC-FLT-004) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-004 cabin "Premium Economy" is retained in criteria and results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:85` |
| FLT-R-23 (TC-FLT-004) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-004 cabin "Business" is retained in criteria and results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:85` |
| FLT-R-24 (TC-FLT-004) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-004 cabin "First Class" is retained in criteria and results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:85` |
| FLT-R-25 (TC-FLT-005) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-005 round-trip results price both directions as one itinerary | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:94` |
| FLT-R-26 (TC-FLT-005) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-005 multi-city results price every leg as one itinerary | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:109` |
| FLT-R-27 (TC-FLT-006) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-006 one-way card accessible name announces the searched destination | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:117` |
| FLT-R-28 (TC-FLT-006) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-006 multi-city card accessible name announces the searched destinations | Regression | Standard | negative | Automated · **FAIL** | `tests/regression/flights/flight-critical.regression.spec.ts:125` |
| FLT-R-29 (TC-FLT-007) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-007 best-deals grid lists airlines and prices under the right stop category | Regression | Critical | positive | Automated · **FAIL** | `tests/regression/flights/flight-critical.regression.spec.ts:132` |
| FLT-R-30 (TC-FLT-008) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-008 airline group dropdown expands to all cards and collapses again | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:151` |
| FLT-R-31 (TC-FLT-009) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-009 "1 stop" filter shows only matching itineraries | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:170` |
| FLT-R-32 (TC-FLT-009) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-009 "2+ stops" filter shows only matching itineraries | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:170` |
| FLT-R-33 (TC-FLT-010) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-010 card durations equal elapsed time across time zones, midnight and layovers | Regression | Critical | positive | Automated · **FAIL** | `tests/regression/flights/flight-critical.regression.spec.ts:184` |
| FLT-R-34 (TC-FLT-011) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-011 one-way details show flight numbers, legs, airports and baggage consistent with the card | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:205` |
| FLT-R-35 (TC-FLT-011) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-011 round-trip details show flight numbers, legs, airports and baggage consistent with the card | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:205` |
| FLT-R-36 (TC-FLT-011) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-011 multi-city details show one leg per searched segment | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:226` |
| FLT-R-37 (TC-FLT-012) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-012 one-way: PAX page itinerary matches the selected flight | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:236` |
| FLT-R-38 (TC-FLT-012) | Flights regression – critical scenarios (TC-FLT-001…012) › TC-FLT-012 round-trip: PAX page itinerary matches the selected flight | Regression | Critical | positive | Automated · PASS | `tests/regression/flights/flight-critical.regression.spec.ts:236` |
| FLT-R-39 | Flights regression – results, sorting, filters, details › one-way results match the searched route and show prices | Regression | Critical | positive | Automated · **FAIL** | `tests/regression/flights/flight-results.regression.spec.ts:24` |
| FLT-R-40 | Flights regression – results, sorting, filters, details › round-trip results summary reflects route, dates, travellers and cabin | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:37` |
| FLT-R-41 | Flights regression – results, sorting, filters, details › round-trip card accessible name announces the searched destination | Regression | Standard | negative | Automated · **FAIL** | `tests/regression/flights/flight-results.regression.spec.ts:46` |
| FLT-R-42 | Flights regression – results, sorting, filters, details › passenger combination "1 adult" is carried into results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:54` |
| FLT-R-43 | Flights regression – results, sorting, filters, details › passenger combination "2 adults + 1 child" is carried into results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:54` |
| FLT-R-44 | Flights regression – results, sorting, filters, details › passenger combination "1 adult + 1 infant" is carried into results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:54` |
| FLT-R-45 | Flights regression – results, sorting, filters, details › business cabin search is carried into results | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:61` |
| FLT-R-46 | Flights regression – results, sorting, filters, details › "Cheapest" sort orders fares ascending | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:67` |
| FLT-R-47 | Flights regression – results, sorting, filters, details › "Fastest" sort orders durations ascending | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:74` |
| FLT-R-48 | Flights regression – results, sorting, filters, details › "Direct" stops filter shows only direct flights | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:81` |
| FLT-R-49 | Flights regression – results, sorting, filters, details › airline filter shows only the chosen airline | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:94` |
| FLT-R-50 (REG-008) | Flights regression – results, sorting, filters, details › flight details show flight number, legs and baggage consistent with the card (REG-008) | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-results.regression.spec.ts:105` |
| FLT-R-51 | Flights regression – search widget validation › empty search does not navigate to results | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:11` |
| FLT-R-52 | Flights regression – search widget validation › origin is required: destination and dates alone do not search | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:19` |
| FLT-R-53 | Flights regression – search widget validation › destination is required: origin and dates alone do not search | Regression | Standard | negative | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:27` |
| FLT-R-54 | Flights regression – search widget validation › same origin and destination is rejected | Regression | Critical | negative | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:35` |
| FLT-R-55 | Flights regression – search widget validation › past departure dates cannot be selected | Regression | Standard | boundary | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:44` |
| FLT-R-56 | Flights regression – search widget validation › return date cannot be earlier than departure | Regression | Standard | boundary | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:52` |
| FLT-R-57 | Flights regression – search widget validation › one-way search hides the return date | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:61` |
| FLT-R-58 | Flights regression – search widget validation › swap exchanges origin and destination | Regression | Standard | positive | Automated · **FAIL** | `tests/regression/flights/flight-search-validation.regression.spec.ts:67` |
| FLT-R-59 (REG-005) | Flights regression – search widget validation › REG-005: typing into a populated location field replaces its text | Regression | Standard | positive | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:75` |
| FLT-R-60 | Flights regression – search widget validation › adults cannot go below one | Regression | Standard | boundary | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:84` |
| FLT-R-61 | Flights regression – search widget validation › infants cannot exceed adults | Regression | Standard | boundary, negative | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:92` |
| FLT-R-62 | Flights regression – search widget validation › total travellers are capped | Regression | Standard | boundary | Automated · PASS | `tests/regression/flights/flight-search-validation.regression.spec.ts:100` |
| FLT-S-01 | Flights smoke › flight module loads with the full search widget | Smoke | Critical | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:12` |
| FLT-S-02 | Flights smoke › origin and destination autocomplete select the configured airports | Smoke | Standard | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:24` |
| FLT-S-03 | Flights smoke › trip type can be switched between round trip and one way | Smoke | Standard | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:31` |
| FLT-S-04 | Flights smoke › departure and return dates can be selected | Smoke | Standard | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:38` |
| FLT-S-05 | Flights smoke › passenger configuration applies the canonical 2 adults, 1 child, 1 infant | Smoke | Standard | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:44` |
| FLT-S-06 | Flights smoke › every cabin class can be selected | Smoke | Standard | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:49` |
| FLT-S-07 | Flights smoke › search runs and shows results or a valid empty state | Smoke | Critical | positive | Automated · PASS | `tests/smoke/flights/flights.smoke.spec.ts:53` |

## Prime (membership and sign-in) (22 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| PRM-R-01 | PRIME Flights and Hotels regression › session is retained across navigation and reload | Regression | Critical | positive | Automated · PASS | `tests/regression/prime/prime-booking.regression.spec.ts:17` |
| PRM-R-02 | PRIME Flights and Hotels regression › "My account" opens the member profile instead of the login page | Regression | Standard | negative | Automated · PASS | `tests/regression/prime/prime-booking.regression.spec.ts:28` |
| PRM-R-03 | Prime regression – membership plans and signup gate › Individual: join page tier, price and order summary match the plan | Regression | Critical | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:11` |
| PRM-R-04 | Prime regression – membership plans and signup gate › Individual: one traveller form per covered member | Regression | Standard | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:26` |
| PRM-R-05 | Prime regression – membership plans and signup gate › Duo (You + Me): join page tier, price and order summary match the plan | Regression | Critical | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:11` |
| PRM-R-06 | Prime regression – membership plans and signup gate › Duo (You + Me): one traveller form per covered member | Regression | Standard | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:26` |
| PRM-R-07 | Prime regression – membership plans and signup gate › Corporate: join page tier, price and order summary match the plan | Regression | Critical | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:11` |
| PRM-R-08 | Prime regression – membership plans and signup gate › Corporate: one traveller form per covered member | Regression | Standard | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:26` |
| PRM-R-09 | Prime regression – membership plans and signup gate › higher tiers are priced above lower tiers | Regression | Standard | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:35` |
| PRM-R-10 | Prime regression – membership plans and signup gate › signup email gate rejects "plainaddress" | Regression | Standard | negative | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:43` |
| PRM-R-11 | Prime regression – membership plans and signup gate › signup email gate rejects "missing-domain@" | Regression | Standard | negative | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:43` |
| PRM-R-12 | Prime regression – membership plans and signup gate › signup email gate rejects "spaces in@example.com" | Regression | Standard | negative | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:43` |
| PRM-R-13 | Prime regression – membership plans and signup gate › signup email gate accepts a valid email (not submitted) | Regression | Standard | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:50` |
| PRM-R-14 | Prime regression – membership plans and signup gate › "Back to plans" returns to the Prime landing page | Regression | Standard | positive | Automated · **FAIL** | `tests/regression/prime/prime.regression.spec.ts:57` |
| PRM-R-15 | Prime regression – membership plans and signup gate › login page requires a valid email before continuing | Regression | Standard | negative | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:64` |
| PRM-R-16 | Prime regression – membership plans and signup gate › PRIME member can sign in and is no longer offered "Log in/Sign up" | Regression | Critical | positive | Automated · PASS | `tests/regression/prime/prime.regression.spec.ts:73` |
| PRM-S-01 | PRIME authentication smoke › login readiness: email-first step leads to the password step | Smoke | Critical | positive | Automated · PASS | `tests/smoke/prime/prime-auth.smoke.spec.ts:9` |
| PRM-S-02 | PRIME authentication smoke › PRIME member signs in through the UI and gets the PRIME badge | Smoke | Critical | positive | Automated · PASS | `tests/smoke/prime/prime-auth.smoke.spec.ts:18` |
| PRM-S-03 | PRIME authentication smoke › cached PRIME session is recognised (used by the other PRIME tests) | Smoke | Standard | positive | Automated · PASS | `tests/smoke/prime/prime-auth.smoke.spec.ts:25` |
| PRM-S-04 | Prime smoke › Prime module loads with three membership tiers | Smoke | Critical | positive | Automated · PASS | `tests/smoke/prime/prime.smoke.spec.ts:6` |
| PRM-S-05 | Prime smoke › membership information (benefits and FAQ) is accessible | Smoke | Standard | positive | Automated · PASS | `tests/smoke/prime/prime.smoke.spec.ts:16` |
| PRM-S-06 | Prime smoke › join action opens the tier signup with an email gate | Smoke | Critical | positive | Automated · PASS | `tests/smoke/prime/prime.smoke.spec.ts:23` |

## Cross-module (10 tests)

| Test ID | Scenario | Suite | Priority | Type | Status | Spec |
|---|---|---|---|---|---|---|
| CMN-R-01 | Passenger page and form validation › Flights: Terms and Conditions must be accepted before payment | Regression | Critical | negative | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:60` |
| CMN-R-02 | Passenger page and form validation › Travel Add-ons: Terms and Conditions must be accepted before payment | Regression | Critical | negative | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:60` |
| CMN-R-03 | Passenger page and form validation › Tours: Terms and Conditions must be accepted before payment | Regression | Critical | negative | Automated · PASS | `tests/regression/common/passenger-forms.regression.spec.ts:60` |
| CMN-S-01 | Header navigation and homepage › homepage loads with header navigation and product tabs | Smoke | Critical | positive | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:5` |
| CMN-S-02 | Header navigation and homepage › header link "Flights" routes to /flights | Smoke | Standard | positive | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:17` |
| CMN-S-03 | Header navigation and homepage › header link "Hotels" routes to /hotels | Smoke | Standard | positive | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:17` |
| CMN-S-04 | Header navigation and homepage › header link "Tours" routes to /tours | Smoke | Standard | positive | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:17` |
| CMN-S-05 | Header navigation and homepage › header link "Visa" routes to /visa | Smoke | Standard | positive | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:17` |
| CMN-S-06 | Header navigation and homepage › header link "Prime" routes to /wakanow-prime | Smoke | Standard | positive | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:17` |
| CMN-S-07 (REG-022) | Header navigation and homepage › REG-022: PRIME landing modal does not block homepage search | Smoke | Critical | — | Automated · PASS | `tests/smoke/common/navigation.smoke.spec.ts:24` |

## Project.md regression scenarios: where each is covered

| Scenario | Coverage |
|---|---|
| REG-001, REG-013, REG-023 Umrah badge and prioritisation | Hotels regression (searches the configured Makkah destination) |
| REG-004, REG-005, REG-008, REG-009, REG-022 | Flights regression |
| REG-010 Flight + Hotel confirmation details | Packages E2E: the confirmation integrity check requires hotel, room, airline, route and dates |
| REG-020 Hotel search in the package flow | Packages regression (hotel step, Select2 reservation) |
| REG-002 PRIME-covered traveller discount (FE = BE) | Partly: PRIME Flights regression checks the cart total against its own line items and the advertised PRIME fare. The FE-versus-BE comparison needs a backend price API that has not been observed, so it is **not automated** |
| REG-019 Saved-traveller title auto-population | Partly: PRIME Flights/Hotels E2E and the PRIME regression select the account's PRIME members from the "Select traveller" dropdown (or type their account details when not offered) and check that the Main Traveller is prefilled and kept. A dedicated assertion that the title auto-populates is **not automated yet** |
| Payment routes (owner rule, 2026-11-22) | Every E2E uses `payAndConfirm()`: Pay at Bank → Bank Transfer (Instant Ticketing) → automated bank transfer → Card (Paystack TEST: Bank Authentication, or the `.env` test card). **PRIME Flights/Hotels:** Paystack first; Kalabash Wallet on a new booking only when Paystack fails (`withPaystackFallback`). The route used, every attempt, and whether Paystack showed "Payment Successful" are recorded per test. Verified 2026-11-22: Kalabash fallback PAYMENT SUCCESSFUL (PRIME Flights); Paystack on PRIME Hotels reaches "Payment Successful" but Wakanow records PAYMENT FAILED (D-27) |

## Not automated (with reason)

| Scenario | Reason |
|---|---|
| Prime membership purchase (Project.md §41) | The signup gate sends a real OTP and takes a real payment |
| REG-003 / REG-017 Hotel add-ons selection and filtering | Partly: Hotels E2E checks "Addons Total" = the selected add-ons. Add-on **names** are recorded as observations (owner, 2026-11-22): every hotel confirmation shows only the total (D-24). Selection and filtering behaviour needs Product confirmation |
| REG-014 / REG-015 / REG-016 / REG-021 / REG-024 Booking e-mails and confirmation country | They need mailbox access. REG-014 is merged into REG-021 |
| REG-025 PRIME discount on the flight invoice | Paid PRIME flight bookings are now possible (Kalabash Wallet), but the invoice document is not exposed on the confirmation page and has not been observed |
| REG-012 Technical-stop airport name | It needs a confirmed PHC→YEG booking with PNR. Not yet automated; test data is ready (`technicalStopScenario`). Flight confirmations are currently affected by D-22 (GeneratePNR HTTP 500) |
| REG-018 Duplicate-booking error message | It deliberately creates duplicate bookings. Deferred until a cleanup process for DEVTEST bookings is agreed |
| REG-006 Top-deals currency, REG-007 search-widget date reset, REG-011 sticky filters | Candidates for the next iteration |
| Visa applicant form, document upload, review and submission | These are reachable only after a configured destination is offered. None of the configured destinations (USA, UK, Angola) is offered on DEVTEST, so the pages were never observed and no page objects were invented |
