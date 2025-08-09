const { chromium } = require('playwright');
require('dotenv').config();

// Função principal primeiro
async function submitForm(data) {
  const browser = await chromium.launch({ headless: true, slowMo: 200 });
  const context = await browser.newContext({ storageState: 'meu_login.json' });
  const page = await context.newPage();
  const automator = new GoogleFormAutomator(page);

  try {
    await page.goto(process.env.URL_TESTE, { waitUntil: 'networkidle' });

    console.log('[INFO] Preenchendo checkbox principal...');
    await page.locator('div[role="checkbox"]').click();

    console.log('[INFO] Selecionando opções...');
    await automator.clickElement('1 pessoa');
    await automator.clickElement('Familiar (filho, cônjuge...)');

    console.log('[INFO] Preenchendo campo de texto...');
    await page.locator('input[jsname="YPqjbf"]').fill(data);

    const checkbox = await page.locator('div[role="checkbox"]').isChecked().catch(() => false);
    const textValue = await page.locator('input[jsname="YPqjbf"]').inputValue().catch(() => '');

    console.log(`[INFO] Verificação: Checkbox ${checkbox ? 'find' : 'not find'}, Texto ${textValue === data ? 'find' : 'not find'}`);

    if (!checkbox || textValue !== data) {
      throw new Error('Campos críticos não foram preenchidos corretamente');
    }

    console.log('[INFO] Enviando formulário...');
    const submitSuccess = await automator.clickSubmitButton();
    
    if (!submitSuccess) {
      throw new Error('Não foi possível clicar no botão de enviar');
    }

    await page.waitForSelector('text=Sua resposta foi registrada.', { timeout: 20000 });
    console.log('[SUCESSO] Pedido enviado com sucesso!');

  } catch (err) {
    console.log(`[ERRO] ${err.name === 'TimeoutError' ? 'Tempo esgotado' : 'Falha ao enviar'}: ${err.message}`);
    throw err;
  } finally {
    try {
      const fileName = `ultima_tela_${Date.now()}.png`;
      const screenshotPath = `/home/luis/quero-almoco/screenshots/${fileName}`;
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot salva em: ${screenshotPath}`);
    } catch (screenshotErr) {
      console.log(`Falha ao salvar screenshot: ${screenshotErr.message}`);
    }

    await browser.close();
  }
}

// Classe auxiliar embaixo
class GoogleFormAutomator {
  constructor(page) {
    this.page = page;
  }

  async tryAction(action, description) {
    try {
      await action();
      console.log(`${description} - Sucesso!`);
      return true;
    } catch (err) {
      console.log(`${description} - Erro: ${err.message}`);
      return false;
    }
  }

  async findElement(labelText) {
    const selectors = [
      `[data-value="${labelText}"]`,
      `span:has-text("${labelText}")`,
      `div[role="radio"]:has-text("${labelText}")`,
      `div[role="checkbox"]:has-text("${labelText}")`,
      `label:has-text("${labelText}")`
    ];
    
    for (const selector of selectors) {
      const count = await this.page.locator(selector).count();
      if (count > 0) {
        return this.page.locator(selector).first();
      }
    }
    return null;
  }

  async isElementSelected(element) {
    if (!element) return false;
    
    try {
      const ariaChecked = await element.getAttribute('aria-checked');
      if (ariaChecked === 'true') return true;
      
      const className = await element.getAttribute('class') || '';
      return className.includes('Y6Myld') || className.includes('uHMk6b') || className.includes('MocG8c');
    } catch {
      return false;
    }
  }

  async clickElement(labelText) {
    const actions = [
      () => this.page.getByText(labelText).click(),
      () => this.page.locator(`span:has-text("${labelText}")`).first().click()
    ];

    for (const action of actions) {
      if (await this.tryAction(action, `Clicando em "${labelText}"`)) {
        return true;
      }
    }
    return false;
  }

  async clickSubmitButton() {
    const strategies = [
      () => this.page.getByRole('button', { name: 'Enviar' }).click(),
      () => this.page.locator('span:has-text("Enviar")').click(),
      () => this.page.locator('button:has-text("Enviar")').click(),
      () => this.page.locator('div[role="button"]:has-text("Enviar")').click()
    ];

    for (let i = 0; i < strategies.length; i++) {
      if (await this.tryAction(strategies[i], `Tentativa ${i + 1} de clicar no botão enviar`)) {
        return true;
      }
      await this.page.waitForTimeout(200);
    }
    return false;
  }
}

module.exports = submitForm;