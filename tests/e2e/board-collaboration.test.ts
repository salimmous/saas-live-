import { test, expect } from '@playwright/test';

test.describe('Tableau Blanc Collaboratif E2E', () => {
  test('Page d’accueil s’affiche avec le formulaire d’authentification en français', async ({ page }) => {
    await page.goto('/');

    // Vérifier les éléments de marque et d'accès
    await expect(page.locator('h1')).toContainText('Pensez, collaborez et concevez en temps réel');
    await expect(page.getByText('Accéder à votre espace')).toBeVisible();

    // Vérifier la présence des fonctionnalités présentées
    await expect(page.getByText('Collaboration instantanée')).toBeVisible();
    await expect(page.getByText('Connecteurs intelligents')).toBeVisible();
  });

  test('Page de connexion invité par lien avec demande de pseudonyme', async ({ page }) => {
    // Tester la page invité avec un token quelconque
    await page.goto('/join/test-token-123');

    await expect(page.getByText('Rejoindre le Tableau')).toBeVisible();
    await expect(page.getByPlaceholder('Ex: Camille (Design)')).toBeVisible();
  });
});
