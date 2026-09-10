const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const store = require('./../db');
const { scanFolders } = require('./../scan');

const router = express.Router();

router.get('/config', (req, res) => {
  res.json(store.db.config);
});

router.post('/config/folders', (req, res) => {
  const { folder } = req.body;
  if (!folder) return res.status(400).json({ error: 'Informe um caminho de pasta' });
  if (!fs.existsSync(folder)) return res.status(400).json({ error: 'Pasta não encontrada no servidor' });
  if (!store.db.config.musicFolders.includes(folder)) {
    store.db.config.musicFolders.push(folder);
    store.save();
  }
  res.json(store.db.config);
});

router.delete('/config/folders', (req, res) => {
  const { folder } = req.body;
  store.db.config.musicFolders = store.db.config.musicFolders.filter(f => f !== folder);
  store.save();
  res.json(store.db.config);
});

let scanInProgress = false;

router.post('/scan', async (req, res) => {
  if (scanInProgress) return res.status(409).json({ error: 'Já existe um escaneamento em andamento' });
  const io = req.app.get('io');
  scanInProgress = true;
  try {
    const result = await scanFolders(store.db.config.musicFolders, (progress) => {
      if (io) io.emit('scan:progress', progress);
    });
    if (io) io.emit('scan:done', result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    scanInProgress = false;
  }
});

// upload de arquivos (arrastar e soltar) para a primeira pasta configurada
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = store.db.config.musicFolders[0];
      if (!folder) return cb(new Error('Nenhuma pasta de música configurada'));
      cb(null, folder);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
  })
});

router.post('/upload', upload.array('files'), async (req, res) => {
  const io = req.app.get('io');
  const result = await scanFolders(store.db.config.musicFolders, (progress) => {
    if (io) io.emit('scan:progress', progress);
  });
  if (io) io.emit('scan:done', result);
  res.json({ uploaded: (req.files || []).length, ...result });
});

// renomear / mover / excluir arquivos de faixas
router.put('/tracks/:id/rename', (req, res) => {
  const { db } = store;
  const track = db.tracks[req.params.id];
  if (!track) return res.status(404).json({ error: 'Faixa não encontrada' });
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'Informe o novo nome' });
  const dir = path.dirname(track.path);
  const ext = path.extname(track.path);
  const newPath = path.join(dir, newName.endsWith(ext) ? newName : newName + ext);
  try {
    fs.renameSync(track.path, newPath);
    track.path = newPath;
    track.title = path.basename(newPath, ext);
    store.save();
    res.json(track);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tracks/:id', (req, res) => {
  const { db } = store;
  const track = db.tracks[req.params.id];
  if (!track) return res.status(404).json({ error: 'Faixa não encontrada' });
  try {
    if (fs.existsSync(track.path)) fs.unlinkSync(track.path);
    delete db.tracks[track.id];
    for (const album of Object.values(db.albums)) {
      album.trackIds = album.trackIds.filter(t => t !== track.id);
    }
    for (const artist of Object.values(db.artists)) {
      artist.trackIds = artist.trackIds.filter(t => t !== track.id);
    }
    store.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
