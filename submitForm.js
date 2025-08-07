const { chromium } = require('playwright');
require('dotenv').config();

async function submitForm(data) {
  const browser = await chromium.launch({ headless: true, slowMo: 200 });

  const context = await browser.newContext({
    storageState: 'meu_login.json',
  });

  const page = await context.newPage();

  try {
    await page.goto(process.env.URL_TESTE, { waitUntil: 'networkidle' });

    async function isElementChecked(selector) {
      try {
        const element = page.locator(selector).first();
        const count = await element.count();
        if (count === 0) {
          console.log(`[WARNING] Elemento não encontrado: ${selector}`);
          return false;
        }
        return await element.isChecked();
      } catch (err) {
        console.log(`[WARNING] Erro ao verificar elemento: ${selector} - ${err.message}`);
        return false;
      }
    }

    async function inspectGoogleFormElement(labelText) {
      try {
        console.log(`[DEBUG] Inspecionando elemento do Google Forms: "${labelText}"`);
        
        const selectors = [
          `[data-value="${labelText}"]`,
          `[aria-label="${labelText}"]`,
          `span:has-text("${labelText}")`,
          `div[role="radio"]:has-text("${labelText}")`,
          `div[role="checkbox"]:has-text("${labelText}")`,
          `label:has-text("${labelText}")`,
          `div.AB7Lab:has-text("${labelText}")`, 
          `div.Od2TWd:has-text("${labelText}")`, 
        ];
        
        for (const selector of selectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            console.log(`[DEBUG] Encontrado "${labelText}" com seletor: ${selector} (${count} elementos)`);
            
            const element = page.locator(selector).first();
            const ariaChecked = await element.getAttribute('aria-checked').catch(() => null);
            const className = await element.getAttribute('class').catch(() => '');
            
            console.log(`[DEBUG] aria-checked: ${ariaChecked}, classes: ${className}`);
            return { selector, element };
          }
        }
        
        return null;
      } catch (err) {
        return null;
      }
    }

    async function isGoogleFormElementSelected(elementInfo) {
      if (!elementInfo) return false;
      
      try {
        const { element } = elementInfo;
        
        const ariaChecked = await element.getAttribute('aria-checked');
        if (ariaChecked === 'true') return true;
        
        const className = await element.getAttribute('class') || '';
        const isSelected = className.includes('Y6Myld') || className.includes('uHMk6b') || className.includes('MocG8c');
        
        if (!isSelected) {
          const parent = element.locator('..');
          const parentClass = await parent.getAttribute('class').catch(() => '');
          return parentClass.includes('Y6Myld') || parentClass.includes('uHMk6b');
        }
        
        return isSelected;
      } catch (err) {
        console.log(`[WARNING] Erro ao verificar seleção: ${err.message}`);
        return false;
      }
    }

    async function getInputValue(selector) {
      try {
        return await page.locator(selector).inputValue();
      } catch (err) {
        console.log(`[WARNING] Não foi possível obter valor do input: ${selector}`);
        return '';
      }
    }

    async function fillWithRetry(action, verifyFn, description, maxRetries = 3) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[INFO] ${description} - Tentativa ${attempt}/${maxRetries}`);
          await action();
          await page.waitForTimeout(100);
          
          const isValid = await verifyFn();
          if (isValid) {
            console.log(`[✅] ${description} - Sucesso!`);
            return true;
          } else {
            console.log(`[⚠️] ${description} - Falhou na verificação, tentando novamente...`);
          }
        } catch (err) {
          console.log(`[❌] ${description} - Erro na tentativa ${attempt}: ${err.message}`);
        }
        
        if (attempt < maxRetries) {
          await page.waitForTimeout(1000); 
        }
      }
      
      console.log(`[❌] ${description} - Falhou após ${maxRetries} tentativas`);
      return false;
    }

    const checkboxSuccess = await fillWithRetry(
      () => page.locator('div[role="checkbox"]').click(),
      () => isElementChecked('div[role="checkbox"]'),
      'Clicando no checkbox principal'
    );
    if (!checkboxSuccess) {
      throw new Error('Falha ao marcar o checkbox principal');
    }

    console.log('[INFO] Analisando elemento "1 pessoa"...');
    const pessoa1Info = await inspectGoogleFormElement('1 pessoa');
    
    const pessoa1Success = await fillWithRetry(
      async () => {
        try {
          await page.getByText('1 pessoa').click();
        } catch {
          await page.locator('span:has-text("1 pessoa")').first().click();
        }
      },
      () => isGoogleFormElementSelected(pessoa1Info),
      'Selecionando "1 pessoa"'
    );
    if (!pessoa1Success) {
      console.log('[WARNING] Continuando mesmo sem confirmar seleção de "1 pessoa" (pode já estar selecionado)');
    }

    console.log('[INFO] Analisando elemento "Familiar"...');
    const familiarInfo = await inspectGoogleFormElement('Familiar (filho, cônjuge...)');
    
    const familiarSuccess = await fillWithRetry(
      async () => {
        try {
          await page.getByText('Familiar (filho, cônjuge...)').click();
        } catch {
          await page.locator('span:has-text("Familiar")').first().click();
        }
      },
      () => isGoogleFormElementSelected(familiarInfo),
      'Selecionando "Familiar"'
    );
    if (!familiarSuccess) {
      console.log('[WARNING] Continuando mesmo sem confirmar seleção de "Familiar" (pode já estar selecionado)');
    }

    const textInputSuccess = await fillWithRetry(
      () => page.locator('input[jsname="YPqjbf"]').fill(data),
      async () => {
        const value = await getInputValue('input[jsname="YPqjbf"]');
        return value === data;
      },
      `Preenchendo campo de texto com: "${data}"`
    );
    if (!textInputSuccess) {
      throw new Error('Falha ao preencher o campo de texto');
    }

    console.log('[INFO] Realizando verificação final...');
    
    const finalCheck = {
      checkbox: await isElementChecked('div[role="checkbox"]'),
      pessoa1: await isGoogleFormElementSelected(pessoa1Info),
      familiar: await isGoogleFormElementSelected(familiarInfo),
      textInput: await getInputValue('input[jsname="YPqjbf"]') === data
    };

    console.log('[INFO] Status final dos campos:');
    console.log(`  - Checkbox principal: ${finalCheck.checkbox ? '✅' : '❌'}`);
    console.log(`  - 1 pessoa: ${finalCheck.pessoa1 ? '✅' : '⚠️ (não confirmado)'}`);
    console.log(`  - Familiar: ${finalCheck.familiar ? '✅' : '⚠️ (não confirmado)'}`);
    console.log(`  - Campo de texto: ${finalCheck.textInput ? '✅' : '❌'}`);

    const criticalFieldsValid = finalCheck.checkbox && finalCheck.textInput;
    if (!criticalFieldsValid) {
      throw new Error('Campos críticos (checkbox e texto) não foram preenchidos corretamente');
    }

    console.log('[✅] Campos críticos verificados! Enviando formulário...');
    if (!finalCheck.pessoa1 || !finalCheck.familiar) {
      console.log('[INFO] Alguns campos de seleção não foram confirmados, mas prosseguindo (Google Forms pode ter comportamento diferente)');
    }

    async function clickSubmitButton() {
      const submitStrategies = [
        () => page.getByRole('button', { name: 'Enviar' }).click(),
        
        () => page.locator('span:has-text("Enviar")').click(),
        
        () => page.locator('button:has-text("Enviar")').click(),
        
        () => page.locator('div[role="button"]:has-text("Enviar")').click(),
        
        () => page.locator('.uArJ5e.UQuaGc.Y5sE8d.VkkpIf.NqnGTe').click(), // Botão primário Google Forms
        
        () => page.locator('[role="button"]:has-text("Enviar")').click(),
        
        () => page.locator('input[type="submit"]').click(),
        
        () => page.locator('[data-value="Enviar"]').click(),
        
        () => page.getByRole('button', { name: /enviar/i }).click(),
        
        () => page.locator('button').last().click()
      ];

      for (let i = 0; i < submitStrategies.length; i++) {
        try {
          console.log(`[INFO] Tentativa ${i + 1}/10 - Estratégia de clique no botão...`);
          
          let elementExists = false;
          switch (i) {
            case 0:
              elementExists = await page.getByRole('button', { name: 'Enviar' }).count() > 0;
              break;
            case 1:
              elementExists = await page.locator('span:has-text("Enviar")').count() > 0;
              break;
            case 2:
              elementExists = await page.locator('button:has-text("Enviar")').count() > 0;
              break;
            default:
              elementExists = true; // Para as outras estratégias, tenta diretamente
          }
          
          if (elementExists || i >= 3) {
            await submitStrategies[i]();
            console.log(`[✅] Botão encontrado e clicado com estratégia ${i + 1}!`);
            return true;
          } else {
            console.log(`[INFO] Elemento não encontrado na estratégia ${i + 1}, tentando próxima...`);
          }
        } catch (err) {
          console.log(`[WARNING] Estratégia ${i + 1} falhou: ${err.message}`);
        }
        
        await page.waitForTimeout(100);
      }
      
      return false;
    }

    console.log('[INFO] Procurando botão de enviar...');
    const submitClicked = await clickSubmitButton();
    
    if (!submitClicked) {
      console.log('[INFO] Não foi possível clicar no botão. Listando todos os botões encontrados:');
      const buttons = await page.locator('button, [role="button"], input[type="submit"]').all();
      
      for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent().catch(() => '');
        const role = await buttons[i].getAttribute('role').catch(() => '');
        const type = await buttons[i].getAttribute('type').catch(() => '');
        const classes = await buttons[i].getAttribute('class').catch(() => '');
        console.log(`[DEBUG] Botão ${i + 1}: texto="${text}", role="${role}", type="${type}", classes="${classes}"`);
      }
      
      throw new Error('Não foi possível encontrar o botão de enviar após todas as tentativas');
    }

    console.log('[INFO] Botão enviar clicado, aguardando confirmação...');

    await page.waitForSelector('text=Sua resposta foi registrada.', { timeout: 20000 });
    console.log('[✅ SUCESSO] Pedido enviado com sucesso!');

  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.log('[❌ ERRO] Tempo esgotado: não apareceu confirmação de envio.');
      throw new Error('TimeoutError: não apareceu confirmação de envio.');
    } else {
      console.log('[❌ ERRO] Falha ao enviar:', err.message);
      throw err;
    }
  } finally {
    await browser.close();
  }
}

module.exports = submitForm;