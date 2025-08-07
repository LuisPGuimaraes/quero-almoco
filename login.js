const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://accounts.google.com');

  console.log("Faça o login com sua conta Google e pressione Enter para continuar...");
  process.stdin.once('data', async () => {
    await context.storageState({ path: 'meu_login.json' });
    console.log('Login salvo com sucesso!');
    await browser.close();
    process.exit();
  });
})();