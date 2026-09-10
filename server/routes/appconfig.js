const express = require('express');
const config = require('../../config');

const router = express.Router();

// devolve só o que o frontend precisa (nunca a chave da API do YouTube)
router.get('/app-config', (req, res) => {
  res.json({
    appName: config.appName || 'NightWave',
    tagline: config.tagline || '',
    logo: config.logo || '',
    cores: config.cores || {}
  });
});

module.exports = router;
