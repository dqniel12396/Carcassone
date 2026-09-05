const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const RoomManager = require('./RoomManager');
const ReplayManager = require('./engine/ReplayManager');
const UserManager = require('./engine/UserManager');
const GeminiAI = require('./engine/GeminiAI');
const BotEngine = require('./engine/BotEngine');
const BotTrainer = require('./engine/BotTrainer');
const DatasetExporter = require('./engine/DatasetExporter');

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

const app = express();
const server = http.createServer(app);
server.on('error', (err) => {
  console.error('⚠️ Server error:', err);
});
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

const PORT = process.env.PORT || 3080;

app.use(cors());
app.use(express.json());

// Strict no-cache headers for all clients (mobile/desktop/tablet)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'client'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

const roomManager = new RoomManager(io);

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  const icoPath = path.join(__dirname, '..', 'client', 'favicon.svg');
  if (fs.existsSync(icoPath)) {
    res.type('image/svg+xml').sendFile(icoPath);
  } else {
    res.status(204).end();
  }
});

// REST API
app.get('/api/rooms', (req, res) => {
  res.json(roomManager.listRooms());
});

app.get('/api/saves', (req, res) => {
  res.json(roomManager.listSavedGames());
});

app.delete('/api/saves/:name', (req, res) => {
  const result = roomManager.deleteGame(req.params.name);
  res.json(result);
});

// Admin Authentication for Tile Editor
const AUTH_FILE = path.join(__dirname, '..', 'data', 'admin_auth.json');
function getAdminAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo admin_auth.json:', e);
  }
  const defaultAuth = {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'admin'
  };
  try {
    const dataDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(defaultAuth, null, 2));
  } catch (e) {}
  return defaultAuth;
}

app.post('/api/editor-auth', (req, res) => {
  const { username, password } = req.body || {};
  const currentAuth = getAdminAuth();
  if (username === currentAuth.username && password === currentAuth.password) {
    return res.json({ success: true, message: 'Autenticado correctamente' });
  }
  return res.status(401).json({ success: false, error: 'Usuario o clave incorrectos' });
});

