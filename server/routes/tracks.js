const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('./mime');
const store = require('./../db');

const router = express.Router();

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildFallbackCoverSvg(track) {
  const title = (track && track.title) ? track.title : 'NightWave';
  const artist = (track && track.artist) ? track.artist : 'NightWave';
  const titleText = title.length > 28 ? title.slice(0, 28) + '…' : title;
  const artistText = artist.length > 24 ? artist.slice(0, 24) + '…' : artist;
  const palette = [
    ['#1b102b', '#7c3aed', '#22d3ee'],
    ['#0f172a', '#8b5cf6', '#f472b6'],
    ['#111827', '#10b981', '#60a5fa'],
    ['#1f2937', '#f59e0b', '#f43f5e']
  ];
  const [a, b, c] = palette[Math.abs((title.length + artist.length) % palette.length)];
  const initials = (titleText || 'N').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'N';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${a}"/>
          <stop offset="55%" stop-color="${b}"/>
          <stop offset="100%" stop-color="${c}"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg)" rx="28"/>
      <circle cx="392" cy="120" r="86" fill="rgba(255,255,255,0.12)"/>
      <circle cx="118" cy="392" r="106" fill="rgba(255,255,255,0.08)"/>
      <rect x="70" y="70" width="108" height="108" rx="22" fill="rgba(255,255,255,0.12)"/>
      <text x="70" y="148" font-size="56" font-weight="700" fill="white" font-family="Arial, Helvetica, sans-serif" text-anchor="start">${escapeXml(initials)}</text>
      <text x="70" y="310" font-size="36" font-weight="700" fill="white" font-family="Arial, Helvetica, sans-serif">${escapeXml(titleText)}</text>
      <text x="70" y="356" font-size="18" fill="rgba(255,255,255,0.9)" font-family="Arial, Helvetica, sans-serif">${escapeXml(artistText)}</text>
      <text x="70" y="430" font-size="16" fill="rgba(255,255,255,0.7)" font-family="Arial, Helvetica, sans-serif">NightWave</text>
    </svg>
  `.trim();
}

function findSidecarCover(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const candidates = new Set([
    `${baseName}.jpg`, `${baseName}.jpeg`, `${baseName}.png`, `${baseName}.webp`,
    'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp',
    'folder.jpg', 'folder.jpeg', 'folder.png', 'folder.webp',
    'front.jpg', 'front.jpeg', 'front.png', 'front.webp',
    'albumart.jpg', 'albumart.jpeg', 'albumart.png', 'albumart.webp'
  ]);

  for (const candidate of candidates) {
    const full = path.join(dir, candidate);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }

  const folderFiles = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const name of folderFiles) {
    const lower = name.toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(path.extname(lower));
    if (!isImage) continue;
    if (/(cover|folder|front|art|album)/.test(lower)) return path.join(dir, name);
  }

  return null;
}

router.get('/tracks', (req, res) => {
  const { db } = store;
  const { q, artistId, albumId, genre } = req.query;
  let list = Object.values(db.tracks);

  if (artistId) list = list.filter(t => t.artistId === artistId);
  if (albumId) list = list.filter(t => t.albumId === albumId);
  if (genre) list = list.filter(t => (t.genre || '').toLowerCase() === genre.toLowerCase());
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(t =>
      t.title.toLowerCase().includes(needle) ||
      t.artist.toLowerCase().includes(needle) ||
      t.album.toLowerCase().includes(needle)
    );
  }

  list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  res.json(list);
});

router.get('/albums', (req, res) => {
  const { db } = store;
  res.json(Object.values(db.albums));
});

router.get('/artists', (req, res) => {
  const { db } = store;
  res.json(Object.values(db.artists));
});

router.get('/tracks/:id', (req, res) => {
  const { db } = store;
  const track = db.tracks[req.params.id];
  if (!track) return res.status(404).json({ error: 'Faixa não encontrada' });
  res.json(track);
});

router.get('/tracks/:id/cover', (req, res) => {
  const { db } = store;
  const track = db.tracks[req.params.id];
  if (!track) return res.status(404).end();

  const coverDir = path.join(__dirname, '..', '..', 'data', 'covers');
  if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

  const preferredExts = ['.png', '.jpg', '.jpeg', '.webp'];
  const trackCover = preferredExts
    .map(ext => path.join(coverDir, `${track.id}${ext}`))
    .find(file => fs.existsSync(file));
  if (trackCover) return res.sendFile(trackCover);

  const sidecarCover = findSidecarCover(track.path);
  if (sidecarCover) {
    try {
      const ext = path.extname(sidecarCover).toLowerCase() || '.jpg';
      const target = path.join(coverDir, `${track.id}${ext}`);
      if (!fs.existsSync(target)) fs.copyFileSync(sidecarCover, target);
      return res.sendFile(target);
    } catch (e) {
      // continua para fallback do álbum se a cópia falhar
    }
  }

  const album = db.albums[track.albumId];
  if (album && album.hasCover) {
    const found = preferredExts
      .map(ext => path.join(coverDir, album.id + ext))
      .find(file => fs.existsSync(file));
    if (found) return res.sendFile(found);
  }

  const fallbackPath = path.join(coverDir, `${track.id}.svg`);
  if (!fs.existsSync(fallbackPath)) {
    fs.writeFileSync(fallbackPath, buildFallbackCoverSvg(track));
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(fallbackPath);
});

router.get('/tracks/:id/stream', (req, res) => {
  const { db } = store;
  const track = db.tracks[req.params.id];
  if (!track || !fs.existsSync(track.path)) return res.status(404).end();

  const stat = fs.statSync(track.path);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = mime(track.ext);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(track.path, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(track.path).pipe(res);
  }

  // registra estatística de reprodução / histórico no início do stream
  if (!range || range.startsWith('bytes=0-')) {
    db.stats[track.id] = db.stats[track.id] || { plays: 0 };
    db.stats[track.id].plays++;
    db.history.unshift({ trackId: track.id, playedAt: Date.now() });
    db.history = db.history.slice(0, 200);
    store.save();
  }
});

router.post('/tracks/:id/favorite', (req, res) => {
  const { db } = store;
  const id = req.params.id;
  if (!db.tracks[id]) return res.status(404).json({ error: 'Faixa não encontrada' });
  if (!db.favorites.includes(id)) db.favorites.push(id);
  store.save();
  res.json({ ok: true });
});

router.delete('/tracks/:id/favorite', (req, res) => {
  const { db } = store;
  const id = req.params.id;
  db.favorites = db.favorites.filter(f => f !== id);
  store.save();
  res.json({ ok: true });
});

router.get('/favorites', (req, res) => {
  const { db } = store;
  res.json(db.favorites.map(id => db.tracks[id]).filter(Boolean));
});

router.get('/history', (req, res) => {
  const { db } = store;
  res.json(db.history.map(h => ({ ...h, track: db.tracks[h.trackId] })).filter(h => h.track));
});

router.delete('/history', (req, res) => {
  const { db } = store;
  db.history = [];
  store.save();
  res.json({ ok: true });
});

module.exports = router;
