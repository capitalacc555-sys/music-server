const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DB = {
  config: {
    musicFolders: [],
    theme: 'dark'
  },
  tracks: {},      // id -> track object
  albums: {},      // id -> album object
  artists: {},      // id -> artist object
  playlists: {},    // id -> playlist object
  favorites: [],    // array of track ids
  history: [],       // array of { trackId, playedAt }
  stats: {}          // trackId -> { plays: n }
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function load() {
  ensureStore();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Banco de dados corrompido, recriando...', e);
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let cache = load();
let saveScheduled = false;

function save() {
  if (saveScheduled) return;
  saveScheduled = true;
  setImmediate(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
    saveScheduled = false;
  });
}

module.exports = {
  get db() {
    return cache;
  },
  save,
  reload() {
    cache = load();
    return cache;
  }
};