app.post('/api/editor-change-password', (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};
  const currentAuth = getAdminAuth();
  if (currentPassword !== currentAuth.password) {
    return res.status(401).json({ success: false, error: 'Clave actual incorrecta' });
  }
  const updated = {
    username: newUsername ? newUsername.trim() : currentAuth.username,
    password: newPassword ? newPassword.trim() : currentAuth.password
  };
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(updated, null, 2));
    return res.json({ success: true, message: 'Credenciales actualizadas con éxito' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Replays & Match History API
app.get('/api/replays', (req, res) => {
  res.json(ReplayManager.listReplays());
});

app.get('/api/replays/:id', (req, res) => {
  const replay = ReplayManager.getReplay(req.params.id);
  if (!replay) return res.status(404).json({ error: 'Replay no encontrado' });
  res.json(replay);
});

app.delete('/api/replays/:id', (req, res) => {
  const result = ReplayManager.deleteReplay(req.params.id);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// === Dataset Export Endpoints (for AI Training) ===

// Export a single replay as JSONL training dataset
app.get('/api/replays/:id/dataset', (req, res) => {
  const result = DatasetExporter.exportReplay(req.params.id);
  if (result.error) return res.status(404).json(result);

  const format = req.query.format || 'json';
  if (format === 'jsonl') {
    const lines = result.samples.map(s => JSON.stringify(s)).join('\n');
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="dataset_${req.params.id}.jsonl"`);
    res.send(lines);
  } else {
    res.json(result);
  }
});

// Get global dataset statistics
app.get('/api/dataset/stats', (req, res) => {
  res.json(DatasetExporter.getDatasetStats());
});

// Export ALL replays as a combined JSONL training file
app.get('/api/dataset/export-all', (req, res) => {
  const opts = {
    onlyWinners: req.query.onlyWinners === 'true',
    onlyBots: req.query.onlyBots === 'true',
    minTurns: parseInt(req.query.minTurns || '5', 10)
  };
  const jsonl = DatasetExporter.exportAllToJSONL(opts);
  const lineCount = jsonl.split('\n').filter(Boolean).length;
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="carcassonne_training_dataset.jsonl"');
  res.setHeader('X-Sample-Count', lineCount);
  res.send(jsonl);
});

// Auth API Endpoints
app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName, avatar, color, title } = req.body || {};
  const result = UserManager.register(username, password, { displayName, avatar, color, title });
  if (!result.ok) {
    return res.status(400).json({ ok: false, success: false, error: result.error });
  }
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = UserManager.login(username, password);
  if (!result.ok) {
    return res.status(401).json({ ok: false, success: false, error: result.error });
  }
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.query.token;
  const user = UserManager.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ ok: false, success: false, error: 'Sesión no válida o expirada' });
  }
  res.json({ ok: true, success: true, user });
});

app.post('/api/auth/update-profile', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;
  const user = UserManager.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ ok: false, success: false, error: 'No autorizado' });
  }
  const result = UserManager.updateProfile(user.id, req.body);
  res.json(result);
});

app.post('/api/auth/sync-stats', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;
  const user = UserManager.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ ok: false, success: false, error: 'No autorizado' });
  }
  const { score, isWinner, citiesCompleted, roadsCompleted } = req.body;
  const result = UserManager.recordGameFinished(user.id, { score, isWinner, citiesCompleted, roadsCompleted });
  res.json(result);
});

// Password Reset via One-Time Link
app.get('/api/auth/validate-reset-token', (req, res) => {
  const { token } = req.query;
  const result = UserManager.validateResetToken(token);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  const result = UserManager.resetPasswordWithToken(token, newPassword);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Admin Panel API Endpoints
app.get('/api/admin/users', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.query.token;
  const user = UserManager.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, success: false, error: 'Acceso denegado: Se requiere rango de Administrador' });
  }
  const result = UserManager.getAllUsersForAdmin(user.id);
  res.json(result);
});

app.post('/api/admin/change-password', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;
  const user = UserManager.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, success: false, error: 'Acceso denegado' });
  }
  const { targetUserId, newPassword } = req.body || {};
  const result = UserManager.adminChangePassword(user.id, targetUserId, newPassword);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin/create-reset-link', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;
  const user = UserManager.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, success: false, error: 'Acceso denegado' });
  }
  const { targetUserId, expiryHours } = req.body || {};
  const result = UserManager.adminCreateResetLink(user.id, targetUserId, expiryHours || 24);
  if (!result.ok) return res.status(400).json(result);

  // Build full reset link URL based on incoming host/origin
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3080';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  result.fullLink = `${proto}://${host}/?resetToken=${result.resetToken}`;
  res.json(result);
});

app.post('/api/admin/delete-user', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;
  const user = UserManager.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, success: false, error: 'Acceso denegado' });
  }
  const { targetUserId } = req.body || {};
  const result = UserManager.adminDeleteUser(user.id, targetUserId);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin/claim', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;
  const user = UserManager.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ ok: false, success: false, error: 'Debes iniciar sesión primero para reclamar rango de administrador' });
  }
  const { masterKey } = req.body || {};
  const result = UserManager.claimAdmin(user.id, masterKey);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// Global Lobby Chat in-memory cache (last 60 messages)
const globalLobbyChatHistory = [];

// Global Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  try {
    const statsByPlayer = new Map();

    // 1. Add registered users
    const registeredUsers = UserManager.getAllUsersForLeaderboard();
    registeredUsers.forEach(u => {
      statsByPlayer.set(u.name.trim().toLowerCase(), {
        name: u.name,
        avatar: u.avatar,
        color: u.color,
        isBot: false,
        games: u.games,
        wins: u.wins,
        totalPoints: u.totalPoints,
        highScore: u.highScore
      });
    });

    // 2. Add replays
    const replays = ReplayManager.listReplays(100);
    replays.forEach(r => {
      const fullReplay = ReplayManager.getReplay(r.id);
      if (!fullReplay || !fullReplay.players) return;
      fullReplay.players.forEach(p => {
        if (!p.name) return;
        const key = p.name.trim().toLowerCase();
        if (!statsByPlayer.has(key)) {
          statsByPlayer.set(key, {
            name: p.name.trim(),
            avatar: p.avatar || 'king',
            color: p.color || 'red',
            isBot: !!p.isBot,
            games: 0,
            wins: 0,
            totalPoints: 0,
            highScore: 0
          });
        }
        const st = statsByPlayer.get(key);
        if (!registeredUsers.some(ru => ru.name.toLowerCase() === key)) {
          st.games += 1;
          if (p.isWinner) st.wins += 1;
          st.totalPoints += (p.score || 0);
          st.highScore = Math.max(st.highScore, p.score || 0);
        }
      });
    });

    const leaderboard = Array.from(statsByPlayer.values())
      .map(p => ({
        ...p,
        winRate: p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0,
        avgScore: p.games > 0 ? Math.round(p.totalPoints / p.games) : 0
      }))
      .sort((a, b) => b.wins - a.wins || b.highScore - a.highScore || b.totalPoints - a.totalPoints)
      .slice(0, 20);

    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Gemini AI Match Analysis Endpoint
