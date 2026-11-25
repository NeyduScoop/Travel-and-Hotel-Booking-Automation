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

  /**
   * Per leg (outbound/return/multi-city leg): each segment's flight time, each layover, and any technical
   * stop. Observed 2026-11-24 (Kenya Airways LOS-NBO-JFK): "Flight no KQ535 · 22:40 · Lagos (LOS) · 5h 20m ·
   * Non stop · …", then "Layover · in Jomo Kenyatta … · 17h 35m", then the connecting segment "… 15h · Non stop".
   * A technical stop's ground time is part of its segment's flight time and is never counted separately.
   */
  async legBreakdown(card: Locator): Promise<{ heading: string; segments: number[]; layovers: number[]; technicalStops: string[] }[]> {
    const texts = await this.legs(card).allInnerTexts();
    const minutes = (s: string) => {
      const h = /(\d+)h/.exec(s);
      const m = /(\d+)m/.exec(s);
      return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
    };
    return texts.map((t) => {
      const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
      const out = { heading: lines[0] ?? '', segments: [] as number[], layovers: [] as number[], technicalStops: [] as string[] };
      lines.forEach((line, i) => {
        if (/technical stop/i.test(line)) out.technicalStops.push(line);
        if (!/^(\d+h(?: \d+m)?|\d+m)$/.test(line)) return;
        const before = lines.slice(Math.max(0, i - 3), i);
        if (before.some((l) => /^Layover\b/i.test(l))) out.layovers.push(minutes(line));
        else if (before.some((l) => /technical stop/i.test(l)) && !/stop/i.test(lines[i + 1] ?? '')) return; // technical-stop ground time
        else out.segments.push(minutes(line));
      });
      return out;
    });
  }

  async legHeadings(card: Locator): Promise<string[]> {
    return this.legs(card).getByRole('heading', { level: 4 }).allInnerTexts();
  }
}
