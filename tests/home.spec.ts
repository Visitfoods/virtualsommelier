import { test, expect } from '@playwright/test';

test.describe('Página Inicial', () => {
  test('deve carregar corretamente', async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:3000');
    
    // Verificar se o título da página está correto
    await expect(page).toHaveTitle(/Portugal dos Pequenitos - VirtualGuide/);
    
    // Verificar se o botão "FALA COMIGO" está visível
    const talkButton = page.locator('text=FALA COMIGO');
    await expect(talkButton).toBeVisible();
  });

  test('deve abrir o chatbot ao clicar no botão', async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:3000');
    
    // Clicar no botão "FALA COMIGO"
    await page.click('text=FALA COMIGO');
    
    // Verificar se o popup do chatbot está visível
    const chatbotPopup = page.locator('.chatbotPopup');
    await expect(chatbotPopup).toBeVisible();
    
    // Verificar se o campo de input do chatbot está visível
    const chatInput = page.locator('.chatbotInput');
    await expect(chatInput).toBeVisible();
  });

  test('deve mostrar as seções FAQ e Contato', async ({ page }) => {
    // Navegar para a página inicial
    await page.goto('http://localhost:3000');
    
    // Verificar se a seção FAQ está visível
    const faqSection = page.locator('.faqSection');
    await expect(faqSection).toBeVisible();
    
    // Verificar se a seção de Contato está visível
    const contactSection = page.locator('.contactSection');
    await expect(contactSection).toBeVisible();
  });
}); 