import { test, expect } from '@playwright/test';
import { saveContactRequest } from '../src/firebase/services';

// Nota: Este teste é apenas um exemplo e não deve ser executado em ambiente de produção
// pois pode criar dados reais no Firebase
test.describe('Firebase Integration', () => {
  test.skip('deve enviar dados do formulário para o Firebase', async () => {
    // Este teste é pulado por padrão para evitar criar dados no Firebase
    // Para executar, remova o .skip
    const testData = {
      name: 'Utilizador Teste',
      contact: 'teste@exemplo.com'
    };
    
    const docId = await saveContactRequest(testData);
    expect(docId).toBeTruthy();
  });
}); 