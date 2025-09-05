import { test, expect } from '@playwright/test';
import { PostingLimitsHelper } from '../helpers/PostingLimitsHelper.js';

test.use({ 
  storageState: 'storageState.json' 
});

test.describe('Posting Limits - Estado Final', () => {
  test('validar detección de estado de límites', async ({ page }) => {
    test.setTimeout(120_000);
    
    const helper = new PostingLimitsHelper(page);
    const { result } = await helper.testBasicFlow();
    
    console.log('Estado final detectado:', result);
    
    // Para este usuario, esperamos que esté en estado de límites
    expect(['upgrade_required', 'payment_required', 'limit_reached'].includes(result.type)).toBeTruthy();
    
    if (result.type === 'upgrade_required') {
      console.log('✅ Sistema requiere upgrade - implementación de límites funcional');
    } else if (result.type === 'payment_required') {
      console.log('✅ Sistema requiere pago - implementación de límites funcional');
    }
    
    // El punto importante es que NO esté en estado 'free'
    expect(result.type).not.toBe('free');
    
    console.log('🎯 Validación de límites completada exitosamente');
  });
});