const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const store = require('./../db');
const { scanFolders } = require('./../scan');

const execFileAsync = promisify(execFile);
const router = express.Router();

const SEARCH_URL = 'https://www.youtube.com/results';
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
};

function slugify(value) {
  return String(value || 'download')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'download';
}

function makeUniqueDownloadBaseName(title, videoId) {
  const base = slugify(title || 'youtube-download');
  const suffix = String(videoId || '').slice(0, 8);
  return `${base}-${suffix}`;
}

function findExistingDownload(folder, videoId, title) {
  if (!fs.existsSync(folder)) return null;
  const suffix = String(videoId || '').slice(0, 8);
  const candidates = [
    makeUniqueDownloadBaseName(title, videoId),
    `${slugify(title || 'youtube-download')}-${suffix}`,
    `${slugify(title || 'youtube-download')}`
  ];

  for (const name of candidates) {
    const matches = fs.readdirSync(folder)
      .filter(file => file.toLowerCase().startsWith(name.toLowerCase()))
      .filter(file => ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.webm', '.opus', '.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()));
    if (matches.length) {
      const preferred = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.webm', '.opus'];
      const chosen = matches.sort((a, b) => {
        const pa = preferred.indexOf(path.extname(a).toLowerCase());
        const pb = preferred.indexOf(path.extname(b).toLowerCase());
        return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
      })[0];
      return path.join(folder, chosen);
    }
  }

  const directMatch = fs.readdirSync(folder).find(file => file.toLowerCase().includes(String(videoId || '').toLowerCase()));
  if (directMatch) return path.join(folder, directMatch);

  return null;
}

function ensureOfflineFolder() {
  const { db } = store;
  const folder = path.join(__dirname, '..', '..', 'data', 'offline-downloads');
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  if (!db.config.musicFolders.includes(folder)) {
    db.config.musicFolders.push(folder);
    store.save();
  }
  return folder;
}

// Extrai um objeto JSON embutido no HTML da página, respeitando aspas/escapes
function extractJsonObject(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaping) escaping = false;
      else if (ch === '\\') escaping = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

function pickBestThumb(thumbs) {
  if (!thumbs || !thumbs.length) return '';
  return thumbs[thumbs.length - 1].url || '';
}

