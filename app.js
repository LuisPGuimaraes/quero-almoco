const express = require('express');
const submitForm = require('./submitForm');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/enviar', async (req, res) => {
  const data = req.body.data;

  console.log(`[REQUISIÇÃO] Pedido recebido para data: ${data}`);

  try {
    await submitForm(data);
    res.send('<h2>✅ Pedido enviado com sucesso!</h2><a href="/">Voltar</a>');
  } catch (err) {
    res.send(`<h2>❌ Erro ao enviar: ${err.message}</h2><a href="/">Voltar</a>`);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
