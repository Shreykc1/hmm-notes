import { test, expect } from '@playwright/test';

test.describe('Setup Flow', () => {
    test('should complete initial setup', async ({ page }) => {
        await page.goto('/');

        // Should redirect to setup if not configured
        await expect(page).toHaveURL(/\/setup/);

        // Fill in passphrase
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.fill('#confirmPassphrase', 'TestPassphrase123!@#');

        // Submit setup
        await page.click('button[type="submit"]');

        // Should redirect to main page
        await expect(page).toHaveURL('/');
    });

    test('should show passphrase strength indicator', async ({ page }) => {
        await page.goto('/setup');

        await page.fill('#passphrase', 'weak');

        // Should show strength indicator
        const strength = page.locator('text=Strength:');
        await expect(strength).toBeVisible();
    });

    test('should validate passphrase match', async ({ page }) => {
        await page.goto('/setup');

        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.fill('#confirmPassphrase', 'DifferentPassphrase');

        await page.click('button[type="submit"]');

        // Should show error
        await expect(page.locator('text=do not match')).toBeVisible();
    });
});

test.describe('Note Management', () => {
    test.beforeEach(async ({ page }) => {
        // Set up app first
        await page.goto('/setup');
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.fill('#confirmPassphrase', 'TestPassphrase123!@#');
        await page.click('button[type="submit"]');

        // Unlock
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.click('button[type="submit"]');
    });

    test('should create a new note', async ({ page }) => {
        // Click new note button
        await page.click('text=New Note');

        // Should show editor
        await expect(page.locator('text=New Note').first()).toBeVisible();

        // Type content
        await page.fill('textarea', 'This is my test note');

        // Save
        await page.click('button:has-text("Save")');

        // Should show in list
        await expect(page.locator('text=This is my test note')).toBeVisible();
    });

    test('should edit existing note', async ({ page }) => {
        // Create note first
        await page.click('text=New Note');
        await page.fill('textarea', 'Original content');
        await page.click('button:has-text("Save")');

        // Click to edit
        await page.click('text=Original content');

        // Update content
        await page.fill('textarea', 'Updated content');
        await page.click('button:has-text("Save")');

        // Should show updated content
        await expect(page.locator('text=Updated content')).toBeVisible();
    });

    test('should delete note', async ({ page }) => {
        // Create note
        await page.click('text=New Note');
        await page.fill('textarea', 'To be deleted');
        await page.click('button:has-text("Save")');

        // Hover to show delete button
        const noteCard = page.locator('text=To be deleted').locator('..');
        await noteCard.hover();

        // Click delete
        page.on('dialog', dialog => dialog.accept());
        await noteCard.locator('button:has-text("Delete")').click();

        // Should be gone
        await expect(page.locator('text=To be deleted')).not.toBeVisible();
    });
});

test.describe('Lock and Unlock', () => {
    test('should lock and unlock with passphrase', async ({ page }) => {
        // Setup
        await page.goto('/setup');
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.fill('#confirmPassphrase', 'TestPassphrase123!@#');
        await page.click('button[type="submit"]');

        // Unlock
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.click('button[type="submit"]');

        // Lock
        await page.click('text=Lock');

        // Should show unlock modal
        await expect(page.locator('text=Unlock Secure Notes')).toBeVisible();

        // Unlock again
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.click('button:has-text("Unlock")');

        // Should be unlocked
        await expect(page.locator('text=New Note')).toBeVisible();
    });
});

test.describe('Export and Import', () => {
    test('should export backup', async ({ page }) => {
        // Setup and unlock
        await page.goto('/setup');
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.fill('#confirmPassphrase', 'TestPassphrase123!@#');
        await page.click('button[type="submit"]');
        await page.fill('#passphrase', 'TestPassphrase123!@#');
        await page.click('button[type="submit"]');

        // Create a note
        await page.click('text=New Note');
        await page.fill('textarea', 'Test note for export');
        await page.click('button:has-text("Save")');

        // Export - set up download handler
        const downloadPromise = page.waitForEvent('download');
        await page.click('text=Export');
        const download = await downloadPromise;

        // Verify download
        expect(download.suggestedFilename()).toMatch(/secure-notes-backup-.*\.json/);
    });
});