app.post('/api/ai/analyze-replay/:id', async (req, res) => {
  try {
    const replay = ReplayManager.getReplay(req.params.id);
    if (!replay) return res.status(404).json({ error: 'Partida no encontrada' });

    if (replay.analysis && !req.query.force) {
      return res.json({ success: true, analysis: replay.analysis, cached: true });
    }

    const analysis = await GeminiAI.analyzeMatch(replay);
    ReplayManager.saveReplayAnalysis(replay.id, analysis);
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('⚠️ Error generando análisis con Gemini:', err);
    res.status(500).json({ success: false, error: err.message || 'Error al conectar con la IA' });
  }
});

// AI Configuration Endpoint
app.get('/api/ai/config', (req, res) => {
  const cfg = GeminiAI.loadConfig();
  res.json({
    hasKey: !!cfg.apiKey,
    model: cfg.model || 'gemini-1.5-flash',
    enabled: cfg.enabled !== false,
    botBanterEnabled: cfg.botBanterEnabled !== false
  });
});

app.post('/api/ai/config', (req, res) => {
  const { apiKey, model, enabled, botBanterEnabled } = req.body || {};
  const update = {};
  if (apiKey !== undefined && apiKey.trim()) update.apiKey = apiKey.trim();
  if (model) update.model = model;
  if (enabled !== undefined) update.enabled = !!enabled;
  if (botBanterEnabled !== undefined) update.botBanterEnabled = !!botBanterEnabled;
  const result = GeminiAI.saveConfig(update);
  res.json(result);
});

