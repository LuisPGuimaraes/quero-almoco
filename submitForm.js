const { chromium } = require('playwright');

async function submitForm(data) {
  const browser = await chromium.launch({ headless: false, slowMo: 1500 });

  const context = await browser.newContext({
    storageState: 'meu_login.json',
  });

  const page = await context.newPage();

  try {
    // await page.goto(process.env.URL_FORM_QUERO, { waitUntil: 'networkidle' });
    await page.goto(process.env.URL_TESTE, { waitUntil: 'networkidle' });
    console.log('[INFO] Página carregada.');

    // Preenche campos
    await page.getByLabel('1 pessoa').check();
    await page.getByLabel('Familiar (filho, cônjuge...)').check();
    await page.locator('input[jsname="YPqjbf"]').fill(data);
    await page.locator('div[role="checkbox"]').click();

    // Clica no botão Enviar (tente algo mais específico)
    await page.getByRole('button', { name: 'Enviar' }).click();
    console.log('[INFO] Botão enviar clicado, aguardando confirmação...');

    // Espera confirmação
    await page.waitForSelector('text=Sua resposta foi registrada.', { timeout: 30000 });
    console.log('[✅ SUCESSO] Pedido enviado com sucesso!');

  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.log('[❌ ERRO] Tempo esgotado: não apareceu confirmação de envio.');
    } else {
      console.log('[❌ ERRO] Falha ao enviar:', err.message);
    }
  } finally {
    // await browser.close();
  }
}

module.exports = submitForm;
