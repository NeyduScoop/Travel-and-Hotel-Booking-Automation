import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { HEADER_ROUTES, type HeaderLink } from '../../../pages/common/NavigationPage';

test.describe('Header navigation and homepage', { tag: [Tag.smoke] }, () => {
  test('homepage loads with header navigation and product tabs', { tag: [Tag.critical, Tag.positive] }, async ({ navigation }) => {
    await navigation.openHome();
    await expect(navigation.page).toHaveTitle(/Wakanow/);
    await expect(navigation.logo).toBeVisible();
    await expect(navigation.loginButton).toBeVisible();
    await expect(navigation.cartLink).toBeVisible();
    for (const tab of ['Flights', 'Hotels', 'Packages', 'Tours', 'Visa', 'Travel Add-ons'] as const) {
      await expect(navigation.productTab(tab)).toBeVisible();
    }
  });

  for (const link of ['Flights', 'Hotels', 'Tours', 'Visa', 'Prime'] as HeaderLink[]) {
    test(`header link "${link}" routes to ${HEADER_ROUTES[link]}`, { tag: [Tag.positive] }, async ({ navigation }) => {
      await navigation.openHome();
      await navigation.navigateTo(link);
      await expect(navigation.main.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('REG-022: PRIME landing modal does not block homepage search', { tag: [Tag.critical] }, async ({ navigation, observe }) => {
    await navigation.goto('/');
    const modal = await navigation.dismissPrimeModal();
    observe(`PRIME modal appeared=${modal.appeared}, dismissed=${modal.dismissed}`);
    if (modal.appeared) expect(modal.dismissed, 'PRIME modal must be dismissible').toBe(true);
    const from = navigation.main.getByRole('combobox', { name: 'From', exact: true });
    await expect(from).toBeEditable();
    await from.click();
    await from.pressSequentially('Lag', { delay: 50 });
    await expect(from).toHaveValue(/Lag/);
  });
});
