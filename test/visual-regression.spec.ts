// test/visual-regression.spec.ts
import { test } from '@playwright/test';

test.use({ storageState: 'storageState.json' });

test.describe('Visual Testing - Documentación y Análisis', () => {
  
  test('captura sistemática para análisis comparativo vs Figma', async ({ page }) => {
    console.log('Generando capturas para comparación manual con diseños de Figma');
    
    // Homepage state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    await page.screenshot({
      path: 'test-results/homepage-for-figma-comparison.png',
      fullPage: true
    });
    
    // C.A.R.L. interface
    await page.goto('/carl');
    await page.waitForSelector('textarea');
    await page.waitForTimeout(2000);
    
    await page.screenshot({
      path: 'test-results/carl-interface-for-figma-comparison.png',
      fullPage: true
    });
    
    // Component isolation - textarea
    const textarea = page.locator('textarea').first();
    await textarea.screenshot({
      path: 'test-results/carl-textarea-component.png'
    });
    
    console.log('Capturas completadas para análisis manual vs Figma');
    console.log('Archivos generados en test-results/ para comparación');
  });

  test('responsive design documentation', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      await page.screenshot({
        path: `test-results/responsive-${viewport.name}-for-analysis.png`,
        fullPage: true
      });
    }
    
    console.log('Documentación responsive completada');
  });
});