// Tile point editor API
app.get('/api/tiles', (req, res) => {
  try {
    const tilesPath = path.join(__dirname, 'engine', 'canonical_tiles.json');
    const catalog = JSON.parse(fs.readFileSync(tilesPath, 'utf8'));
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tiles/update-segments', (req, res) => {
  try {
    const { tileId, segments } = req.body;
    if (!tileId || !segments) return res.status(400).json({ error: 'tileId y segments requeridos' });

    const tilesPath = path.join(__dirname, 'engine', 'canonical_tiles.json');
    const catalog = JSON.parse(fs.readFileSync(tilesPath, 'utf8'));

    if (!catalog[tileId]) return res.status(404).json({ error: 'Loseta no encontrada' });

    catalog[tileId].segments = segments;
    fs.writeFileSync(tilesPath, JSON.stringify(catalog, null, 2));

    console.log(`💾 Segmentos actualizados para loseta ${tileId}:`, segments);
    res.json({ success: true, tile: catalog[tileId] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms/create', (req, res) => {
  const { name, hostName, passCode, options } = req.body;
  const room = roomManager.createRoom({ name, hostName, passCode, options });
  res.json(roomManager.serializeRoom(room));
});

app.post('/api/rooms/create_local', (req, res) => {
  const { name, players, options } = req.body;
  const result = roomManager.createLocalGame({ name, players, options });
  res.json(result);
});

// === Auto-Analysis: Generate Gemini narrative when game ends ===
async function triggerAutoAnalysis(io, replayId, roomId) {
  try {
    const replay = ReplayManager.getReplay(replayId);
    if (!replay || replay.analysis) return; // skip if already analyzed

    // Build a compact summary for Gemini
    const players = (replay.players || []).map(p =>
      `${p.name}${p.isBot ? ' (Bot)' : ''}: ${p.score} pts${p.isWinner ? ' 🏆' : ''}`
    ).join(', ');
    const topActions = (replay.actions || [])
      .filter(a => a.type === 'place_tile')
      .slice(0, 5)
      .map(a => `Turno ${a.turn}: ${a.playerName} → (${a.details.x},${a.details.y}) rot ${a.details.rotation}`)
      .join('\n');
    const features = (replay.completedFeaturesSummary || [])
      .slice(0, 8)
      .map(f => `${f.type} +${f.points}pts [${(f.winners || []).join(',')}]`)
      .join(', ');

    const prompt = `Eres el cronista medieval de una partida de Carcassonne. Analiza esta partida en español con estilo épico y medieval.

PARTIDA: ${replay.name}
DURACIÓN: ${replay.durationMinutes} minutos, ${replay.totalTurns} turnos
JUGADORES: ${players}
LOSETAS INICIALES: ${replay.actions ? replay.actions.filter(a=>a.type==='place_tile').length : 0}
ESTRUCTURAS COMPLETADAS: ${features}

PRIMERAS JUGADAS:
${topActions}

Escribe UN PÁRRAFO CORTO (máximo 5 oraciones) narrando la partida de forma épica. Menciona al ganador, la estrategia dominante y el momento más decisivo que puedas inferir de los datos. Termina con una frase memorable de batalla medieval.`;

    const analysis = await GeminiAI.callGemini(prompt);
    if (analysis && analysis.trim()) {
      ReplayManager.saveReplayAnalysis(replayId, analysis.trim());
      console.log(`🏰 Análisis narrativo generado para ${replayId}`);
      if (io && roomId) {
        io.to(roomId).emit('replay_analysis_ready', { replayId, analysis: analysis.trim() });
      }
    }
  } catch (e) {
    console.warn('⚠️ Auto-análisis Gemini no disponible:', e.message);
  }
}

// Socket.io Realtime Sync
io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentPlayerId = null;


  socket.on('join_room', ({ roomId, playerId, playerName, preferredColor, avatar }) => {
    currentRoomId = roomId;
    currentPlayerId = playerId || socket.id;
    socket.join(roomId);

    const result = roomManager.joinRoom(roomId, {
      playerId: currentPlayerId,
      playerName,
      preferredColor,
      avatar
    });

    if (result.error) {
      socket.emit('error_msg', result.error);
      return;
    }

    socket.emit('room_joined', { room: result.room, player: result.player });
    io.to(roomId).emit('room_updated', result.room);
  });

  socket.on('create_local_game', ({ name, players, options } = {}) => {
    const result = roomManager.createLocalGame({ name, players, options });
    if (result.error) {
      socket.emit('error_msg', result.error);
      return;
    }

    currentRoomId = result.room.id;
    currentPlayerId = result.room.players[0]?.id || socket.id;
    socket.join(result.room.id);

    console.log(`[Game] Local game created: ${result.room.id} with ${result.room.players.length} players. First turn: ${result.room.activePlayer?.name}`);
    socket.emit('room_joined', { room: result.room, player: result.room.players[0] });
    io.to(result.room.id).emit('room_updated', result.room);
  });

  socket.on('change_color', ({ roomId, playerId, newColor } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.changeColor(targetRoomId, targetPlayerId, newColor);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('change_turn_sound', ({ roomId, playerId, newSound } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.changeTurnSound(targetRoomId, targetPlayerId, newSound);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('add_bot', ({ roomId, playerId, difficulty } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.addBot(targetRoomId, targetPlayerId, difficulty || 'medium');
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('remove_player', ({ roomId, playerId, targetPlayerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const requestingHostId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId || !targetPlayerId) return;
    ensureSocketInRoom(targetRoomId, requestingHostId);

    console.log(`[Game] Removing player/bot ${targetPlayerId} from room ${targetRoomId} by host ${requestingHostId}`);
    const res = roomManager.removePlayer(targetRoomId, targetPlayerId, requestingHostId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('toggle_ready', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.toggleReady(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('delete_room', (data = {}) => {
    if (!currentRoomId) return;
    const pName = data && data.playerName ? data.playerName : null;
    const res = roomManager.deleteRoom(currentRoomId, currentPlayerId, pName);
    if (res.error) {
      socket.emit('error_msg', res.error);
    }
  });

  socket.on('delete_room_by_id', ({ roomId, playerId, playerName }) => {
    if (!roomId) return;
    const effectivePlayerId = playerId || currentPlayerId || socket.id;
    const res = roomManager.deleteRoom(roomId, effectivePlayerId, playerName);
    if (res.error) {
      socket.emit('error_msg', res.error);
    }
  });

  function ensureSocketInRoom(targetRoomId, targetPlayerId) {
    if (targetRoomId) {
      currentRoomId = targetRoomId;
      if (targetPlayerId) currentPlayerId = targetPlayerId;
      if (!socket.rooms.has(targetRoomId)) {
        socket.join(targetRoomId);
        console.log(`[Socket] Restored socket ${socket.id} (player: ${currentPlayerId}) to room ${targetRoomId}`);
      }
    }
  }

  socket.on('get_room_state', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const room = roomManager.getRoom(targetRoomId);
    if (room) {
      socket.emit('room_updated', roomManager.serializeRoom(room));
    }
  });

  socket.on('start_game', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.startGame(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      console.log(`[Game] Game started in room ${targetRoomId}. First turn: ${res.room.activePlayer?.name}`);
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('rotate_tile', ({ roomId, playerId, direction } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.rotateTile(targetRoomId, targetPlayerId, direction);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      const room = roomManager.getRoom(targetRoomId);
      io.to(targetRoomId).emit('room_updated', roomManager.serializeRoom(room));
    }
  });

  socket.on('place_tile', ({ roomId, playerId, x, y, rotation } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    console.log(`[Game:Action] place_tile in ${targetRoomId} by ${targetPlayerId} at (${x},${y}) rot:${rotation}`);
    const res = roomManager.placeTile(targetRoomId, targetPlayerId, { x, y, rotation });
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('tile_placed', {
        placed: res.placed,
        turnPhase: res.turnPhase,
        hasMeeples: res.hasMeeples,
        segments: res.segments,
        room: res.room
      });
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('cancel_tile_placement', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    const res = roomManager.cancelTilePlacement(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('place_meeple', ({ roomId, playerId, segmentId, pos } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    console.log(`[Game:Action] place_meeple in ${targetRoomId} by ${targetPlayerId} segment:${segmentId}`);
    const res = roomManager.placeMeeple(targetRoomId, targetPlayerId, { segmentId, pos });
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('pass_meeple', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    console.log(`[Game:Action] pass_meeple in ${targetRoomId} by ${targetPlayerId}`);
    const res = roomManager.passMeeple(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('remove_meeple', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    console.log(`[Game:Action] remove_meeple in ${targetRoomId} by ${targetPlayerId}`);
    const res = roomManager.removePlacedMeeple(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
      // Trigger Gemini auto-analysis when game ends
      if (res.room && res.room.status === 'ended' && res.room.lastReplayId) {
        triggerAutoAnalysis(io, res.room.lastReplayId, targetRoomId);
      }
    }
  });

  socket.on('confirm_turn', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    console.log(`[Game:Action] confirm_turn in ${targetRoomId} by ${targetPlayerId}`);
    const res = roomManager.confirmTurn(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
      if (res.room && res.room.status === 'ended' && res.room.lastReplayId) {
        triggerAutoAnalysis(io, res.room.lastReplayId, targetRoomId);
      }
    }
  });

  socket.on('surrender', ({ roomId, playerId } = {}) => {
    const targetRoomId = roomId || currentRoomId;
    const targetPlayerId = playerId || currentPlayerId || socket.id;
    if (!targetRoomId) return;
    ensureSocketInRoom(targetRoomId, targetPlayerId);

    console.log(`[Game:Action] surrender in ${targetRoomId} by ${targetPlayerId}`);
    const res = roomManager.surrender(targetRoomId, targetPlayerId);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      io.to(targetRoomId).emit('room_updated', res.room);
    }
  });

  // Rematch / Play Again Request System
  socket.on('request_rematch', (data = {}) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;
    const requesterName = data.playerName || 'Un rival';
    const requesterId = data.playerId || currentPlayerId || socket.id;
    io.to(targetRoomId).emit('rematch_requested', {
      requesterId,
      requesterName,
      roomId: targetRoomId
    });
  });

  socket.on('accept_rematch', (data = {}) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;
    const room = roomManager.getRoom(targetRoomId);
    if (room) {
      const hostId = room.hostId || (room.players[0] ? room.players[0].id : (data.playerId || currentPlayerId));
      const res = roomManager.startGame(targetRoomId, hostId);
      if (!res.error) {
        io.to(targetRoomId).emit('rematch_started', res.room);
        io.to(targetRoomId).emit('room_updated', res.room);
      }
    }
  });

  socket.on('decline_rematch', (data = {}) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;
    const declinerName = data.playerName || 'Un jugador';
    io.to(targetRoomId).emit('rematch_declined', { declinerName });
  });

  // Interactive Laser Pointer Event
  socket.on('laser_pointer_move', (data = {}) => {
    const targetRoomId = data.roomId || currentRoomId;
    if (!targetRoomId) return;
    socket.to(targetRoomId).emit('laser_pointer_updated', {
      playerId: data.playerId || currentPlayerId || socket.id,
      playerName: data.playerName || 'Comandante',
      playerColor: data.playerColor || 'red',
      worldX: data.worldX,
      worldY: data.worldY,
      active: !!data.active
    });
  });

  // Global Lobby Chat Events
  socket.on('send_lobby_chat', ({ text, senderName, avatar, color } = {}) => {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim().substring(0, 200);
    if (!cleanText) return;
    const msg = {
      id: 'lmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sender: (senderName || 'Noble').substring(0, 30),
      avatar: avatar || 'king',
      color: color || 'yellow',
      text: cleanText,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    globalLobbyChatHistory.push(msg);
    if (globalLobbyChatHistory.length > 60) globalLobbyChatHistory.shift();
    io.emit('new_lobby_chat', msg);
  });

  socket.on('get_lobby_chat_history', () => {
    socket.emit('lobby_chat_history', globalLobbyChatHistory);
  });

  // Sandbox Mode controls
  socket.on('sandbox_set_mode', (opts) => {
    if (!currentRoomId) return;
    const res = roomManager.setSandboxMode(currentRoomId, opts);
    if (!res.error) {
      io.to(currentRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('sandbox_adjust_score', ({ playerId, delta }) => {
    if (!currentRoomId) return;
    const res = roomManager.adjustScore(currentRoomId, { playerId, delta });
    if (!res.error) {
      io.to(currentRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('sandbox_adjust_meeples', ({ playerId, delta }) => {
    if (!currentRoomId) return;
    const res = roomManager.adjustMeeples(currentRoomId, { playerId, delta });
    if (!res.error) {
      io.to(currentRoomId).emit('room_updated', res.room);
    }
  });

  socket.on('sandbox_move_tile', (data) => {
    if (!currentRoomId) return;
    const res = roomManager.sandboxMoveTile(currentRoomId, data);
    if (!res.error) {
      io.to(currentRoomId).emit('room_updated', res.room);
    }
  });

  // Save / Load / Delete Game
  socket.on('save_game', ({ saveName }) => {
    if (!currentRoomId) return;
    const res = roomManager.saveGame(currentRoomId, saveName);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      socket.emit('game_saved', res);
      const room = roomManager.getRoom(currentRoomId);
      io.to(currentRoomId).emit('room_updated', roomManager.serializeRoom(room));
    }
  });

  socket.on('load_game', ({ saveName }) => {
    const res = roomManager.loadGame(saveName);
    if (res.error) {
      socket.emit('error_msg', res.error);
    } else {
      currentRoomId = res.room.id;
      socket.join(res.room.id);
      socket.emit('room_joined', { room: res.room, player: res.room.players[0] || null });
      io.to(res.room.id).emit('room_updated', res.room);
    }
  });

  socket.on('delete_save', ({ saveName }) => {
    roomManager.deleteGame(saveName);
    socket.emit('save_deleted', { saveName });
  });

  // Chat message
  socket.on('send_chat', ({ text }) => {
    if (!currentRoomId || !text) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room) return;
    const p = room.players.find(x => x.id === currentPlayerId);
    const author = p ? p.name : 'Espectador';
    const msg = {
      author,
      color: p ? p.color : 'black',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    io.to(currentRoomId).emit('new_chat', msg);
  });

  socket.on('disconnect', () => {
    if (currentRoomId && currentPlayerId) {
      roomManager.leaveRoom(currentRoomId, currentPlayerId);
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        io.to(currentRoomId).emit('room_updated', roomManager.serializeRoom(room));
      }
    }
  });
});

// ==================== BOT TRAINING API ====================

// GET current weights
app.get('/api/bot/weights', (req, res) => {
  try {
    const weights = BotEngine.loadWeights();
    const raw = JSON.parse(fs.readFileSync(BotEngine.WEIGHTS_PATH, 'utf8'));
    res.json({ success: true, weights, trainingSessions: raw.trainingSessions || 0, lastTrainedAt: raw.lastTrainedAt, lastTrainingMethod: raw.lastTrainingMethod });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// PUT update weights manually
app.put('/api/bot/weights', (req, res) => {
  try {
    const { weights } = req.body;
    if (!weights || typeof weights !== 'object') return res.json({ success: false, error: 'Pesos inválidos' });
    BotEngine.saveWeights(weights, { method: 'manual_edit' });
    res.json({ success: true, weights });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// POST train from replays (Imitation Learning)
app.post('/api/bot/train-replays', async (req, res) => {
  try {
    const trainer = new BotTrainer();
    const result = trainer.learnFromReplays();
    if (result.error) return res.json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// POST optimize with Gemini
app.post('/api/bot/train-gemini', async (req, res) => {
  try {
    const trainer = new BotTrainer();
    const learnResult = trainer.learnFromReplays();
    if (learnResult.error) return res.json({ success: false, error: learnResult.error });
    const currentWeights = BotEngine.loadWeights();
    const raw = JSON.parse(fs.readFileSync(BotEngine.WEIGHTS_PATH, 'utf8'));
    const stats = { ...learnResult.patterns, currentWeights, trainingSessions: raw.trainingSessions || 0, replaysAnalyzed: learnResult.replaysAnalyzed };
    const geminiResult = await GeminiAI.analyzeWeightOptimization(stats);
    if (!geminiResult.success) return res.json({ success: false, error: geminiResult.error });
    const validWeights = {};
    for (const [k, v] of Object.entries(geminiResult.weights || {})) {
      if (typeof v === 'number' && v >= 1 && v <= 30) validWeights[k] = v;
    }
    BotEngine.saveWeights(validWeights, { method: 'gemini_optimization' });
    res.json({ success: true, reasoning: geminiResult.reasoning, weightChanges: validWeights, patterns: learnResult.patterns });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// POST self-play training (runs async, returns immediately with job status)
let selfPlayRunning = false;
let selfPlayProgress = [];
app.post('/api/bot/train-selfplay', async (req, res) => {
  if (selfPlayRunning) return res.json({ success: false, error: 'Ya hay un entrenamiento en curso.' });
  const { games = 150, iterations = 4 } = req.body || {};
  selfPlayRunning = true;
  selfPlayProgress = [];
  res.json({ success: true, message: `Entrenamiento iniciado: ${games} partidas × ${iterations} iteraciones`, games, iterations });
  // Run in background
  const trainer = new BotTrainer();
  trainer.selfPlayTrain({
    games, iterations,
    onProgress: (iter) => { selfPlayProgress.push(iter); }
  }).then(summary => {
    selfPlayRunning = false;
    selfPlayProgress.push({ done: true, summary });
    console.log(`✅ Self-play completado. Mejor tasa: ${(summary.bestWinRate * 100).toFixed(1)}%`);
  }).catch(e => {
    selfPlayRunning = false;
    console.error('❌ Error en self-play:', e.message);
  });
});

// GET self-play progress
app.get('/api/bot/train-selfplay/progress', (req, res) => {
  res.json({ running: selfPlayRunning, progress: selfPlayProgress });
});

// ==========================================================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🏰 Carcassonne Server corriendo en el puerto ${PORT}`);
  console.log(`🌐 Acceso local: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
