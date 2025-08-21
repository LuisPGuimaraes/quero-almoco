const express = require('express');
const path = require('path');
const fs = require('fs');
const submitForm = require('./submitForm');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
if (fs.existsSync(faviconPath)) {
  app.get('/favicon.ico', (req, res) => res.sendFile(faviconPath));
}

app.get('/', (req, res) => {
  console.log('[INFO] Rota / acessada');

  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const jsonPath = path.join(__dirname, 'dates.json');

  let html = fs.readFileSync(htmlPath, 'utf-8');
  let dates = [];

  if (fs.existsSync(jsonPath)) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      dates = content ? JSON.parse(content) : [];
    } catch (err) {
      console.warn('[WARN] Erro ao ler dates.json:', err.message);
    }
  }

  html = html.replace('{{REGISTERED_DATES_JSON}}', JSON.stringify(dates));

  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/success.html'));
});

app.get('/error', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/error.html'));
});

app.post('/enviar', async (req, res) => {
  const data = req.body.data;
  console.log(`[REQUISIÇÃO] Pedido recebido para data: ${data}`);

  try {
    await submitForm(data);

    const jsonPath = path.join(__dirname, 'dates.json');
    let dates = [];

    if (fs.existsSync(jsonPath)) {
      try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        dates = content ? JSON.parse(content) : [];
      } catch (err) {
        console.warn('[WARN] Não foi possível ler dates.json');
      }
    }

    dates.push(data);
    fs.writeFileSync(jsonPath, JSON.stringify(dates, null, 2));

    res.sendFile(path.join(__dirname, 'public/success.html'));
  } catch (err) {
    console.error('[ERRO] Falha ao enviar:', err.message);
    res.sendFile(path.join(__dirname, 'public/error.html'));
  }
});

app.get('/enviar', (req, res) => res.redirect('/'));

app.use((req, res, next) => {
  if (req.method === 'GET') return res.redirect('/');
  next();
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT} (http://localhost:${PORT})`);
});
