import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';

/**
 * Expanded flight details inside a result card ("View Flight Details" toggles to "Hide Details").
 * Contains tabs "Flight Details" / "Fare Rules" and one article per leg with flight number,
 * times, airports, baggage and "Airline - FLIGHTNO - Cabin - Class X".
 */
export class FlightDetailsPage extends BasePage {
  viewButton(card: Locator): Locator {
    return card.getByRole('button', { name: 'View Flight Details' });
  }
  hideButton(card: Locator): Locator {
    return card.getByRole('button', { name: 'Hide Details' });
  }
  tabs(card: Locator): Locator {
    return card.getByRole('tablist', { name: 'Expanded flight details' });
  }
  legs(card: Locator): Locator {
    return card.getByRole('article');
  }

  async expand(card: Locator): Promise<void> {
    await this.viewButton(card).click();
    await expect(this.hideButton(card)).toHaveAttribute('aria-expanded', 'true');
    await expect(this.legs(card).first()).toBeVisible();
  }

  async collapse(card: Locator): Promise<void> {
    await this.hideButton(card).click();
    await expect(this.viewButton(card)).toBeVisible();
  }

  async openTab(card: Locator, name: 'Flight Details' | 'Fare Rules'): Promise<void> {
    await this.tabs(card).getByRole('button', { name }).click();
  }

  async flightNumbers(card: Locator): Promise<string[]> {
    const text = await this.legs(card).allInnerTexts();
    return text.flatMap((t) => [...t.matchAll(/Flight no\s+([A-Z0-9]{2}\d{1,4})/g)].map((m) => m[1]));
  }

  async legBaggage(card: Locator): Promise<string[]> {
    const text = await this.legs(card).allInnerTexts();
    return text.flatMap((t) => [...t.matchAll(/Baggage\s+(\d+\s*×\s*\d+\s*kg)/gi)].map((m) => m[1].replace(/\s+/g, ' ')));
  }

  async legHeadings(card: Locator): Promise<string[]> {
    return this.legs(card).getByRole('heading', { level: 4 }).allInnerTexts();
  }
}
