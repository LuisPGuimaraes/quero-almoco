const express = require('express');
const submitForm = require('./submitForm');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = 8080;

app.use(bodyParser.urlencoded({ extended: false }));

// Rota principal - serve HTML com datas injetadas
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

  // Injeta as datas como JSON para o script do calendário
  html = html.replace('{{REGISTERED_DATES_JSON}}', JSON.stringify(dates));

  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

// Agora serve arquivos estáticos (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ... restante das rotas (success, error, enviar)

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

    // Adiciona a data mesmo que já exista
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
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
