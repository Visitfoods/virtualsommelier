import { test, expect } from '@playwright/test';

test.describe('Configuração do Firebase - contactoschatreal', () => {
  test('deve conseguir enviar dados para o Firebase', async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:3000');
    
    // Clicar no botão "FALAR COM O CHAT REAL" para abrir o popup
await page.click('text=FALAR COM O CHAT REAL');
    
    // Aguardar o popup aparecer
    await page.waitForSelector('.guidePopup', { timeout: 5000 });
    
    // Preencher o formulário
    await page.fill('input[placeholder="O seu nome"]', 'Teste Automático');
    await page.fill('input[placeholder="Email ou telefone"]', 'teste@exemplo.com');
    
    // Clicar no botão de envio
    await page.click('button:has-text("FALAR COM O CHAT REAL")');
    
    // Aguardar a mensagem de sucesso
    await page.waitForSelector('.formSuccess', { timeout: 10000 });
    
    // Verificar se a mensagem de sucesso aparece
    const successMessage = page.locator('.formSuccess');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('Obrigado! Recebemos o seu pedido de contacto.');
  });

  test('deve mostrar erro se os campos estiverem vazios', async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:3000');
    
    // Clicar no botão "FALAR COM O CHAT REAL"
    await page.click('text=FALAR COM O CHAT REAL');
    
    // Aguardar o popup aparecer
    await page.waitForSelector('.guidePopup', { timeout: 5000 });
    
    // Tentar enviar sem preencher os campos
    await page.click('button:has-text("FALAR COM O CHAT REAL")');
    
    // Verificar se aparece mensagem de erro
    const errorMessage = page.locator('.formError');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Por favor, preencha todos os campos.');
  });

  test('deve fechar o popup após envio bem-sucedido', async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:3000');
    
    // Clicar no botão "FALAR COM O CHAT REAL"
    await page.click('text=FALAR COM O CHAT REAL');
    
    // Aguardar o popup aparecer
    await page.waitForSelector('.guidePopup', { timeout: 5000 });
    
    // Preencher e enviar o formulário
    await page.fill('input[placeholder="O seu nome"]', 'Teste Fechamento');
    await page.fill('input[placeholder="Email ou telefone"]', 'fechamento@exemplo.com');
    await page.click('button:has-text("FALAR COM O CHAT REAL")');
    
    // Aguardar a mensagem de sucesso
    await page.waitForSelector('.formSuccess', { timeout: 10000 });
    
    // Aguardar 3 segundos para o popup fechar automaticamente
    await page.waitForTimeout(3500);
    
    // Verificar se o popup fechou
    const popup = page.locator('.guidePopup');
    await expect(popup).not.toBeVisible();
  });
}); 