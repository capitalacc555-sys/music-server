const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const config = require('../config');

const tracksRouter = require('./routes/tracks');
const playlistsRouter = require('./routes/playlists');
const libraryRouter = require('./routes/library');
const youtubeRouter = require('./routes/youtube');
const appConfigRouter = require('./routes/appconfig');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(express.json({ limit: '5mb' }));

app.use('/api', tracksRouter);
app.use('/api', playlistsRouter);
app.use('/api', libraryRouter);
app.use('/api', youtubeRouter);
app.use('/api', appConfigRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
});

const HOST = process.env.HOST || config.host || '0.0.0.0';
const PORT = Number(process.env.PORT || config.porta || 3000);

server.listen(PORT, HOST, () => {
  console.log('');
  console.log(`  ♪ ${config.appName || 'NightWave'} rodando!`);
  console.log(`  Acesse em: http://0.0.0.0:${PORT}`);
  console.log(`             http://<IP-da-maquina>:${PORT} (rede local / internet via VPS)`);
  console.log('');
});
