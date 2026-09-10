(() => {
  'use strict';

  const api = {
    async get(url) { const r = await fetch(url); return r.json(); },
    async post(url, body) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      return r.json();
    },
    async put(url, body) {
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      return r.json();
    },
    async del(url, body) {
      const r = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      return r.json();
    }
  };

  const state = {
    view: 'home',
    tracks: [],
    albums: [],
    playlists: [],
    favorites: [],
    history: [],
    queue: [],
    queueIndex: -1,
    shuffle: false,
    repeat: 'off', // off | all | one
    currentPlaylistId: null,
    theme: null
  };

  const THEME_PRESETS = {
    neon: { name: 'Neon', accent: '#29d9ff', secondary: '#ff3ec9', bg: '#020b14', bgCard: '#111f2d', sidebarBg: '#040d18', text: '#edf6ff' },
    violet: { name: 'Violet', accent: '#8b5cf6', secondary: '#ec4899', bg: '#120d1c', bgCard: '#1a1328', sidebarBg: '#0d0915', text: '#f5f3ff' },
    sunset: { name: 'Sunset', accent: '#ff8a65', secondary: '#ff4d8d', bg: '#170d14', bgCard: '#231822', sidebarBg: '#120b11', text: '#fff2f2' },
    ocean: { name: 'Ocean', accent: '#45d0ff', secondary: '#2dd4bf', bg: '#071b2a', bgCard: '#102a3a', sidebarBg: '#051722', text: '#ecfeff' },
    classic: { name: 'Classic', accent: '#2dd4bf', secondary: '#7c3aed', bg: '#0f172a', bgCard: '#111827', sidebarBg: '#0b1220', text: '#f8fafc' }
  };

  const el = {
    viewRoot: document.getElementById('view-root'),
    playlistList: document.getElementById('playlist-list'),
    audio: document.getElementById('audio-el'),
    nowCover: document.getElementById('now-cover'),
    nowTitle: document.getElementById('now-title'),
    nowArtist: document.getElementById('now-artist'),
    nowFav: document.getElementById('now-fav'),
    btnPlay: document.getElementById('btn-play'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnShuffle: document.getElementById('btn-shuffle'),
    btnRepeat: document.getElementById('btn-repeat'),
    seek: document.getElementById('seek'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    volume: document.getElementById('volume'),
    search: document.getElementById('global-search'),
    scanBtn: document.getElementById('btn-scan'),
    modalRoot: document.getElementById('modal-root')
  };

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ---------------- Marca / configuração editável (config.js) ----------------
  function startBrandIntro() {
    const intro = document.getElementById('brand-intro');
    const introLogo = document.getElementById('brand-intro-logo');
    const introName = document.getElementById('brand-intro-name');
    const finalLogo = document.getElementById('brand-logo-img');
    if (!intro || !introLogo || !finalLogo) return;

    const finalSrc = finalLogo.src || '/img/expirada-logo.png';
    introLogo.src = finalSrc;

    const finalRect = finalLogo.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const deltaX = finalRect.left + finalRect.width / 2 - centerX;
    const deltaY = finalRect.top + finalRect.height / 2 - centerY;

    introLogo.style.setProperty('--to-x', `${deltaX}px`);
    introLogo.style.setProperty('--to-y', `${deltaY}px`);
    introLogo.style.setProperty('--to-scale', `${finalRect.width / 260}`);

    const appName = document.getElementById('brand-name')?.textContent || 'NightWave';
    if (introName) introName.textContent = appName;

    intro.style.opacity = '1';
    intro.style.visibility = 'visible';
  }

  async function loadBranding() {
    try {
      const cfg = await api.get('/api/app-config');
      const appName = cfg.appName || 'NightWave';
      if (appName) {
        document.title = appName;
        document.getElementById('brand-name').textContent = appName;
        const introName = document.getElementById('brand-intro-name');
        if (introName) introName.textContent = appName;
      }
      const img = document.getElementById('brand-logo-img');
      const safeLogo = cfg.logo ? '/' + cfg.logo.replace(/^\/+/, '') : '/img/expirada-logo.png';
      if (img) {
        img.onload = () => {
          img.style.display = '';
          document.getElementById('brand-mark').style.display = 'none';
          startBrandIntro();
        };
        img.onerror = () => {
          img.src = '/img/expirada-logo.png';
          img.style.display = '';
          document.getElementById('brand-mark').style.display = 'none';
          startBrandIntro();
        };
        img.src = safeLogo;
      } else {
        startBrandIntro();
      }
      if (cfg.cores) {
        const map = {
          fundo: '--bg', fundoCard: '--bg-card', barraLateral: '--sidebar-bg',
          verde: '--green', roxo: '--purple', texto: '--text'
        };
        Object.entries(map).forEach(([key, cssVar]) => {
          if (cfg.cores[key]) document.documentElement.style.setProperty(cssVar, cfg.cores[key]);
        });
      }
    } catch (e) {
      document.getElementById('brand-name').textContent = 'NightWave';
      const introName = document.getElementById('brand-intro-name');
      if (introName) introName.textContent = 'NightWave';
      startBrandIntro();
    }
  }

  function normalizeOverlayMode(value) {
    if (value === 'blurred' || value === 'soft' || value === 'clear' || value === 'frosted') {
      return value === 'frosted' ? 'soft' : value;
    }
    return 'soft';
  }

  function normalizeBackgroundMode(value) {
    if (value === 'image' || value === 'video') return value;
    return 'none';
  }

  function readThemeConfig() {
    try {
      const raw = localStorage.getItem('nightwave-theme-config');
      const fallback = { ...THEME_PRESETS.neon, backgroundMode: 'none', backgroundImage: '', backgroundVideo: '', overlayMode: 'soft' };
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const next = { ...fallback, ...parsed };
      next.overlayMode = normalizeOverlayMode(next.overlayMode);
      next.backgroundMode = normalizeBackgroundMode(next.backgroundMode);
      return next;
    } catch (e) {
      return { ...THEME_PRESETS.neon, backgroundMode: 'none', backgroundImage: '', backgroundVideo: '', overlayMode: 'soft' };
    }
  }

  function applyThemeConfig(cfg = readThemeConfig()) {
    const normalized = { ...readThemeConfig(), ...cfg };
    normalized.backgroundMode = normalizeBackgroundMode(normalized.backgroundMode);
    normalized.overlayMode = normalizeOverlayMode(normalized.overlayMode);

    const preset = THEME_PRESETS[normalized.theme] || THEME_PRESETS.neon;
    const accent = normalized.accent || preset.accent;
    const secondary = normalized.secondary || preset.secondary;
    const bg = normalized.bg || preset.bg;
    const bgCard = normalized.bgCard || preset.bgCard;
    const sidebarBg = normalized.sidebarBg || preset.sidebarBg;
    const text = normalized.text || preset.text;
    const overlayMode = normalized.overlayMode;

    document.documentElement.style.setProperty('--bg', bg);
    document.documentElement.style.setProperty('--bg-card', bgCard);
    document.documentElement.style.setProperty('--sidebar-bg', sidebarBg);
    document.documentElement.style.setProperty('--green', accent);
    document.documentElement.style.setProperty('--green-dim', accent);
    document.documentElement.style.setProperty('--purple', secondary);
    document.documentElement.style.setProperty('--purple-dim', secondary);
    document.documentElement.style.setProperty('--text', text);
    document.documentElement.style.setProperty('--text-dim', '#b8c4d5');
    document.documentElement.style.setProperty('--text-faint', '#7a8aa2');
    document.documentElement.style.setProperty('--border', 'rgba(140, 170, 215, 0.22)');
    document.documentElement.style.setProperty('--app-accent', accent);

    const layer = document.getElementById('app-bg-layer');
    const video = document.getElementById('app-bg-video');
    const bgMode = normalized.backgroundMode || 'none';
    document.body.classList.toggle('theme-cover-enabled', bgMode !== 'none');
    document.body.dataset.overlayMode = overlayMode;

    if (overlayMode === 'blurred') {
      document.body.style.setProperty('--glass-alpha', '0.3');
      document.body.style.setProperty('--glass-blur', '18px');
    } else if (overlayMode === 'soft') {
      document.body.style.setProperty('--glass-alpha', '0.58');
      document.body.style.setProperty('--glass-blur', '8px');
    } else {
      document.body.style.setProperty('--glass-alpha', '0.78');
      document.body.style.setProperty('--glass-blur', '0px');
    }

    if (bgMode === 'image' && normalized.backgroundImage) {
      layer.style.setProperty('--app-bg-image', `url("${normalized.backgroundImage}")`);
      layer.classList.add('visible');
      video.classList.remove('visible');
      video.src = '';
    } else if (bgMode === 'video' && normalized.backgroundVideo) {
      layer.classList.remove('visible');
      video.src = normalized.backgroundVideo;
      video.classList.add('visible');
    } else {
      layer.classList.remove('visible');
      video.classList.remove('visible');
      video.src = '';
      layer.style.setProperty('--app-bg-image', 'none');
    }

    state.theme = normalized;
    localStorage.setItem('nightwave-theme-config', JSON.stringify(normalized));
  }

  function saveThemeConfig(partial) {
    const next = { ...readThemeConfig(), ...partial };
    applyThemeConfig(next);
    return next;
  }

  // ---------------- Data loading ----------------
  async function loadAll() {
    const [tracks, albums, playlists, favorites, history] = await Promise.all([
      api.get('/api/tracks'),
      api.get('/api/albums'),
      api.get('/api/playlists'),
      api.get('/api/favorites'),
      api.get('/api/history')
    ]);
    state.tracks = tracks;
    state.albums = albums;
    state.playlists = playlists;
    state.favorites = favorites;
    state.history = history;
    renderSidebarPlaylists();
    render();
  }

  async function refreshStateAndRender() {
    try {
      await loadAll();
    } catch (e) {
      renderSidebarPlaylists();
      render();
    }
  }

  // ---------------- Sidebar ----------------
  function confirmDeletePlaylist(playlist) {
    el.modalRoot.innerHTML = `
      <div class="modal-overlay" id="playlist-delete-overlay">
        <div class="modal-box">
          <h2>Excluir playlist</h2>
          <p style="margin:0 0 16px; color:var(--text-dim); line-height:1.5;">Você realmente deseja excluir esta playlist?</p>
          <div class="modal-actions">
            <button class="btn-secondary" id="playlist-delete-no">Não</button>
            <button class="btn-primary" id="playlist-delete-yes">Sim</button>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('playlist-delete-overlay');
    const noBtn = document.getElementById('playlist-delete-no');
    const yesBtn = document.getElementById('playlist-delete-yes');

    if (overlay) overlay.onclick = (e) => { if (e.target.id === 'playlist-delete-overlay') el.modalRoot.innerHTML = ''; };
    if (noBtn) noBtn.onclick = () => { el.modalRoot.innerHTML = ''; };
    if (yesBtn) yesBtn.onclick = async () => {
      await api.del(`/api/playlists/${playlist.id}`);
      if (state.currentPlaylistId === playlist.id) {
        state.currentPlaylistId = null;
        state.view = 'home';
        setActiveNav('home');
      }
      el.modalRoot.innerHTML = '';
      await refreshStateAndRender();
    };
  }

  function playlistItemIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h12M4 12h12M4 17h7M17 17h3M18.5 15.5v3M17 17h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function renderSidebarPlaylists() {
      if (!el.playlistList) return;
      el.playlistList.innerHTML = '';
      const playlists = Array.isArray(state.playlists) ? state.playlists.filter(pl => pl && !['Downloads Offline', 'Downloads'].includes(pl.name)) : [];
      if (!playlists.length) {
        const empty = document.createElement('div');
        empty.className = 'sidebar-empty';
        empty.textContent = 'Sem playlists';
        el.playlistList.appendChild(empty);
        return;
      }
      playlists.forEach(pl => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sidebar-playlist-item';
        const count = playlistTrackCount(pl);
        item.innerHTML = `
          <span class="playlist-item-main">
            <img class="sidebar-playlist-cover" src="${playlistCoverUrl(pl)}" alt="" />
            <span class="sidebar-playlist-text">
              <span class="sidebar-playlist-name">${escapeHtml(pl.name)}</span>
              <span class="sidebar-playlist-meta">${count} música${count === 1 ? '' : 's'}</span>
            </span>
          </span>
        `;
        item.onclick = () => {
          state.view = 'playlist';
          state.currentPlaylistId = pl.id;
          setActiveNav(null);
          render();
        };
        el.playlistList.appendChild(item);
      });
  }

  function playlistTrackCount(playlist) {
      if (!playlist) return 0;
      const ids = Array.isArray(playlist.trackIds) ? playlist.trackIds.filter(Boolean) : [];
      if (ids.length) return [...new Set(ids)].length;
      const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.filter(Boolean) : [];
      if (tracks.length) return [...new Set(tracks.map(t => t && t.id).filter(Boolean))].length;
      return 0;
  }

  function playlistCoverUrl(playlist) {
      const key = `nightwave.playlist.cover.${playlist.id}`;
      const custom = localStorage.getItem(key);
      if (custom) return custom;
      const firstTrack = Array.isArray(playlist.tracks) ? playlist.tracks[0] : null;
      if (firstTrack) return trackCoverUrl(firstTrack);
      return '/img/expirada-logo.png';
  }

  function renderPlaylistsPage() {
      el.viewRoot.innerHTML = '';

      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = 'Playlists';
      el.viewRoot.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'playlist-page-actions';
      actions.innerHTML = '<button class="btn-primary" id="playlist-page-new">Criar playlist</button>';
      el.viewRoot.appendChild(actions);

      const list = document.createElement('div');
      list.className = 'playlist-page-list';

      const filtered = Array.isArray(state.playlists) ? state.playlists.filter(pl => pl && !['Downloads Offline', 'Downloads'].includes(pl.name)) : [];
      if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<h3>Sem playlists ainda</h3><p>Crie sua primeira playlist para organizar as músicas.</p>';
        list.appendChild(empty);
      } else {
        filtered.forEach(pl => {
          if (!pl) return;
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'playlist-page-item';
          const count = playlistTrackCount(pl);
          const cover = playlistCoverUrl(pl);
          item.innerHTML = `
            <span class="playlist-page-main">
              <img class="playlist-page-cover" src="${cover}" alt="" />
              <span class="playlist-page-text">
                <span class="playlist-page-name">${escapeHtml(pl.name)}</span>
                <span class="playlist-page-meta">${count} música${count === 1 ? '' : 's'}</span>
              </span>
            </span>
          `;
          item.onclick = () => {
            state.view = 'playlist';
            state.currentPlaylistId = pl.id;
            setActiveNav(null);
            render();
          };
          list.appendChild(item);
        });
      }

      el.viewRoot.appendChild(list);
      const newBtn = document.getElementById('playlist-page-new');
      if (newBtn) newBtn.onclick = () => openCreatePlaylistModal();
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.track-menu-btn') && !event.target.closest('.track-menu-popover')) {
      document.querySelectorAll('.track-menu-popover').forEach(el => el.classList.remove('open'));
    }
  });

  function setActiveNav(view) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
      state.view = btn.dataset.view;
      state.currentPlaylistId = null;
      setActiveNav(state.view);
      renderSidebarPlaylists();
      render();
    };
  });

  async function refreshPlaylistsState() {
    try {
      state.playlists = await api.get('/api/playlists');
    } catch (e) {
      state.playlists = [];
    }
  }

  function openCreatePlaylistModal(onCreated) {
    el.modalRoot.innerHTML = `
      <div class="modal-overlay" id="playlist-create-overlay">
        <div class="modal-box">
          <h2>Nova playlist</h2>
          <label for="playlist-create-input" style="display:block; margin-bottom:6px; font-size:12px; color:var(--text-dim);">Nome da playlist</label>
          <input id="playlist-create-input" type="text" placeholder="Minha playlist" style="width:100%; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-bottom:12px;" />
          <div class="modal-actions">
            <button class="btn-secondary" id="playlist-create-cancel">Cancelar</button>
            <button class="btn-primary" id="playlist-create-submit">Criar</button>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('playlist-create-overlay');
    const input = document.getElementById('playlist-create-input');
    const cancel = document.getElementById('playlist-create-cancel');
    const submit = document.getElementById('playlist-create-submit');

    if (overlay) overlay.onclick = (e) => { if (e.target.id === 'playlist-create-overlay') el.modalRoot.innerHTML = ''; };
    if (cancel) cancel.onclick = () => { el.modalRoot.innerHTML = ''; };
    if (input) input.focus();
    if (submit) submit.onclick = async () => {
      const name = input ? input.value.trim() : '';
      if (!name) return;
      let pl = state.playlists.find(p => p && p.name && p.name.toLowerCase() === name.toLowerCase());
      if (!pl) {
        pl = await api.post('/api/playlists', { name });
      }
      el.modalRoot.innerHTML = '';
      await refreshStateAndRender();
      if (state.view === 'playlists') {
        renderPlaylistsPage();
      }
      if (onCreated) onCreated(pl);
    };
  }

  const btnNewPlaylist = document.getElementById('btn-new-playlist');
  if (btnNewPlaylist) {
    btnNewPlaylist.onclick = () => openCreatePlaylistModal();
  }

  // ---------------- Views ----------------
  function render() {
    if (state.view === 'home') return renderHome();
    if (state.view === 'search') return renderSearch();
    if (state.view === 'library') return renderLibrary();
    if (state.view === 'playlists') return renderPlaylistsPage();
    if (state.view === 'playlist') return renderPlaylist();
    if (state.view === 'online') return renderOnline();
  }

  function makeFallbackCover(track, accent = '#29d9ff', secondary = '#ff3ec9') {
    const name = (track && (track.artist || track.title || 'NightWave')) || 'NightWave';
    const initials = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'NW';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${accent}" />
            <stop offset="100%" stop-color="${secondary}" />
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="24" fill="url(#g)"/>
        <circle cx="100" cy="76" r="36" fill="rgba(255,255,255,0.16)"/>
        <path d="M120 96v44c0 10-9 18-19 18s-19-8-19-18 9-18 19-18c5 0 10 2 14 5V67l30-8v40c0 10-9 18-19 18s-19-8-19-18 9-18 19-18c5 0 9 1 13 4" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="100" y="146" text-anchor="middle" fill="white" font-size="26" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${initials}</text>
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function trackCoverUrl(track) {
    const key = `nightwave.cover.${track.id}`;
    const custom = localStorage.getItem(key);
    if (custom) return custom;
    return `/api/tracks/${track.id}/cover`;
  }

  function albumCard(album) {
    const card = document.createElement('div');
    card.className = 'card';
    const firstTrackId = Array.isArray(album.trackIds) && album.trackIds.length ? album.trackIds[0] : null;
    const fallbackCover = firstTrackId ? makeFallbackCover(state.tracks.find(t => t.id === firstTrackId) || album) : makeFallbackCover(album);
    card.innerHTML = `
      <img class="card-cover" src="${firstTrackId ? `/api/tracks/${firstTrackId}/cover` : '/img/expirada-logo.png'}" onerror="this.onerror=null; this.src='${fallbackCover}';" />
      <div class="card-title">${escapeHtml(album.name)}</div>
      <div class="card-sub">${escapeHtml(album.artist)}</div>
      <div class="card-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
    `;
    const ids = Array.isArray(album.trackIds) ? album.trackIds : [];
    card.onclick = () => playQueue(ids.map(id => state.tracks.find(t => t.id === id)).filter(Boolean), 0);
    return card;
  }

  function isOfflineTrack(track) {
    return !!(track && typeof track.path === 'string' && /offline-downloads/i.test(track.path));
  }

  function sortOfflineFirst(list) {
    return [...list].sort((a, b) => {
      const aOffline = isOfflineTrack(a) ? 1 : 0;
      const bOffline = isOfflineTrack(b) ? 1 : 0;
      if (aOffline !== bOffline) return bOffline - aOffline;
      const aAdded = a.addedAt || 0;
      const bAdded = b.addedAt || 0;
      return bAdded - aAdded;
    });
  }

  function moveTrackInState(trackId, direction) {
    const index = state.tracks.findIndex(t => t.id === trackId);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.tracks.length) return;
    [state.tracks[index], state.tracks[nextIndex]] = [state.tracks[nextIndex], state.tracks[index]];
    render();
  }

  function renderHome() {
    el.viewRoot.innerHTML = '';

    if (state.tracks.length === 0) {
      el.viewRoot.appendChild(emptyState());
      return;
    }

    const recentTrack = state.history?.[0]?.track || state.tracks[0];
    const hero = document.createElement('div');
    hero.className = 'home-hero';
    hero.innerHTML = `
      <div class="home-hero-copy">
        <div class="home-kicker">Para você</div>
        <h2>Seu universo sonoro</h2>
        <p>${recentTrack ? escapeHtml(recentTrack.title) : 'Sua biblioteca está pronta para tocar.'}</p>
        <div class="home-hero-actions">
          <button class="btn-primary" type="button" id="home-random-btn">▶ Tocar aleatório</button>
          <button class="btn-secondary" type="button" id="home-library-btn">Abrir biblioteca</button>
        </div>
      </div>
      <div class="home-hero-card">
        <div class="home-hero-card-label">No momento</div>
        <div class="home-hero-card-name">${recentTrack ? escapeHtml(recentTrack.title) : 'NightWave'}</div>
        <div class="home-hero-card-meta">${recentTrack ? escapeHtml(recentTrack.artist || 'Artista desconhecido') : 'Biblioteca local'}</div>
      </div>
    `;
    el.viewRoot.appendChild(hero);

    const randomBtn = document.getElementById('home-random-btn');
    if (randomBtn) randomBtn.onclick = () => {
      const list = state.tracks.slice();
      if (!list.length) return;
      const idx = Math.floor(Math.random() * list.length);
      playQueue(list, idx);
    };

    const libraryBtn = document.getElementById('home-library-btn');
    if (libraryBtn) libraryBtn.onclick = () => {
      state.view = 'library';
      setActiveNav('library');
      render();
    };

    const quickMixes = document.createElement('div');
    quickMixes.className = 'card-grid home-grid';
    const mixSeeds = [
      { name: 'Músicas para focar', subtitle: `${state.tracks.length} faixas` },
      { name: 'Seus favoritos', subtitle: `${state.favorites.length} curtidas` },
      { name: 'Recém ouvidas', subtitle: `${Math.min(state.history.length, 8)} recentes` },
      { name: 'Downloads', subtitle: `${sortOfflineFirst(state.tracks.filter(isOfflineTrack)).length} salvas` }
    ];
    mixSeeds.forEach((mix, idx) => {
      const card = document.createElement('div');
      card.className = 'card home-mix-card';
      const gradient = ['linear-gradient(135deg, rgba(41,217,255,0.72), rgba(99,102,241,0.72))', 'linear-gradient(135deg, rgba(255,62,201,0.72), rgba(124,58,237,0.72))', 'linear-gradient(135deg, rgba(34,197,94,0.72), rgba(59,130,246,0.72))', 'linear-gradient(135deg, rgba(251,146,60,0.72), rgba(236,72,153,0.72))'][idx % 4];
      card.innerHTML = `
        <div class="home-mix-cover" style="background:${gradient};"></div>
        <div class="card-title">${escapeHtml(mix.name)}</div>
        <div class="card-sub">${escapeHtml(mix.subtitle)}</div>
      `;
      card.onclick = () => {
        if (idx === 0) { state.view = 'library'; setActiveNav('library'); render(); }
        else if (idx === 1) { state.view = 'library'; setActiveNav('library'); render(); }
        else if (idx === 2) { state.view = 'home'; render(); }
        else { state.view = 'home'; render(); }
      };
      quickMixes.appendChild(card);
    });
    el.viewRoot.appendChild(quickMixes);

    const downloads = sortOfflineFirst(state.tracks.filter(isOfflineTrack));
    if (downloads.length) {
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = 'Baixadas recentemente';
      el.viewRoot.appendChild(title);
      const table = document.createElement('div');
      table.className = 'track-table';
      downloads.forEach((t, i) => table.appendChild(trackRow(t, i + 1, downloads)));
      el.viewRoot.appendChild(table);
    }

    if (state.history.length) {
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = 'Tocadas recentemente';
      el.viewRoot.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'track-table';
      const seen = new Set();
      state.history.forEach(h => {
        if (!h || !h.track || seen.has(h.track.id)) return;
        seen.add(h.track.id);
        grid.appendChild(trackRow(h.track, seen.size));
      });
      el.viewRoot.appendChild(grid);
    }

    if (state.favorites.length) {
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = 'Favoritas';
      el.viewRoot.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'track-table';
      state.favorites.forEach((t, i) => grid.appendChild(trackRow(t, i + 1)));
      el.viewRoot.appendChild(grid);
    }

    const albumsTitle = document.createElement('div');
    albumsTitle.className = 'section-title';
    albumsTitle.textContent = 'Álbuns e coleções';
    el.viewRoot.appendChild(albumsTitle);
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    state.albums.slice(0, 24).forEach(a => grid.appendChild(albumCard(a)));
    el.viewRoot.appendChild(grid);
  }

  function renderLibrary() {
    el.viewRoot.innerHTML = '';
    if (state.tracks.length === 0) { el.viewRoot.appendChild(emptyState()); return; }
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Sua Biblioteca';
    el.viewRoot.appendChild(title);
    const table = document.createElement('div');
    table.className = 'track-table';
    state.tracks.forEach((t, i) => table.appendChild(trackRow(t, i + 1)));
    el.viewRoot.appendChild(table);
  }

  function renderSearch() {
    el.viewRoot.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Buscar';
    el.viewRoot.appendChild(title);
    const hint = document.createElement('div');
    hint.style.color = 'var(--text-dim)';
    hint.style.fontSize = '13px';
    hint.textContent = 'Digite no campo acima para buscar por título, artista ou álbum.';
    el.viewRoot.appendChild(hint);
  }

  // ---------------- Online (busca no YouTube, streaming sem baixar) ----------------
  function renderOnline() {
    el.viewRoot.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Buscar Online';
    el.viewRoot.appendChild(title);

    const hint = document.createElement('div');
    hint.className = 'online-hint';
    hint.textContent = 'Pesquise músicas na internet e ouça direto pelo player do YouTube — nada é baixado para o computador. O modo offline (Sua Biblioteca) continua tocando só os arquivos que já estão salvos no dispositivo.';
    el.viewRoot.appendChild(hint);

    const searchBox = document.createElement('div');
    searchBox.className = 'online-search-box';
    searchBox.innerHTML = `
      <input id="online-search-input" type="text" placeholder="Buscar música, artista..." />
      <button id="online-search-btn" class="btn-primary">Buscar</button>
    `;
    el.viewRoot.appendChild(searchBox);

    const results = document.createElement('div');
    results.id = 'online-results';
    results.className = 'yt-grid';
    el.viewRoot.appendChild(results);

    const input = searchBox.querySelector('#online-search-input');
    const btn = searchBox.querySelector('#online-search-btn');

    async function doSearch() {
      const q = input.value.trim();
      if (!q) return;
      results.innerHTML = '<div class="online-status">Buscando (pode levar alguns segundos)...</div>';
      const data = await api.get('/api/youtube/search?q=' + encodeURIComponent(q));
      if (data && data.error) {
        results.innerHTML = `<div class="online-status online-error">${escapeHtml(data.message || 'Não foi possível buscar.')}</div>`;
        return;
      }
      if (!data || !data.length) {
        results.innerHTML = '<div class="online-status">Nenhum resultado encontrado.</div>';
        return;
      }
      results.innerHTML = '';
      data.forEach(item => results.appendChild(ytCard(item)));
    }

    btn.onclick = doSearch;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  }

  function ytCard(item) {
    const card = document.createElement('div');
    card.className = 'yt-card';
    card.innerHTML = `
      <img class="yt-thumb" src="${item.thumbnail}" alt="" />
      <div class="yt-thumb-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      ${item.duration ? `<div class="yt-duration">${escapeHtml(item.duration)}</div>` : ''}
      <div class="yt-title">${escapeHtml(item.title)}</div>
      <div class="yt-channel">${escapeHtml(item.channel)}</div>
    `;
    card.onclick = () => openYoutubePlayer(item);
    return card;
  }

  async function downloadYoutubeTrack(item) {
    const btn = document.getElementById('yt-modal-download');
    if (!btn) return;
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Baixando...';
    try {
      const res = await api.post('/api/youtube/download', {
        videoId: item.videoId,
        title: item.title,
        channel: item.channel
      });
      if (res && res.error) throw new Error(res.message || 'Erro ao baixar a música.');
      if (state.view === 'online') renderOnline();
      if (state.view === 'library' || state.view === 'playlist') render();
      el.modalRoot.innerHTML = '';
    } catch (e) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }

  function openYoutubePlayer(item) {
    el.modalRoot.innerHTML = `
      <div class="modal-overlay" id="yt-modal-overlay">
        <div class="modal-box yt-modal-box">
          <h2>${escapeHtml(item.title)}</h2>
          <div class="yt-player-wrap">
            <iframe src="https://www.youtube.com/embed/${item.videoId}?autoplay=1"
              frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
          </div>
          <div class="modal-actions">
            <button class="btn-primary" id="yt-modal-download">Baixar offline</button>
            <button class="btn-secondary" id="yt-modal-close">Fechar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('yt-modal-download').onclick = () => downloadYoutubeTrack(item);
    document.getElementById('yt-modal-close').onclick = () => el.modalRoot.innerHTML = '';
    document.getElementById('yt-modal-overlay').onclick = (e) => {
      if (e.target.id === 'yt-modal-overlay') el.modalRoot.innerHTML = '';
    };
  }

  function normalizePlaylistSortMode(mode) {
    return mode === 'alphabetic' || mode === 'newest' || mode === 'manual' ? mode : 'manual';
  }

  function sortPlaylistTracks(tracks, mode) {
    const list = [...(tracks || [])];
    const safeMode = normalizePlaylistSortMode(mode);
    if (safeMode === 'alphabetic') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || '') || (a.artist || '').localeCompare(b.artist || ''));
    }
    if (safeMode === 'newest') {
      return list.sort((a, b) => (b.addedAt || b.createdAt || 0) - (a.addedAt || a.createdAt || 0));
    }
    return list;
  }

  async function applyPlaylistSortMode(playlistId, mode) {
    const playlist = state.playlists.find(pl => pl.id === playlistId);
    const fallback = await api.get(`/api/playlists/${playlistId}`);
    const base = playlist && Array.isArray(playlist.tracks) ? playlist.tracks : fallback.tracks || [];
    const nextOrder = sortPlaylistTracks(base, mode).map(t => t.id);
    const updated = await api.put(`/api/playlists/${playlistId}`, { trackIds: nextOrder, sortMode: mode });
    if (!updated || updated.error) return;
    state.playlists = await api.get('/api/playlists');
    state.view = 'playlist';
    state.currentPlaylistId = playlistId;
    render();
  }

  async function reorderPlaylistTrack(playlistId, fromTrackId, toTrackId) {
    const playlist = state.playlists.find(pl => pl.id === playlistId);
    const fromList = Array.isArray(playlist && playlist.tracks) ? playlist.tracks : [];
    const currentOrder = fromList.length ? fromList.map(t => t.id) : (await api.get(`/api/playlists/${playlistId}`)).tracks.map(t => t.id);
    const fromIndex = currentOrder.indexOf(fromTrackId);
    const toIndex = currentOrder.indexOf(toTrackId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    const updated = await api.put(`/api/playlists/${playlistId}`, { trackIds: nextOrder, sortMode: 'manual' });
    if (!updated || updated.error) return;
    state.playlists = await api.get('/api/playlists');
    render();
  }

  async function renderPlaylist() {
    el.viewRoot.innerHTML = '';
    const pl = await api.get(`/api/playlists/${state.currentPlaylistId}`);
    pl.tracks = Array.isArray(pl.tracks) ? pl.tracks : [];
    pl.sortMode = normalizePlaylistSortMode(pl.sortMode || 'manual');
    const currentPlaylist = state.playlists.find(item => item.id === pl.id);
    if (currentPlaylist) {
      currentPlaylist.sortMode = pl.sortMode;
      currentPlaylist.trackIds = Array.isArray(pl.trackIds) ? pl.trackIds : pl.tracks.map(t => t.id);
      currentPlaylist.tracks = pl.tracks;
    }
    const displayTracks = sortPlaylistTracks(pl.tracks, pl.sortMode);
    const coverUrl = playlistCoverUrl({ ...pl, tracks: displayTracks });

    const hero = document.createElement('div');
    hero.className = 'playlist-hero';
    hero.innerHTML = `
      <div class="playlist-cover-wrap">
        <img class="playlist-cover" src="${coverUrl}" alt="" />
        <button type="button" class="playlist-cover-btn" id="playlist-cover-btn">Alterar capa</button>
      </div>
      <div class="playlist-hero-meta">
        <span class="playlist-badge">Playlist</span>
        <h2>${escapeHtml(pl.name)}</h2>
        <div class="playlist-stats">${displayTracks.length} música${displayTracks.length === 1 ? '' : 's'}</div>
      </div>
    `;
    el.viewRoot.appendChild(hero);

    const actions = document.createElement('div');
    actions.className = 'playlist-actions';
    actions.innerHTML = `
      <button class="btn-primary" id="pl-play-all">▶ Tocar tudo</button>
      <button class="btn-secondary" id="playlist-delete-btn">Excluir</button>
      <button class="btn-secondary" id="playlist-search-btn" type="button">Procurar música</button>
      <div class="playlist-sort-controls" aria-label="Ordenar playlist">
        <button type="button" class="playlist-sort-btn ${pl.sortMode === 'alphabetic' ? 'active' : ''}" data-mode="alphabetic" title="Ordenar por nome">A–Z</button>
        <button type="button" class="playlist-sort-btn ${pl.sortMode === 'newest' ? 'active' : ''}" data-mode="newest" title="Mais recentes">⏱</button>
        <button type="button" class="playlist-sort-btn ${pl.sortMode === 'manual' ? 'active' : ''}" data-mode="manual" title="Manual">▦</button>
      </div>
    `;
    el.viewRoot.appendChild(actions);

    const playAllBtn = document.getElementById('pl-play-all');
    if (playAllBtn) playAllBtn.onclick = () => playQueue(displayTracks, 0);

    const deleteBtn = document.getElementById('playlist-delete-btn');
    if (deleteBtn) deleteBtn.onclick = () => confirmDeletePlaylist(pl);

    const searchBtn = document.getElementById('playlist-search-btn');
    if (searchBtn) {
      searchBtn.onclick = () => {
        state.view = 'online';
        state.currentPlaylistId = null;
        setActiveNav('online');
        render();
      };
    }

    document.querySelectorAll('.playlist-sort-btn').forEach(btn => {
      btn.onclick = () => applyPlaylistSortMode(pl.id, btn.dataset.mode);
    });

    const coverBtn = document.getElementById('playlist-cover-btn');
    if (coverBtn) {
      coverBtn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            localStorage.setItem(`nightwave.playlist.cover.${pl.id}`, String(reader.result));
            render();
            refreshStateAndRender();
          };
          reader.readAsDataURL(file);
        };
        input.click();
      };
    }

    if (!displayTracks.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<h3>Playlist vazia</h3><p>Adicione músicas pela biblioteca.</p>`;
      el.viewRoot.appendChild(empty);
      return;
    }

    const table = document.createElement('div');
    table.className = 'track-table';
    displayTracks.forEach((t, i) => {
      const row = trackRow(t, i + 1, displayTracks);
      table.appendChild(row);
    });
    el.viewRoot.appendChild(table);
  }

  function emptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <h3>Sua biblioteca está vazia</h3>
      <p>Configure uma pasta de músicas do seu computador e escaneie para começar.</p>
      <button id="empty-config-btn">Configurar pasta de músicas</button>
    `;
    div.querySelector('#empty-config-btn').onclick = openSettingsModal;
    return div;
  }

  async function addTrackToPlaylist(track, playlistId) {
    await api.post(`/api/playlists/${playlistId}/tracks`, { trackId: track.id });
    el.modalRoot.innerHTML = '';
    await refreshStateAndRender();
  }

  function openPlaylistPicker(track) {
    const playlists = state.playlists || [];

    el.modalRoot.innerHTML = `
      <div class="modal-overlay" id="playlist-picker-overlay">
        <div class="modal-box">
          <h2>Adicionar à playlist</h2>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;margin-bottom:14px;">
            ${playlists.length ? playlists.map(pl => `
              <button class="playlist-choice-btn" data-playlist-id="${pl.id}" style="border:1px solid var(--border);background:var(--bg-card);color:var(--text);padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;">${escapeHtml(pl.name)}</button>
            `).join('') : '<div style="color:var(--text-dim);font-size:13px;">Nenhuma playlist criada ainda.</div>'}
          </div>

          <div id="playlist-new-box" style="display:none; margin-bottom:12px;">
            <label for="playlist-new-name" style="display:block; margin-bottom:6px; font-size:12px; color:var(--text-dim);">Nome da nova playlist</label>
            <input id="playlist-new-name" type="text" placeholder="Minha playlist" style="width:100%; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-bottom:8px;" />
            <div class="modal-actions">
              <button class="btn-secondary" id="playlist-new-cancel">Cancelar</button>
              <button class="btn-primary" id="playlist-create">Criar playlist</button>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" id="playlist-picker-close">Fechar</button>
            <button class="btn-primary" id="playlist-picker-new">Nova playlist</button>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('playlist-picker-overlay');
    const closeBtn = document.getElementById('playlist-picker-close');
    const newBtn = document.getElementById('playlist-picker-new');
    const newBox = document.getElementById('playlist-new-box');
    const newNameInput = document.getElementById('playlist-new-name');
    const cancelBtn = document.getElementById('playlist-new-cancel');
    const createBtn = document.getElementById('playlist-create');

    if (closeBtn) closeBtn.onclick = () => { el.modalRoot.innerHTML = ''; };
    if (overlay) overlay.onclick = (e) => { if (e.target.id === 'playlist-picker-overlay') el.modalRoot.innerHTML = ''; };

    const choiceButtons = document.querySelectorAll('.playlist-choice-btn');
    choiceButtons.forEach(btn => {
      btn.onclick = async () => {
        const playlistId = btn.getAttribute('data-playlist-id');
        if (!playlistId) return;
        await addTrackToPlaylist(track, playlistId);
      };
    });

    if (newBtn) newBtn.onclick = () => {
      openCreatePlaylistModal(async (pl) => {
        await addTrackToPlaylist(track, pl.id);
      });
    };

    if (cancelBtn) cancelBtn.onclick = () => { if (newBox) newBox.style.display = 'none'; };
    if (createBtn) createBtn.onclick = async () => {
      const cleanName = (newNameInput ? newNameInput.value.trim() : '');
      if (!cleanName) return;

      let pl = state.playlists.find(p => p && p.name && p.name.toLowerCase() === cleanName.toLowerCase());
      if (!pl) {
        pl = await api.post('/api/playlists', { name: cleanName });
      }
      await refreshStateAndRender();
      if (state.view === 'playlists') renderPlaylistsPage();
      await addTrackToPlaylist(track, pl.id);
    };
  }

  function trackMenuIcon(type) {
    const icons = {
      up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 11l6-6 6 6"/></svg>',
      down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 13l6 6 6-6"/></svg>',
      playlist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12M6 9h12M6 14h8M18 17v-6M15 14h6"/></svg>',
      cover: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9zM8 13l2.5-3 2.5 3 2.5-3 3 4"/></svg>',
      delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 12h8l1-12"/></svg>'
    };
    return icons[type] || '';
  }

  function trackRow(track, idx, contextList) {
    const row = document.createElement('div');
    row.className = 'track-row' + (state.queue[state.queueIndex]?.id === track.id ? ' playing' : '');
    row.dataset.trackId = track.id;
    const isFav = state.favorites.some(f => f.id === track.id);
    const playlistMeta = state.view === 'playlist' ? state.playlists.find(pl => pl.id === state.currentPlaylistId) : null;
    const isManualPlaylistOrder = state.view === 'playlist' && playlistMeta && (playlistMeta.sortMode || 'manual') === 'manual';

    row.innerHTML = `
      <div class="t-title-wrap">
        <img class="t-cover" src="${trackCoverUrl(track)}" alt="" aria-label="${escapeHtml(track.title)}" onerror="this.onerror=null;this.src='${makeFallbackCover(track)}';" />
        <div class="t-title-text">
          <div class="t-title">${escapeHtml(track.title)}</div>
          <div class="t-artist">${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</div>
        </div>
      </div>
      <div class="t-dur">${fmtTime(track.duration)}</div>
      <div class="track-menu-wrap">
        <button class="t-fav icon-btn${isFav ? ' active' : ''}" title="Favoritar">
          <svg viewBox="0 0 24 24"><path d="M12 21s-6.7-4.35-9.3-8.14C1 10.3 1.5 6.9 4.3 5.3 6.6 4 9.3 4.7 11 6.6c.4.4.7.8 1 1.2.3-.4.6-.8 1-1.2 1.7-1.9 4.4-2.6 6.7-1.3 2.8 1.6 3.3 5 1.6 7.56C18.7 16.65 12 21 12 21z"/></svg>
        </button>
        ${isManualPlaylistOrder ? '<button class="playlist-drag-handle" type="button" title="Arrastar para reordenar"><svg viewBox="0 0 24 24"><path d="M9 7h.01M9 12h.01M9 17h.01M15 7h.01M15 12h.01M15 17h.01"/></svg></button>' : ''}
        <div class="track-menu">
          <button class="track-menu-btn" title="Mais opções" aria-label="Mais opções">⋮</button>
          <div class="track-menu-popover">
            <button type="button" data-action="up">${trackMenuIcon('up')}<span>Mover para cima</span></button>
            <button type="button" data-action="down">${trackMenuIcon('down')}<span>Mover para baixo</span></button>
            <button type="button" data-action="playlist">${trackMenuIcon('playlist')}<span>Adicionar à playlist</span></button>
            <button type="button" data-action="cover">${trackMenuIcon('cover')}<span>Alterar capa</span></button>
            <button type="button" data-action="delete">${trackMenuIcon('delete')}<span>Excluir</span></button>
          </div>
        </div>
      </div>
    `;

    if (isManualPlaylistOrder) {
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', (e) => {
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', track.id);
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = row.dataset.trackId;
        if (!draggedId || !targetId || draggedId === targetId) return;
        await reorderPlaylistTrack(state.currentPlaylistId, draggedId, targetId);
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
    }

    const titleEl = row.querySelector('.t-title');
    const artistEl = row.querySelector('.t-artist');
    const clickHandler = () => {
      const list = contextList || state.tracks;
      const i = list.findIndex(t => t.id === track.id);
      playQueue(list, i >= 0 ? i : 0);
    };
    if (titleEl) titleEl.onclick = clickHandler;
    if (artistEl) artistEl.onclick = clickHandler;

    const favBtn = row.querySelector('.t-fav');
    if (favBtn) favBtn.onclick = async (e) => {
      e.stopPropagation();
      if (isFav) { await api.del(`/api/tracks/${track.id}/favorite`); }
      else { await api.post(`/api/tracks/${track.id}/favorite`); }
      await refreshStateAndRender();
    };

    const menuBtn = row.querySelector('.track-menu-btn');
    const popover = row.querySelector('.track-menu-popover');
    if (menuBtn && popover) menuBtn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.track-menu-popover').forEach(el => {
        if (el !== popover) el.classList.remove('open');
      });
      popover.classList.toggle('open');
    };

    if (popover) {
      const upBtn = popover.querySelector('[data-action="up"]');
      const downBtn = popover.querySelector('[data-action="down"]');
      const playlistBtn = popover.querySelector('[data-action="playlist"]');
      const coverBtn = popover.querySelector('[data-action="cover"]');
      const deleteBtn = popover.querySelector('[data-action="delete"]');

      if (upBtn) upBtn.onclick = async (e) => {
        e.stopPropagation();
        const playlistMeta = state.view === 'playlist' ? state.playlists.find(pl => pl.id === state.currentPlaylistId) : null;
        if (state.view === 'playlist' && playlistMeta && Array.isArray(contextList)) {
          const index = contextList.findIndex(t => t.id === track.id);
          const target = index > 0 ? contextList[index - 1] : null;
          if (target) {
            await reorderPlaylistTrack(state.currentPlaylistId, track.id, target.id);
            await refreshStateAndRender();
          }
          return;
        }
        moveTrackInState(track.id, -1);
        await refreshStateAndRender();
      };
      if (downBtn) downBtn.onclick = async (e) => {
        e.stopPropagation();
        const playlistMeta = state.view === 'playlist' ? state.playlists.find(pl => pl.id === state.currentPlaylistId) : null;
        if (state.view === 'playlist' && playlistMeta && Array.isArray(contextList)) {
          const index = contextList.findIndex(t => t.id === track.id);
          const target = index >= 0 && index < contextList.length - 1 ? contextList[index + 1] : null;
          if (target) {
            await reorderPlaylistTrack(state.currentPlaylistId, track.id, target.id);
            await refreshStateAndRender();
          }
          return;
        }
        moveTrackInState(track.id, 1);
        await refreshStateAndRender();
      };
      if (playlistBtn) playlistBtn.onclick = async (e) => {
        e.stopPropagation();
        openPlaylistPicker(track);
        popover.classList.remove('open');
      };
      if (coverBtn) coverBtn.onclick = (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            localStorage.setItem(`nightwave.cover.${track.id}`, String(reader.result));
            render();
            if (state.queue[state.queueIndex]?.id === track.id) {
              updateNowPlayingUI(track);
            }
          };
          reader.readAsDataURL(file);
        };
        input.click();
        popover.classList.remove('open');
      };
      if (deleteBtn) deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        await api.del(`/api/tracks/${track.id}`);
        popover.classList.remove('open');
        await refreshStateAndRender();
      };
    }

    if (popover) {
      document.addEventListener('click', () => popover.classList.remove('open'), { once: true });
    }
    return row;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------- Player ----------------
  function playQueue(list, index) {
    state.queue = list;
    state.queueIndex = index;
    playCurrent();
  }

  function playCurrent() {
    const track = state.queue[state.queueIndex];
    if (!track) return;
    el.audio.src = `/api/tracks/${track.id}/stream`;
    el.audio.play();
    updateNowPlayingUI(track);
    render();
  }

  function updateNowPlayingUI(track) {
    el.nowTitle.textContent = track.title;
    el.nowArtist.textContent = track.artist;
    el.nowCover.src = trackCoverUrl(track);
    el.nowCover.onerror = () => { el.nowCover.style.background = 'linear-gradient(135deg,#1c1f2b,#14151b)'; };
    const isFav = state.favorites.some(f => f.id === track.id);
    el.nowFav.classList.toggle('active', isFav);
  }

  el.btnPlay.onclick = () => {
    if (!state.queue[state.queueIndex]) {
      if (state.tracks.length) playQueue(state.tracks, 0);
      return;
    }
    if (el.audio.paused) el.audio.play(); else el.audio.pause();
  };

  el.audio.addEventListener('play', () => { el.iconPlay.style.display = 'none'; el.iconPause.style.display = ''; });
  el.audio.addEventListener('pause', () => { el.iconPlay.style.display = ''; el.iconPause.style.display = 'none'; });

  el.btnNext.onclick = () => nextTrack();
  el.btnPrev.onclick = () => {
    if (el.audio.currentTime > 3) { el.audio.currentTime = 0; return; }
    prevTrack();
  };

  function nextTrack() {
    if (!state.queue.length) return;
    if (state.repeat === 'one') { playCurrent(); return; }
    let next;
    if (state.shuffle) {
      next = Math.floor(Math.random() * state.queue.length);
    } else {
      next = state.queueIndex + 1;
      if (next >= state.queue.length) {
        if (state.repeat === 'all') next = 0; else return;
      }
    }
    state.queueIndex = next;
    playCurrent();
  }

  function prevTrack() {
    if (!state.queue.length) return;
    let prev = state.queueIndex - 1;
    if (prev < 0) prev = state.repeat === 'all' ? state.queue.length - 1 : 0;
    state.queueIndex = prev;
    playCurrent();
  }

  el.audio.addEventListener('ended', nextTrack);

  el.btnShuffle.onclick = () => { state.shuffle = !state.shuffle; el.btnShuffle.classList.toggle('active', state.shuffle); };
  el.btnRepeat.onclick = () => {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    el.btnRepeat.classList.toggle('active', state.repeat !== 'off');
    el.btnRepeat.title = state.repeat === 'one' ? 'Repetir música' : state.repeat === 'all' ? 'Repetir tudo' : 'Repetir';
  };

  el.audio.addEventListener('timeupdate', () => {
    if (!isFinite(el.audio.duration)) return;
    el.seek.value = (el.audio.currentTime / el.audio.duration) * 100;
    el.timeCurrent.textContent = fmtTime(el.audio.currentTime);
    el.timeTotal.textContent = fmtTime(el.audio.duration);
  });
  el.seek.addEventListener('input', () => {
    if (!isFinite(el.audio.duration)) return;
    el.audio.currentTime = (el.seek.value / 100) * el.audio.duration;
  });
  el.volume.addEventListener('input', () => { el.audio.volume = el.volume.value / 100; });
  el.audio.volume = 0.8;

  el.nowFav.onclick = async () => {
    const track = state.queue[state.queueIndex];
    if (!track) return;
    const isFav = state.favorites.some(f => f.id === track.id);
    if (isFav) await api.del(`/api/tracks/${track.id}/favorite`); else await api.post(`/api/tracks/${track.id}/favorite`);
    state.favorites = await api.get('/api/favorites');
    updateNowPlayingUI(track);
  };

  // ---------------- Search ----------------
  let searchDebounce;
  el.search.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      const q = el.search.value.trim();
      if (!q) { if (state.view === 'search') renderSearch(); return; }
      state.view = 'search';
      state.currentPlaylistId = null;
      setActiveNav('search');
      renderSidebarPlaylists();
      const results = await api.get('/api/tracks?q=' + encodeURIComponent(q));
      el.viewRoot.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = `Resultados para "${q}"`;
      el.viewRoot.appendChild(title);
      if (!results.length) {
        const p = document.createElement('div');
        p.style.color = 'var(--text-dim)';
        p.textContent = 'Nenhuma música encontrada.';
        el.viewRoot.appendChild(p);
        return;
      }
      const table = document.createElement('div');
      table.className = 'track-table';
      results.forEach((t, i) => table.appendChild(trackRow(t, i + 1, results)));
      el.viewRoot.appendChild(table);
    }, 250);
  });

  // ---------------- Settings modal (pastas + escaneamento) ----------------
  function openSettingsModal() {
    const cfg = readThemeConfig();
    el.modalRoot.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box settings-modal-box">
          <h2>Configurações</h2>

          <div class="settings-tabs">
            <button type="button" class="settings-tab active" data-settings-tab="theme">Temas</button>
            <button type="button" class="settings-tab" data-settings-tab="background">Fundo</button>
            <button type="button" class="settings-tab" data-settings-tab="library">Biblioteca</button>
            <button type="button" class="settings-tab" data-settings-tab="system">Sistema</button>
          </div>

          <div class="settings-panels">
            <div class="settings-panel active" data-settings-panel="theme">
              <div class="settings-group">
                <h3>Temas</h3>
                <div class="theme-presets">
                  ${Object.entries(THEME_PRESETS).map(([key, preset]) => `
                    <button type="button" class="theme-option ${cfg.theme === key ? 'selected' : ''}" data-theme="${key}" style="background:linear-gradient(135deg, ${preset.accent}, ${preset.secondary});">
                      ${preset.name}
                    </button>
                  `).join('')}
                </div>
                <div class="theme-custom-row">
                  <label>
                    Cor principal
                    <input id="theme-accent" type="color" value="${cfg.accent || THEME_PRESETS.neon.accent}" />
                  </label>
                  <label>
                    Cor secundária
                    <input id="theme-secondary" type="color" value="${cfg.secondary || THEME_PRESETS.neon.secondary}" />
                  </label>
                </div>
              </div>
            </div>

            <div class="settings-panel" data-settings-panel="background">
              <div class="settings-group">
                <h3>Fundo do app</h3>
                <div class="theme-custom-row">
                  <label>
                    Tipo de fundo
                    <select id="theme-bg-mode">
                      <option value="none" ${cfg.backgroundMode === 'none' ? 'selected' : ''}>Sem fundo</option>
                      <option value="image" ${cfg.backgroundMode === 'image' ? 'selected' : ''}>Imagem</option>
                      <option value="video" ${cfg.backgroundMode === 'video' ? 'selected' : ''}>Vídeo</option>
                    </select>
                  </label>
                  <label>
                    Cor de fundo
                    <input id="theme-bg-color" type="color" value="${cfg.bg || THEME_PRESETS.neon.bg}" />
                  </label>
                </div>
                <div class="theme-custom-row">
                  <label>
                    Estilo do vidro
                    <select id="theme-overlay-mode">
                      <option value="blurred" ${cfg.overlayMode === 'blurred' ? 'selected' : ''}>Borrado</option>
                      <option value="soft" ${cfg.overlayMode === 'soft' ? 'selected' : ''}>Fosco</option>
                      <option value="clear" ${cfg.overlayMode === 'clear' ? 'selected' : ''}>Nítido</option>
                    </select>
                  </label>
                </div>
                <input id="theme-bg-upload" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv" />
                <div class="helper-text">Use fotos ou vídeos locais para personalizar o visual do app (PNG, JPG, WEBP, SVG, MP4, WEBM, MOV, AVI, MKV etc.).</div>
              </div>
            </div>

            <div class="settings-panel" data-settings-panel="library">
              <div class="settings-group">
                <h3>Biblioteca</h3>
                <label>Adicionar caminho de pasta no computador (ex: C:\\Musicas ou /home/usuario/Musica)</label>
                <input type="text" id="folder-input" placeholder="Caminho completo da pasta" />
                <div id="folder-chips"></div>
                <div class="modal-actions" style="margin-top:12px;">
                  <button class="btn-primary" id="folder-add">Adicionar pasta</button>
                </div>
                <div class="progress-bar"><div class="progress-bar-fill" id="scan-progress-fill"></div></div>
                <div id="scan-status" style="font-size:12px;color:var(--text-dim);margin-top:8px;"></div>
              </div>
            </div>

            <div class="settings-panel" data-settings-panel="system">
              <div class="settings-group">
                <h3>Sistema</h3>
                <div class="helper-text">Ajustes de identidade do app, navegação e uso geral.</div>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
                  <button class="btn-secondary" id="scan-now-system">Escanear biblioteca</button>
                  <button class="btn-secondary" id="clear-history-system">Limpar histórico</button>
                  <button class="btn-secondary" id="reset-theme-system">Resetar tema</button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-actions settings-footer">
            <button class="btn-secondary" id="theme-cancel">Cancelar</button>
            <button class="btn-primary" id="theme-save">Salvar</button>
          </div>
        </div>
      </div>
    `;

    renderFolderChips();
    const accentInput = document.getElementById('theme-accent');
    const secondaryInput = document.getElementById('theme-secondary');
    const bgModeSelect = document.getElementById('theme-bg-mode');
    const bgColorInput = document.getElementById('theme-bg-color');
    const overlayModeSelect = document.getElementById('theme-overlay-mode');
    const uploadInput = document.getElementById('theme-bg-upload');
    let currentThemeKey = cfg.theme || 'neon';

    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.settings-tab').forEach(btn => btn.classList.toggle('active', btn === tab));
        document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.settingsPanel === tab.dataset.settingsTab));
      };
    });

    document.querySelectorAll('.theme-option').forEach((btn) => {
      btn.onclick = () => {
        const themeKey = btn.dataset.theme;
        const preset = THEME_PRESETS[themeKey];
        if (!preset) return;
        currentThemeKey = themeKey;
        document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('selected', b.dataset.theme === themeKey));
        accentInput.value = preset.accent;
        secondaryInput.value = preset.secondary;
        bgColorInput.value = preset.bg;
        saveThemeConfig({ theme: themeKey, accent: preset.accent, secondary: preset.secondary, bg: preset.bg, bgCard: preset.bgCard, sidebarBg: preset.sidebarBg, text: preset.text });
      };
    });

    accentInput.oninput = () => {
      saveThemeConfig({ theme: currentThemeKey, accent: accentInput.value, secondary: secondaryInput.value, bg: bgColorInput.value });
    };
    secondaryInput.oninput = () => {
      saveThemeConfig({ theme: currentThemeKey, accent: accentInput.value, secondary: secondaryInput.value, bg: bgColorInput.value });
    };
    bgColorInput.oninput = () => {
      saveThemeConfig({ theme: currentThemeKey, accent: accentInput.value, secondary: secondaryInput.value, bg: bgColorInput.value });
    };

    bgModeSelect.onchange = () => {
      const bgMode = bgModeSelect.value;
      if (bgMode === 'none') {
        saveThemeConfig({ backgroundMode: 'none', backgroundImage: '', backgroundVideo: '' });
        return;
      }
      saveThemeConfig({ backgroundMode: bgMode, overlayMode: overlayModeSelect.value || 'frosted' });
    };

    overlayModeSelect.onchange = () => {
      saveThemeConfig({ overlayMode: overlayModeSelect.value || 'frosted' });
    };

    uploadInput.onchange = () => {
      const file = uploadInput.files && uploadInput.files[0];
      if (!file) return;

      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v|wmv)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
      if (!isVideo && !isImage) return;

      const reader = new FileReader();
      reader.onload = () => {
        const next = {
          ...readThemeConfig(),
          backgroundMode: isVideo ? 'video' : 'image',
          backgroundVideo: isVideo ? String(reader.result) : '',
          backgroundImage: isVideo ? '' : String(reader.result)
        };
        applyThemeConfig(next);
        localStorage.setItem('nightwave-theme-config', JSON.stringify(next));
        if (bgModeSelect) bgModeSelect.value = next.backgroundMode || 'none';
      };
      reader.readAsDataURL(file);
    };

    document.getElementById('theme-save').onclick = () => {
      const next = {
        ...readThemeConfig(),
        theme: currentThemeKey,
        accent: accentInput.value,
        secondary: secondaryInput.value,
        bg: bgColorInput.value,
        backgroundMode: bgModeSelect.value,
        overlayMode: overlayModeSelect.value || 'frosted',
        backgroundImage: readThemeConfig().backgroundImage || '',
        backgroundVideo: readThemeConfig().backgroundVideo || ''
      };
      applyThemeConfig(next);
      el.modalRoot.innerHTML = '';
    };

    document.getElementById('theme-cancel').onclick = () => el.modalRoot.innerHTML = '';
    document.getElementById('modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') el.modalRoot.innerHTML = ''; };
    document.getElementById('folder-add').onclick = async () => {
      const input = document.getElementById('folder-input');
      const val = input.value.trim();
      if (!val) return;
      const res = await api.post('/api/config/folders', { folder: val });
      if (res.error) { return; }
      input.value = '';
      renderFolderChips(res.musicFolders);
    };

    document.getElementById('scan-now-system').onclick = async () => {
      const result = await api.post('/api/scan');
      if (!result.error) await loadAll();
    };

    document.getElementById('clear-history-system').onclick = async () => {
      const history = await api.get('/api/history');
      if (!history || !history.length) return;
      const res = await api.del('/api/history');
      if (!res || res.error) return;
      state.history = [];
      render();
    };

    document.getElementById('reset-theme-system').onclick = () => {
      const reset = { ...THEME_PRESETS.neon, backgroundMode: 'none', backgroundImage: '', backgroundVideo: '' };
      applyThemeConfig(reset);
      localStorage.setItem('nightwave-theme-config', JSON.stringify(reset));
      el.modalRoot.innerHTML = '';
    };
  }

  async function renderFolderChips(folders) {
    const list = folders || (await api.get('/api/config')).musicFolders;
    const container = document.getElementById('folder-chips');
    if (!container) return;
    container.innerHTML = '';
    list.forEach(f => {
      const chip = document.createElement('div');
      chip.className = 'folder-chip';
      chip.innerHTML = `<span>${escapeHtml(f)}</span><button>&times;</button>`;
      chip.querySelector('button').onclick = async () => {
        await api.del('/api/config/folders', { folder: f });
        renderFolderChips();
      };
      container.appendChild(chip);
    });
  }

  document.getElementById('btn-settings').onclick = openSettingsModal;

  // ---------------- Scan ----------------
  if (el.scanBtn) {
    el.scanBtn.onclick = async () => {
      el.scanBtn.disabled = true;
      el.scanBtn.textContent = 'Escaneando...';
      const result = await api.post('/api/scan');
      el.scanBtn.disabled = false;
      el.scanBtn.textContent = 'Escanear biblioteca';
      if (result.error) { return; }
      await loadAll();
    };
  }

  async function autoScanLibraryOnStartup() {
    try {
      const config = await api.get('/api/config');
      const folders = Array.isArray(config && config.musicFolders) ? config.musicFolders : [];
      if (!folders.length) return;
      const result = await api.post('/api/scan');
      if (!result || result.error) return;
      await loadAll();
    } catch (e) {
      // ignora falha de autoescaneamento na abertura do app; a biblioteca pode ser escaneada manualmente depois
    }
  }

  // ---------------- Socket.io (progresso em tempo real) ----------------
  const socket = io();
  socket.on('scan:progress', (p) => {
    const fill = document.getElementById('scan-progress-fill');
    const status = document.getElementById('scan-status');
    if (fill) fill.style.width = Math.round((p.processed / Math.max(p.total, 1)) * 100) + '%';
    if (status) status.textContent = `${p.processed}/${p.total} — ${p.file.split(/[\\/]/).pop()}`;
  });
  socket.on('scan:done', () => { loadAll(); });

  // ---------------- Init ----------------
  applyThemeConfig(readThemeConfig());
  loadBranding();
  loadAll();
  autoScanLibraryOnStartup();
})();
