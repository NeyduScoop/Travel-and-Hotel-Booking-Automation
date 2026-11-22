import type { Locator } from '@playwright/test';
import type { ContactDetails } from '../../types/common.types';

/**
 * "Contact Information" block of the shared checkout form.
 * Scoped by `data-error-key="contact.email|contact.phone"` because signed-in carts render a second
 * "Email Address" field per additional traveller (placeholder "traveller@example.com").
 */
export class ContactForm {
  readonly email: Locator;
  readonly phone: Locator;
  readonly callingCode: Locator;

  constructor(scope: Locator) {
    this.email = scope.locator('[data-error-key="contact.email"]').getByRole('textbox', { name: 'Email Address', exact: true });
    this.phone = scope.locator('[data-error-key="contact.phone"]').getByRole('textbox', { name: 'Phone Number', exact: true });
    this.callingCode = scope.locator('[data-error-key="contact.phone"]').getByRole('button', { name: 'Country calling code' });
  }

  async fill(contact: ContactDetails): Promise<void> {
    await this.email.fill(contact.email);
    await this.phone.fill(contact.phone);
    await this.phone.blur();
  }

  async values(): Promise<ContactDetails> {
    return { email: await this.email.inputValue(), phone: await this.phone.inputValue() };
  }

  /** The role="alert" message wired to a field via aria-describedby, or null when the field is valid. */
  static async errorFor(field: Locator): Promise<string | null> {
    const describedBy = await field.getAttribute('aria-describedby');
    if (!describedBy) return null;
    const alert = field.page().locator(`[id="${describedBy}"]`);
    return (await alert.count()) ? (await alert.innerText()).trim() : null;
  }
}
