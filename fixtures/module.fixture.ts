import { test as base } from './base.fixture';
import { NavigationPage } from '../pages/common/NavigationPage';
import { LoginPage } from '../pages/common/LoginPage';
import { CartPage } from '../pages/common/CartPage';
import { FlightSearchPage } from '../pages/flights/FlightSearchPage';
import { FlightResultsPage } from '../pages/flights/FlightResultsPage';
import { FlightDetailsPage } from '../pages/flights/FlightDetailsPage';
import { FlightBookingPage } from '../pages/flights/FlightBookingPage';
import { HotelSearchPage } from '../pages/hotels/HotelSearchPage';
import { HotelResultsPage } from '../pages/hotels/HotelResultsPage';
import { TourSearchPage } from '../pages/tours/TourSearchPage';
import { TourResultsPage } from '../pages/tours/TourResultsPage';
import { TourDetailsPage } from '../pages/tours/TourDetailsPage';
import { VisaHomePage } from '../pages/visa/VisaHomePage';
import { VisaPackagePage } from '../pages/visa/VisaPackagePage';
import { VisaApplicationPage } from '../pages/visa/VisaApplicationPage';
import { PrimeHomePage } from '../pages/prime/PrimeHomePage';
import { PrimeMembershipPage } from '../pages/prime/PrimeMembershipPage';
import { TravelAddonsPage } from '../pages/travel-addons/TravelAddonsPage';
import { AddonSelectionPage } from '../pages/travel-addons/AddonSelectionPage';
import { ConfirmationPage } from '../pages/common/ConfirmationPage';
import { PackageSearchPage } from '../pages/packages/PackageSearchPage';
import { PackageBuilderPage } from '../pages/packages/PackageBuilderPage';
import { PrimeBookingPage } from '../pages/prime/PrimeBookingPage';
import { PrimeAccountPage } from '../pages/prime/PrimeAccountPage';
import { AffiliateSessionPage } from '../pages/affiliate/AffiliateSessionPage';

export interface ModuleFixtures {
  navigation: NavigationPage;
  loginPage: LoginPage;
  cartPage: CartPage;
  flightSearch: FlightSearchPage;
  flightResults: FlightResultsPage;
  flightDetails: FlightDetailsPage;
  flightBooking: FlightBookingPage;
  hotelSearch: HotelSearchPage;
  hotelResults: HotelResultsPage;
  tourSearch: TourSearchPage;
  tourResults: TourResultsPage;
  tourDetails: TourDetailsPage;
  visaHome: VisaHomePage;
  visaPackage: VisaPackagePage;
  visaApplication: VisaApplicationPage;
  primeHome: PrimeHomePage;
  primeMembership: PrimeMembershipPage;
  travelAddons: TravelAddonsPage;
  addonSelection: AddonSelectionPage;
  confirmationPage: ConfirmationPage;
  packageSearch: PackageSearchPage;
  packageBuilder: PackageBuilderPage;
  primeBooking: PrimeBookingPage;
  primeAccountPage: PrimeAccountPage;
  affiliateSession: AffiliateSessionPage;
}

/** Page objects are created per test from that test's isolated page/context. */
export const test = base.extend<ModuleFixtures>({
  navigation: async ({ page }, use) => use(new NavigationPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  flightSearch: async ({ page }, use) => use(new FlightSearchPage(page)),
  flightResults: async ({ page }, use) => use(new FlightResultsPage(page)),
  flightDetails: async ({ page }, use) => use(new FlightDetailsPage(page)),
  flightBooking: async ({ page }, use) => use(new FlightBookingPage(page)),
  hotelSearch: async ({ page }, use) => use(new HotelSearchPage(page)),
  hotelResults: async ({ page }, use) => use(new HotelResultsPage(page)),
  tourSearch: async ({ page }, use) => use(new TourSearchPage(page)),
  tourResults: async ({ page }, use) => use(new TourResultsPage(page)),
  tourDetails: async ({ page }, use) => use(new TourDetailsPage(page)),
  visaHome: async ({ page }, use) => use(new VisaHomePage(page)),
  visaPackage: async ({ page }, use) => use(new VisaPackagePage(page)),
  visaApplication: async ({ page }, use) => use(new VisaApplicationPage(page)),
  primeHome: async ({ page }, use) => use(new PrimeHomePage(page)),
  primeMembership: async ({ page }, use) => use(new PrimeMembershipPage(page)),
  travelAddons: async ({ page }, use) => use(new TravelAddonsPage(page)),
  addonSelection: async ({ page }, use) => use(new AddonSelectionPage(page)),
  confirmationPage: async ({ page }, use) => use(new ConfirmationPage(page)),
  packageSearch: async ({ page }, use) => use(new PackageSearchPage(page)),
  packageBuilder: async ({ page }, use) => use(new PackageBuilderPage(page)),
  primeBooking: async ({ page }, use) => use(new PrimeBookingPage(page)),
  primeAccountPage: async ({ page }, use) => use(new PrimeAccountPage(page)),
  affiliateSession: async ({ page }, use) => use(new AffiliateSessionPage(page)),
});
