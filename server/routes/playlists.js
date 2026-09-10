const express = require('express');
const crypto = require('crypto');
const path = require('path');
const store = require('./../db');

const router = express.Router();

router.get('/playlists', (req, res) => {
  const { db } = store;
  res.json(Object.values(db.playlists).map(pl => ({
    ...pl,
    sortMode: pl.sortMode || 'manual',
    trackIds: Array.isArray(pl.trackIds) ? pl.trackIds : []
  })));
});

router.get('/playlists/:id', (req, res) => {
  const { db } = store;
  const pl = db.playlists[req.params.id];
  if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });
  res.json({
    ...pl,
    sortMode: pl.sortMode || 'manual',
    tracks: pl.trackIds.map(id => db.tracks[id]).filter(Boolean)
  });
});

router.post('/playlists', (req, res) => {
  const { db } = store;
  const name = (req.body && req.body.name) || 'Nova Playlist';
  const id = crypto.randomUUID();
  db.playlists[id] = { id, name, trackIds: [], createdAt: Date.now(), sortMode: 'manual' };
  store.save();
  res.json(db.playlists[id]);
});

router.put('/playlists/:id', (req, res) => {
  const { db } = store;
  const pl = db.playlists[req.params.id];
  if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });
  if (req.body.name) pl.name = req.body.name;
  if (req.body.sortMode) pl.sortMode = req.body.sortMode;
  if (Array.isArray(req.body.trackIds)) {
    const valid = [...new Set(req.body.trackIds.filter(id => db.tracks[id]))];
    pl.trackIds = valid;
  }
  store.save();
  res.json({
    ...pl,
    sortMode: pl.sortMode || 'manual',
    tracks: pl.trackIds.map(id => db.tracks[id]).filter(Boolean)
  });
});

router.delete('/playlists/:id', (req, res) => {
  const { db } = store;
  delete db.playlists[req.params.id];
  store.save();
  res.json({ ok: true });
});

router.post('/playlists/:id/tracks', (req, res) => {
  const { db } = store;
  const pl = db.playlists[req.params.id];
  if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });
  const { trackId } = req.body;
  if (!db.tracks[trackId]) return res.status(404).json({ error: 'Faixa não encontrada' });
  if (!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId);
  store.save();
  res.json(pl);
});

router.delete('/playlists/:id/tracks/:trackId', (req, res) => {
  const { db } = store;
  const pl = db.playlists[req.params.id];
  if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });
  pl.trackIds = pl.trackIds.filter(t => t !== req.params.trackId);
  store.save();
  res.json(pl);
});

// exporta playlist como M3U
router.get('/playlists/:id/export.m3u', (req, res) => {
  const { db } = store;
  const pl = db.playlists[req.params.id];
  if (!pl) return res.status(404).end();
  let content = '#EXTM3U\n';
  for (const id of pl.trackIds) {
    const t = db.tracks[id];
    if (!t) continue;
    content += `#EXTINF:${Math.round(t.duration)},${t.artist} - ${t.title}\n${t.path}\n`;
  }
  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', `attachment; filename="${pl.name}.m3u"`);
  res.send(content);
});

// importa playlist M3U (recebe conteúdo em texto no body)
router.post('/playlists/import-m3u', (req, res) => {
  const { db } = store;
  const { name, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo M3U ausente' });

  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const id = crypto.randomUUID();
  const trackIds = [];

  const byPath = {};
  for (const t of Object.values(db.tracks)) byPath[t.path] = t.id;

  for (const line of lines) {
    if (byPath[line]) trackIds.push(byPath[line]);
  }

  db.playlists[id] = { id, name: name || 'Playlist Importada', trackIds, createdAt: Date.now() };
  store.save();
  res.json(db.playlists[id]);
});

module.exports = router;