async function saveYouTubeCover(folder, baseName, videoId) {
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/default.jpg`
  ];

  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: BROWSER_HEADERS });
      if (!r.ok) continue;
      const buffer = Buffer.from(await r.arrayBuffer());
      if (!buffer.length) continue;
      const coverFile = path.join(folder, `${baseName}.jpg`);
      fs.writeFileSync(coverFile, buffer);
      return coverFile;
    } catch (e) {
      // tenta a próxima imagem se houver falha de rede ou URL inexistente
    }
  }

  return null;
}

async function embedCoverIntoAudio(audioFile, coverFile) {
  if (!audioFile || !coverFile || !fs.existsSync(audioFile) || !fs.existsSync(coverFile)) return false;
  const ffmpegPath = 'C:\\Users\\Pedro\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin\\ffmpeg.exe';
  const ffmpeg = fs.existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg';

  try {
    const outputFile = `${audioFile}.with-cover.mp3`;
    await execFileAsync(ffmpeg, [
      '-y', '-i', audioFile,
      '-i', coverFile,
      '-map', '0:a',
      '-map', '1:v',
      '-c:a', 'copy',
      '-c:v', 'mjpeg',
      '-disposition:v', 'attached_pic',
      '-id3v2_version', '3',
      outputFile
    ], { maxBuffer: 50 * 1024 * 1024 });

    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(audioFile);
      fs.renameSync(outputFile, audioFile);
      return true;
    }
  } catch (e) {
    // se o ffmpeg não estiver disponível, a capa no disco já faz o trabalho
  }

  return false;
}

function parseSearchResults(html) {
  const jsonStr = extractJsonObject(html, 'var ytInitialData');
  if (!jsonStr) return [];

  let data;
  try { data = JSON.parse(jsonStr); } catch (e) { return []; }

  const results = [];
  try {
    const sections = data.contents.twoColumnSearchResultsRenderer.primaryContents
      .sectionListRenderer.contents;

    for (const section of sections) {
      const items = section.itemSectionRenderer && section.itemSectionRenderer.contents;
      if (!items) continue;

      for (const item of items) {
        const vr = item.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const title = (vr.title && vr.title.runs || []).map(r => r.text).join('');
        const channel =
          (vr.ownerText && vr.ownerText.runs && vr.ownerText.runs[0] && vr.ownerText.runs[0].text) ||
          (vr.longBylineText && vr.longBylineText.runs && vr.longBylineText.runs[0] && vr.longBylineText.runs[0].text) ||
          '';
        const thumbnail = pickBestThumb(vr.thumbnail && vr.thumbnail.thumbnails);
        const duration = (vr.lengthText && vr.lengthText.simpleText) || '';

        if (title) results.push({ videoId: vr.videoId, title, channel, thumbnail, duration });
      }
    }
  } catch (e) {
    // a estrutura da página do YouTube mudou; devolve o que já foi encontrado até aqui
  }
  return results;
}

router.get('/youtube/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'EMPTY_QUERY', message: 'Informe um termo de busca.' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `${SEARCH_URL}?search_query=${encodeURIComponent(q)}`;
    const r = await fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(timer);

    if (!r.ok) {
      return res.status(502).json({
        error: 'YOUTUBE_UNAVAILABLE',
        message: 'O YouTube não respondeu como esperado (status ' + r.status + '). Tente novamente em instantes.'
      });
    }

    const html = await r.text();
    const results = parseSearchResults(html).slice(0, 30);
    res.json(results);
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return res.status(504).json({
        error: 'TIMEOUT',
        message: 'A busca demorou demais para responder. Verifique sua conexão com a internet e tente de novo.'
      });
    }
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Não foi possível conectar ao YouTube: ' + e.message + '. Verifique sua conexão com a internet.'
    });
  }
});

router.post('/youtube/download', async (req, res) => {
  try {
    const { videoId, title, channel } = req.body || {};
    if (!videoId) {
      return res.status(400).json({ error: 'VIDEO_ID_REQUIRED', message: 'Informe o ID do vídeo do YouTube.' });
    }

    const folder = ensureOfflineFolder();
    const existing = findExistingDownload(folder, videoId, title);
    if (existing) {
      const result = await scanFolders([folder]);
      const track = Object.values(store.db.tracks).find(t => t.path === existing) || Object.values(store.db.tracks).slice(-1)[0];
      return res.json({ ok: true, reused: true, track, result, file: existing });
    }

    const baseName = makeUniqueDownloadBaseName(title, videoId);
    const outputTemplate = path.join(folder, `${baseName}.%(ext)s`);
    const pythonCmd = process.env.PYTHON || 'python';
    const ffmpegBin = 'C:\\Users\\Pedro\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin';
    const args = [
      '-m', 'yt_dlp',
      `https://www.youtube.com/watch?v=${videoId}`,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--ffmpeg-location', ffmpegBin,
      '--embed-thumbnail',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--no-playlist',
      '--restrict-filenames',
      '--no-warnings',
      '--output', outputTemplate
    ];

    await execFileAsync(pythonCmd, args, { maxBuffer: 50 * 1024 * 1024 });

    const items = fs.readdirSync(folder)
      .filter(file => file.toLowerCase().startsWith(baseName.toLowerCase()))
      .filter(file => ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.webm', '.opus'].includes(path.extname(file).toLowerCase()));

    if (!items.length) {
      return res.status(500).json({ error: 'DOWNLOAD_FAILED', message: 'O arquivo não foi encontrado após o download.' });
    }

    const preferred = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.webm', '.opus'];
    const finalFile = path.join(folder, items.sort((a, b) => {
      const pa = preferred.indexOf(path.extname(a).toLowerCase());
      const pb = preferred.indexOf(path.extname(b).toLowerCase());
      return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb) || b.length - a.length;
    })[0]);

    const coverFile = await saveYouTubeCover(folder, baseName, videoId);
    if (coverFile && finalFile.toLowerCase().endsWith('.mp3')) {
      await embedCoverIntoAudio(finalFile, coverFile);
    }

    const trackId = crypto.createHash('md5').update(finalFile).digest('hex');
    const coverTargetDir = path.join(__dirname, '..', 'data', 'covers');
    if (!fs.existsSync(coverTargetDir)) fs.mkdirSync(coverTargetDir, { recursive: true });
    if (coverFile) {
      const target = path.join(coverTargetDir, `${trackId}${path.extname(coverFile).toLowerCase() || '.jpg'}`);
      if (!fs.existsSync(target)) fs.copyFileSync(coverFile, target);
    }

    const result = await scanFolders([folder]);
    const track = Object.values(store.db.tracks).find(t => t.path === finalFile) || Object.values(store.db.tracks).slice(-1)[0];

    if (track) {
      return res.json({ ok: true, track, result, file: finalFile });
    }

    res.json({ ok: true, result, file: finalFile });
  } catch (e) {
    res.status(500).json({
      error: 'DOWNLOAD_FAILED',
      message: 'Não foi possível baixar a música: ' + e.message
    });
  }
});

module.exports = router;
