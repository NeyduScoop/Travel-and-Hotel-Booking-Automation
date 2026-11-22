import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export type HeaderLink = 'Flights' | 'Hotels' | 'Packages' | 'Tours' | 'Visa' | 'Prime' | 'Manage Booking';

export const HEADER_ROUTES: Record<HeaderLink, string> = {
  Flights: '/flights',
  Hotels: '/hotels',
  Packages: '/packages',
  Tours: '/tours',
  Visa: '/visa',
  Prime: '/wakanow-prime',
  'Manage Booking': '/manage-booking',
};

/** Home-page product tabs, including Travel Add-ons which is only reachable from the sub-header tabs. */
export type ProductTab = 'Flights' | 'Hotels' | 'Packages' | 'Tours' | 'Visa' | 'Travel Add-ons';

/** Global header navigation and the home-page product tab strip. */
export class NavigationPage extends BasePage {
  get mainNav(): Locator {
    return this.page.getByRole('navigation', { name: 'Main navigation' });
  }

  link(name: HeaderLink): Locator {
    return this.mainNav.getByRole('link', { name, exact: true });
  }

  get logo(): Locator {
    return this.header.getByRole('link', { name: 'Wakanow home' });
  }

  get loginButton(): Locator {
    return this.header.getByRole('button', { name: 'Log in/Sign up' });
  }

  get cartLink(): Locator {
    return this.header.getByRole('link', { name: 'View cart' });
  }

  get currencySwitcher(): Locator {
    return this.header.getByRole('button', { name: /Change currency/ });
  }

  productTab(name: ProductTab): Locator {
    return this.main.getByRole('tab', { name, exact: true });
  }

  async openHome(): Promise<void> {
    await this.open('/');
  }

  async navigateTo(name: HeaderLink): Promise<void> {
    await this.link(name).click();
    await expect(this.page).toHaveURL(new RegExp(`${HEADER_ROUTES[name]}/?(\\?|$)`));
    await this.settle();
  }
}
