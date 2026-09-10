const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');
const store = require('./db');

const SUPPORTED_EXT = new Set([
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.opus', '.wma',
  '.aiff', '.aif', '.alac', '.m4a', '.mid', '.midi',
  '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v'
]);

function idFor(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn('Não foi possível ler a pasta:', dir, e.message);
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

function slug(str) {
  return (str || 'desconhecido').toLowerCase().trim();
}

function isUnknownAlbumName(value) {
  return !value || /^(album|álbum)\s*desconhecido|unknown|untitled|single$/i.test(String(value).trim());
}

function albumIdFor(artistName, albumName, filePath) {
  const artist = slug(artistName);
  const normalizedAlbum = slug(albumName);
  if (isUnknownAlbumName(albumName)) {
    return idFor(`album:${artist}:${slug(path.basename(filePath, path.extname(filePath)))}`);
  }
  return idFor(`album:${artist}:${normalizedAlbum}`);
}

function saveCoverForAlbum(albumId, buffer, ext = '.jpg') {
  const coverDir = path.join(__dirname, '..', 'data', 'covers');
  if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
  const normalizedExt = ext && ext.toLowerCase().startsWith('.png') ? '.png' : '.jpg';
  const target = path.join(coverDir, `${albumId}${normalizedExt}`);
  fs.writeFileSync(target, buffer);
  return target;
}

function saveTrackSpecificCover(trackId, buffer, ext = '.jpg') {
  const coverDir = path.join(__dirname, '..', 'data', 'covers');
  if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
  const normalizedExt = ext && ext.toLowerCase().startsWith('.png') ? '.png' : '.jpg';
  const target = path.join(coverDir, `${trackId}${normalizedExt}`);
  fs.writeFileSync(target, buffer);
  return target;
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

async function scanFolders(folders, onProgress) {
  const { db } = store;
  const allFiles = [];
  for (const folder of folders) {
    if (fs.existsSync(folder)) {
      walk(folder, allFiles);
    }
  }

  let processed = 0;
  const foundIds = new Set();

  for (const filePath of allFiles) {
    const id = idFor(filePath);
    foundIds.add(id);
    processed++;

    const existing = db.tracks[id];
    const stat = fs.statSync(filePath);
    const hasUsableExistingCover = existing && existing.coverPath && fs.existsSync(existing.coverPath);
    if (existing && existing.mtimeMs === stat.mtimeMs && hasUsableExistingCover) {
      if (onProgress) onProgress({ processed, total: allFiles.length, file: filePath, skipped: true });
      continue;
    }

    let meta = { common: {}, format: {} };
    try {
      meta = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    } catch (e) {
      // arquivo sem metadados legíveis, segue com valores padrão
    }

    const title = meta.common.title || path.basename(filePath, path.extname(filePath));
    const artistName = meta.common.artist || meta.common.albumartist || 'Artista Desconhecido';
    const rawAlbumName = meta.common.album || 'Álbum Desconhecido';
    const albumName = isUnknownAlbumName(rawAlbumName) ? `${title} (single)` : rawAlbumName;
    const year = meta.common.year || null;
    const genre = (meta.common.genre && meta.common.genre[0]) || null;
    const duration = meta.format.duration || 0;
    const track = meta.common.track && meta.common.track.no || null;

    const artistId = idFor('artist:' + slug(artistName));
    const albumId = albumIdFor(artistName, albumName, filePath);

    if (!db.artists[artistId]) {
      db.artists[artistId] = { id: artistId, name: artistName, trackIds: [] };
    }
    if (!db.albums[albumId]) {
      db.albums[albumId] = { id: albumId, name: albumName, artist: artistName, artistId, year, trackIds: [], hasCover: false };
    }

    let coverPath = null;
    if (meta.common.picture && meta.common.picture.length > 0) {
      const pic = meta.common.picture.find(p => p && p.data && p.data.length > 0) || meta.common.picture[0];
      const coverDir = path.join(__dirname, '..', 'data', 'covers');
      if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
      const ext = pic.format && pic.format.includes('png') ? '.png' : '.jpg';
      coverPath = path.join(coverDir, `${id}${ext}`);
      try {
        fs.writeFileSync(coverPath, pic.data);
      } catch (e) {
        coverPath = null;
      }
    }

    if (!coverPath) {
      const sidecarCover = findSidecarCover(filePath);
      if (sidecarCover) {
        try {
          const ext = path.extname(sidecarCover).toLowerCase();
          const target = path.join(__dirname, '..', 'data', 'covers', `${id}${ext || '.jpg'}`);
          fs.copyFileSync(sidecarCover, target);
          coverPath = target;
        } catch (e) {
          // ignora cópia de capa local se não for possível salvar
        }
      }
    }

    if (coverPath && !db.albums[albumId].hasCover) {
      const coverExt = path.extname(coverPath).toLowerCase();
      db.albums[albumId].hasCover = true;
      db.albums[albumId].coverExt = coverExt || '.jpg';
      const albumCoverTarget = path.join(__dirname, '..', 'data', 'covers', `${albumId}${coverExt || '.jpg'}`);
      if (!fs.existsSync(albumCoverTarget)) fs.copyFileSync(coverPath, albumCoverTarget);
    }

    db.tracks[id] = {
      id,
      path: filePath,
      title,
      artist: artistName,
      artistId,
      album: albumName,
      albumId,
      genre,
      year,
      duration,
      trackNo: track,
      ext: path.extname(filePath).toLowerCase(),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      addedAt: existing ? existing.addedAt : Date.now(),
      coverPath: coverPath || null
    };

    if (!db.albums[albumId].trackIds.includes(id)) db.albums[albumId].trackIds.push(id);
    if (!db.artists[artistId].trackIds.includes(id)) db.artists[artistId].trackIds.push(id);

    if (onProgress) onProgress({ processed, total: allFiles.length, file: filePath, skipped: false });
  }

  // remove faixas que não existem mais no disco
  for (const id of Object.keys(db.tracks)) {
    if (!foundIds.has(id)) {
      delete db.tracks[id];
    }
  }
  // limpa álbuns/artistas órfãos
  for (const albumId of Object.keys(db.albums)) {
    db.albums[albumId].trackIds = db.albums[albumId].trackIds.filter(t => db.tracks[t]);
    if (db.albums[albumId].trackIds.length === 0) delete db.albums[albumId];
  }
  for (const artistId of Object.keys(db.artists)) {
    db.artists[artistId].trackIds = db.artists[artistId].trackIds.filter(t => db.tracks[t]);
    if (db.artists[artistId].trackIds.length === 0) delete db.artists[artistId];
  }

  store.save();
  return { total: allFiles.length, tracks: Object.keys(db.tracks).length };
}

module.exports = { scanFolders, SUPPORTED_EXT };
