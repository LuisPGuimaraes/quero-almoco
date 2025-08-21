const { chromium } = require('playwright');
require('dotenv').config();

// Função principal primeiro
async function submitForm(data) {
  const browser = await chromium.launch({ headless: true, slowMo: 200 });
  const storageState = process.env.STORAGE_STATE
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  const automator = new GoogleFormAutomator(page);

  async function isGFormCheckboxChecked(selector = 'div[role="checkbox"]') {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) return false;

    const aria = await el.getAttribute('aria-checked').catch(() => null);
    if (aria === 'true') return true;

    const cls = (await el.getAttribute('class').catch(() => '')) || '';
    if (/(Y6Myld|uHMk6b|MocG8c|isChecked)/.test(cls)) return true;

    const parent = el.locator('..');
    const pcls = (await parent.getAttribute('class').catch(() => '')) || '';
    return /(Y6Myld|uHMk6b|MocG8c|isChecked)/.test(pcls);
  }

  try {
    await page.goto(process.env.URL_TESTE, { waitUntil: 'networkidle' });

    console.log('[INFO] Preenchendo checkbox principal...');
    await page.locator('div[role="checkbox"]').first().click();
    await page.waitForTimeout(100);

    // Se não marcou, tenta novamente uma vez
    let checkbox = await isGFormCheckboxChecked();
    if (!checkbox) {
      await page.locator('div[role="checkbox"]').first().click();
      await page.waitForTimeout(100);
      checkbox = await isGFormCheckboxChecked();
    }

    console.log('[INFO] Selecionando opções...');
    await automator.clickElement('1 pessoa');
    await automator.clickElement('Familiar (filho, cônjuge...)');

    console.log('[INFO] Preenchendo campo de texto...');
    await page.locator('input[jsname="YPqjbf"]').fill(data);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);

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
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fileName = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}.png`;
      const screenshotPath = `/home/luis/quero-almoco/screenshots/${fileName}`;
      
      await page.screenshot({ path: screenshotPath, fullPage: true, type: 'png' });
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
    const candidates = [
      this.page.getByRole('button', { name: /enviar/i }),
      this.page.locator('[role="button"]:has-text("Enviar")'),
      this.page.locator('.uArJ5e.UQuaGc.Y5sE8d.VkkpIf.NqnGTe'),
      this.page.locator('button:has-text("Enviar")'),
      this.page.locator('div[role="button"][aria-label="Enviar"]'),
      this.page.locator('span:has-text("Enviar")').locator('xpath=ancestor-or-self::div[@role="button"]')
    ];

    for (let i = 0; i < candidates.length; i++) {
      const loc = candidates[i].first();
      const count = await loc.count();
      if (count === 0) continue;
      try { await loc.scrollIntoViewIfNeeded(); } catch {}
      try { await loc.waitFor({ state: 'visible', timeout: 2000 }); } catch {}

      const ariaDisabled = await loc.getAttribute('aria-disabled').catch(() => null);
      if (ariaDisabled === 'true') {
        continue;
      }

      if (await this.tryAction(() => loc.click({ trial: true }), `Teste de clique (estratégia ${i + 1})`)) {
        if (await this.tryAction(() => loc.click(), `Clicar enviar (estratégia ${i + 1})`)) {
          return true;
        }
      }

      if (await this.tryAction(() => loc.click({ force: true }), `Clicar enviar com force (estratégia ${i + 1})`)) {
        return true;
      }
    }

    await this.page.keyboard.press('Enter').catch(() => {});
    try {
      await this.page.waitForSelector('text=Sua resposta foi registrada.', { timeout: 2000 });
      return true;
    } catch {}

    return false;
  }
}

module.exports = submitForm;