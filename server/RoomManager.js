const fs = require('fs');
const path = require('path');
const Board = require('./engine/Board');
const { TileDeck, rotateEdges, rotatePoint } = require('./engine/TileDeck');
const Rules = require('./engine/Rules');
const BoardGraph = require('./engine/BoardGraph');
const BotEngine = require('./engine/BotEngine');
const ReplayManager = require('./engine/ReplayManager');
const GeminiAI = require('./engine/GeminiAI');

const SAVES_DIR = path.join(__dirname, '..', 'data', 'saves');
const REPLAYS_DIR = path.join(__dirname, '..', 'data', 'replays');
if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
if (!fs.existsSync(REPLAYS_DIR)) fs.mkdirSync(REPLAYS_DIR, { recursive: true });

const PLAYER_COLORS = [
  { id: 'red', name: 'Rojo', hex: '#e74c3c' },
  { id: 'blue', name: 'Azul', hex: '#2980b9' },
  { id: 'green', name: 'Verde', hex: '#27ae60' },
  { id: 'yellow', name: 'Amarillo', hex: '#f1c40f' },
  { id: 'black', name: 'Negro', hex: '#2c3e50' },
  { id: 'pink', name: 'Rosa', hex: '#e84393' }
];

const TURN_SOUNDS = [
  { id: 'horn', name: '📯 Cuerno de Batalla', aliases: ['horn'] },
  { id: 'trumpets', name: '🎺 Fanfarria Real de Trompetas', aliases: ['trumpet', 'trumpets'] },
  { id: 'sword', name: '⚔️ Choque de Espadas de Acero', aliases: ['sword', 'swords'] },
  { id: 'bell', name: '🔔 Campanario Sagrado', aliases: ['bell', 'bells'] },
  { id: 'drums', name: '🥁 Tambores de Batalla', aliases: ['drum', 'drums'] },
  { id: 'harp', name: '🎵 Arpa Medieval', aliases: ['harp'] },
  { id: 'chant', name: '✨ Canto de Abadía', aliases: ['chant'] }
];

function resolveSoundId(soundId) {
  if (!soundId) return 'horn';
  const norm = String(soundId).trim().toLowerCase();
  const found = TURN_SOUNDS.find(s => s.id === norm || (s.aliases && s.aliases.includes(norm)));
  return found ? found.id : 'horn';
}

const BOT_NAMES = [
  '🤖 Bot Alarico (Fácil)',
  '🤖 Bot Carlomagno (Normal)',
  '🤖 Bot Leonor (Difícil)',
  '🤖 Bot Ricardo (Normal)',
  '🤖 Bot Juana (Difícil)'
];

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  cleanupStaleRooms() {
    const now = Date.now();
    for (const [id, r] of this.rooms.entries()) {
      if (r.isLocal) continue;
      // 1. Lobby rooms with 0 connected players or older than 15 minutes with no game started
      const activeHumans = (r.players || []).filter(p => !p.isBot && p.connected !== false).length;
      if (r.status === 'lobby') {
        if (activeHumans === 0 && (now - r.createdAt > 3 * 60 * 1000)) {
          this.rooms.delete(id);
          continue;
        }
        if (now - r.createdAt > 2 * 3600 * 1000) {
          this.rooms.delete(id);
          continue;
        }
      }
      // 2. Ended rooms older than 30 minutes
      if (r.status === 'ended' && (now - r.createdAt > 30 * 60 * 1000)) {
        this.rooms.delete(id);
        continue;
      }
      // 3. Stale rooms with all disconnected players older than 4 hours
      if (r.players && r.players.length > 0 && r.players.every(p => p.connected === false) && (now - r.createdAt > 4 * 3600 * 1000)) {
        this.rooms.delete(id);
      }
    }
  }

  createRoom({ name, hostName, passCode, options = {} }) {
    this.cleanupStaleRooms();

    // Clean up completely empty (0 connected humans) abandoned lobby rooms
    for (const [id, existing] of this.rooms.entries()) {
      if (!existing.isLocal && existing.status === 'lobby') {
        const connectedHumans = (existing.players || []).filter(p => !p.isBot && p.connected !== false).length;
        if (connectedHumans === 0) {
          this.rooms.delete(id);
        }
      }
    }

    const roomId = 'room_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = {
      id: roomId,
      name: name || `Sala de Carcassonne ${roomId}`,
      hostName: hostName || 'Noble',
      hostAvatar: options.avatar || 'king',
      passCode: passCode || '',
      createdAt: Date.now(),
      status: 'lobby', // 'lobby' | 'playing' | 'ended'
      isLocal: !!options.isLocal,
      saveFileName: options.saveFileName || null,
      players: [],
      turnIndex: 0,
      turnNumber: 1,
      currentTile: null,
      currentRotation: 0,
      turnPhase: 'place_tile', // 'place_tile' | 'place_meeple'
      lastPlacedPos: null,
      sandboxMode: !!options.sandboxMode,
      autoRules: options.autoRules !== false,
      includeRiver: !!options.includeRiver,
      board: new Board(),
      deck: null,
      rules: null,
      graph: null,
      botEngine: null,
      logs: []
    };

    room.rules = new Rules(room.board);
    room.graph = new BoardGraph(room.board);
    room.botEngine = new BotEngine(room.rules, room.graph);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  listRooms() {
    this.cleanupStaleRooms();
    return Array.from(this.rooms.values())
      .filter(r => !r.isLocal && r.status !== 'ended')
      .map(r => ({
        id: r.id,
        name: r.name,
        hostName: r.hostName || (r.players[0]?.name) || 'Comandante',
        hostAvatar: r.hostAvatar || (r.players[0]?.avatar) || 'king',
        hasPass: !!r.passCode,
        playerCount: r.players.length,
        status: r.status,
        includeRiver: r.includeRiver,
        sandboxMode: r.sandboxMode,
        players: r.players.map(p => ({
          name: p.name,
          avatar: p.avatar || (p.isBot ? 'bot' : 'knight'),
          color: p.color,
          isHost: !!p.isHost,
          isBot: !!p.isBot,
          connected: p.connected !== false
        }))
      }));
  }

  joinRoom(roomId, { playerId, playerName, preferredColor, avatar, sound }) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    let player = room.players.find(p => p.id === playerId);
    if (!player && room.isLocal) {
      player = room.players.find(p => !p.isBot) || room.players[0];
      if (player) {
        player.connected = true;
        this.addLog(room, `⚡ Reconectado a la partida local.`);
        return { room: this.serializeRoom(room), player };
      }
    }
    if (!player) {
      if (room.players.length >= 6) {
        return { error: 'La sala está llena (máximo 6 jugadores)' };
      }

      const usedColors = room.players.map(p => p.color);
      let color = preferredColor;
      if (!color || usedColors.includes(color)) {
        const available = PLAYER_COLORS.find(c => !usedColors.includes(c.id));
        color = available ? available.id : 'red';
      }

      const usedSounds = room.players.map(p => p.sound);
      let playerSound = sound;
      if (!playerSound || usedSounds.includes(playerSound)) {
        const availableSound = TURN_SOUNDS.find(s => !usedSounds.includes(s.id));
        playerSound = availableSound ? availableSound.id : 'horn';
      }

      player = {
        id: playerId,
        name: playerName || `Jugador ${room.players.length + 1}`,
        avatar: avatar || (room.players.length === 0 ? (room.hostAvatar || 'king') : 'knight'),
        color,
        sound: playerSound,
        score: 0,
        meeples: 7,
        isHost: room.players.length === 0,
        isBot: false,
        connected: true
      };
      room.players.push(player);
      this.addLog(room, `${player.name} se unió a la sala (${color}).`);
    } else {
      player.connected = true;
      if (playerName) player.name = playerName;
      if (avatar) player.avatar = avatar;
      if (room.status === 'playing') {
        this.addLog(room, `⚡ ${player.name} ha regresado a la partida.`);
      } else {
        this.addLog(room, `${player.name} se ha reconectado a la sala.`);
      }
    }

    return { room: this.serializeRoom(room), player };
  }

  changeColor(roomId, playerId, newColor) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jugador no encontrado' };

    const colorDef = PLAYER_COLORS.find(c => c.id === newColor);
    if (!colorDef) return { error: 'Color no válido' };

    // Check if another player is already using this color
    const isTaken = room.players.some(p => p.id !== playerId && p.color === newColor);
    if (isTaken) {
      return { error: `El color ${colorDef.name} ya está siendo utilizado por otro jugador en esta sala` };
    }

    player.color = newColor;
    this.addLog(room, `${player.name} cambió su color a ${colorDef.name}.`);
    return { room: this.serializeRoom(room), player };
  }

  changeTurnSound(roomId, playerId, newSound) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jugador no encontrado' };

    const canonicalSoundId = resolveSoundId(newSound);
    const soundDef = TURN_SOUNDS.find(s => s.id === canonicalSoundId);
    if (!soundDef) return { error: 'Sonido no válido' };

    // Check if another player in this room is already using this sound
    const isTaken = room.players.some(p => p.id !== playerId && resolveSoundId(p.sound) === canonicalSoundId);
    if (isTaken) {
      return { error: `El sonido "${soundDef.name}" ya está siendo utilizado por otro comandante en esta sala` };
    }

    player.sound = canonicalSoundId;
    return { room: this.serializeRoom(room), player };
  }

  addBot(roomId, hostId, difficulty = 'medium') {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    if (room.players.length >= 6) {
      return { error: 'La sala está llena (máximo 6 jugadores)' };
    }

    const host = room.players.find(p => p.id === hostId);
    if (!host || !host.isHost) {
      return { error: 'Solo el anfitrión puede agregar bots' };
    }

    const usedColors = room.players.map(p => p.color);
    const availableColor = PLAYER_COLORS.find(c => !usedColors.includes(c.id)) || PLAYER_COLORS[0];
    const usedSounds = room.players.map(p => p.sound);
    const availableSound = TURN_SOUNDS.find(s => !usedSounds.includes(s.id)) || TURN_SOUNDS[0];
    const botIndex = room.players.filter(p => p.isBot).length;
    const botName = BOT_NAMES[botIndex % BOT_NAMES.length];

    const botPlayer = {
      id: 'bot_' + Math.random().toString(36).substring(2, 7),
      name: botName,
      color: availableColor.id,
      sound: availableSound.id,
      score: 0,
      meeples: 7,
      isHost: false,
      isBot: true,
      difficulty,
      connected: true
    };

    room.players.push(botPlayer);
    this.addLog(room, `${botPlayer.name} ha sido agregado a la partida.`);
    return { room: this.serializeRoom(room), bot: botPlayer };
  }

  createLocalGame({ name, players = [], options = {} }) {
    const room = this.createRoom({
      name: name || 'Partida Local / Vs Bots',
      options: { ...options, isLocal: true }
    });

    const usedColors = [];
    const usedSounds = [];
    players.forEach((pConfig, index) => {
      let color = pConfig.color;
      if (!color || usedColors.includes(color)) {
        const freeColor = PLAYER_COLORS.find(c => !usedColors.includes(c.id));
        color = freeColor ? freeColor.id : 'red';
      }
      usedColors.push(color);

      let sound = pConfig.sound;
      if (!sound || usedSounds.includes(sound)) {
        const freeSound = TURN_SOUNDS.find(s => !usedSounds.includes(s.id));
        sound = freeSound ? freeSound.id : TURN_SOUNDS[index % TURN_SOUNDS.length].id;
      }
      usedSounds.push(sound);

      room.players.push({
        id: pConfig.isBot ? `bot_${index}_${Date.now()}` : `local_${index}_${Date.now()}`,
        name: pConfig.name || (pConfig.isBot ? `🤖 Bot ${index + 1}` : `Jugador ${index + 1}`),
        color,
        sound,
        score: 0,
        meeples: 7,
        isHost: index === 0,
        isBot: !!pConfig.isBot,
        difficulty: pConfig.difficulty || 'medium',
        connected: true
      });
    });

    if (room.players.length === 0) {
      room.players.push({
        id: 'local_1',
        name: 'Jugador 1',
        color: 'red',
        sound: 'horn',
        score: 0,
        meeples: 7,
        isHost: true,
        isBot: false,
        connected: true
      });
      room.players.push({
        id: 'bot_1',
        name: '🤖 Bot Carlomagno (Normal)',
        color: 'blue',
        sound: 'bell',
        score: 0,
        meeples: 7,
        isHost: false,
        isBot: true,
        difficulty: 'medium',
        connected: true
      });
    }

    // Start game immediately with RANDOM starting player
    room.logs = [];
    room.deck = new TileDeck({ includeRiver: room.includeRiver });
    room.board = new Board();
    room.rules = new Rules(room.board);
    room.graph = new BoardGraph(room.board);
    room.botEngine = new BotEngine(room.rules, room.graph);
    room.status = 'playing';
    room.turnIndex = Math.floor(Math.random() * room.players.length);
    room.turnNumber = 1;
    room.turnPhase = 'place_tile';
    room.currentRotation = 0;

    // Start replay recording for local matches
    ReplayManager.startRecording(room);

    if (room.deck.startTile) {
      room.board.placeTile(0, 0, room.deck.startTile, 0, null);
      this.addLog(room, `Loseta de inicio colocada en (0, 0).`);
      ReplayManager.recordAction(room.id, null, 'start_tile', {
        x: 0,
        y: 0,
        rotation: 0,
        tileId: room.deck.startTile.id,
        tileImage: room.deck.startTile.image,
        tile: { id: room.deck.startTile.id, image: room.deck.startTile.image, edges: room.deck.startTile.edges, segments: room.deck.startTile.segments },
        turnNumber: 0
      }, this._buildReplayContext(room, null, null));
    }

    this.drawNextValidTile(room);
    const startPlayer = room.players[room.turnIndex];
    this.addLog(room, `🎲 ¡Partida Local iniciada! Se eligió aleatoriamente a ${startPlayer.name} para comenzar.`);
    this.checkTriggerBot(room);

    return { room: this.serializeRoom(room) };
  }

  deleteRoom(roomId, hostId, hostName = null) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const norm = (s) => String(s || '').trim().toLowerCase();
    const reqName = norm(hostName);
    const roomHostName = norm(room.hostName);

    const hostPlayer = room.players.find(p => p.isHost) || room.players[0];
    const isOwnerById = (hostPlayer && hostPlayer.id === hostId) || (room.players.some(p => p.id === hostId && p.isHost));
    const isOwnerByName = reqName && (
      reqName === roomHostName ||
      room.players.some(p => norm(p.name) === reqName && p.isHost) ||
      (room.players[0] && norm(room.players[0].name) === reqName)
    );
    const isOwner = isOwnerById || isOwnerByName || (room.players.length === 0) || hostId === 'admin';

    if (!isOwner) {
      return { error: 'Solo el anfitrión puede eliminar la sala' };
    }

    this.rooms.delete(roomId);
    if (this.io) {
      this.io.to(roomId).emit('room_deleted', { roomId, reason: 'La sala ha sido eliminada por el anfitrión.' });
      this.io.emit('rooms_list', this.listRooms());
    }
    return { success: true };
  }

  toggleReady(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };
    if (room.status !== 'lobby') return { error: 'La partida ya está en curso' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jugador no encontrado' };

    player.isReady = !player.isReady;
    this.addLog(room, `${player.name} está ${player.isReady ? '⚔️ ¡LISTO!' : '⏳ No preparado'}.`);
    return { room: this.serializeRoom(room), player };
  }

  removePlayer(roomId, playerId, hostId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const host = room.players.find(p => p.id === hostId && p.isHost) || (room.players[0] && room.players[0].id === hostId ? room.players[0] : null);
    if (!host && hostId !== 'admin') return { error: 'Solo el anfitrión puede expulsar participantes o bots' };

    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      const removed = room.players.splice(idx, 1)[0];
      this.addLog(room, `${removed.name} fue eliminado de la sala.`);
      return { room: this.serializeRoom(room) };
    }
    return { error: 'Participante no encontrado' };
  }

  leaveRoom(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const p = room.players.find(x => x.id === playerId);
    if (p) {
      p.connected = false;
      if (room.status === 'playing') {
        this.addLog(room, `💤 ${p.name} se encuentra en reposo (desconectado). La partida continuará y puede volver a conectarse.`);
      } else {
        this.addLog(room, `${p.name} ha salido de la sala.`);
      }
      const activeHumans = room.players.filter(x => !x.isBot && x.connected !== false).length;
      if (activeHumans === 0 && room.status === 'lobby') {
        this.rooms.delete(roomId);
      }
      if (this.io) {
        this.io.to(roomId).emit('room_updated', this.serializeRoom(room));
        this.io.emit('rooms_list', this.listRooms());
      }
    }
  }

  drawNextValidTile(room) {
    while (room.deck && room.deck.remainingCount() > 0) {
      const tile = room.deck.drawTile();
      if (!tile) break;

      const validPlacements = room.board.getValidPlacements(tile, room.autoRules && !room.sandboxMode);
      if (validPlacements.length > 0 || room.sandboxMode) {
        room.currentTile = tile;
        return tile;
      }

      // Discard unplaceable tile as per official rules
      const tileTitle = tile.name || tile.id;
      this.addLog(room, `⚠️ La loseta "${tileTitle}" no tiene ninguna colocación legal posible y ha sido descartada según las reglas oficiales.`);
      if (this.io && room.id) {
        this.io.to(room.id).emit('tile_discarded', { tileName: tileTitle });
      }
    }

    room.currentTile = null;
    return null;
  }

  startGame(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const host = room.players.find(p => p.id === playerId);
    if (!host || !host.isHost) {
      return { error: 'Solo el anfitrión puede iniciar la partida' };
    }

    if (room.players.length < 1) {
      return { error: 'Se necesita al menos 1 jugador para jugar' };
    }

    // Initialize Deck & Board
    room.logs = [];
    room.deck = new TileDeck({ includeRiver: room.includeRiver });
    room.board = new Board();
    room.rules = new Rules(room.board);
    room.graph = new BoardGraph(room.board);
    room.botEngine = new BotEngine(room.rules, room.graph);
    room.status = 'playing';
    room.turnIndex = Math.floor(Math.random() * room.players.length);
    room.turnNumber = 1;
    room.turnPhase = 'place_tile';
    room.currentRotation = 0;

    room.players.forEach(p => {
      p.score = 0;
      p.meeples = 7;
    });

    ReplayManager.startRecording(room);

    // Place starting tile
    if (room.deck.startTile) {
      room.board.placeTile(0, 0, room.deck.startTile, 0, null);
      this.addLog(room, `Loseta de inicio colocada en (0, 0).`);
      ReplayManager.recordAction(room.id, null, 'start_tile', {
        x: 0,
        y: 0,
        rotation: 0,
        tileId: room.deck.startTile.id,
        tileImage: room.deck.startTile.image,
        tile: { id: room.deck.startTile.id, image: room.deck.startTile.image, edges: room.deck.startTile.edges, segments: room.deck.startTile.segments },
        turnNumber: 0
      }, this._buildReplayContext(room, null, null));
    }

    // Draw first playable tile
    this.drawNextValidTile(room);
    const startPlayer = room.players[room.turnIndex];
    this.addLog(room, `🎲 ¡Partida iniciada! Se eligió aleatoriamente a ${startPlayer.name} para comenzar.`);

    this.checkTriggerBot(room);
    return { room: this.serializeRoom(room) };
  }

  canPlayerAct(room, playerId) {
    if (!room || room.status !== 'playing') return false;
    if (room.sandboxMode) return true;
    const activePlayer = room.players[room.turnIndex];
    if (!activePlayer) return false;

    // The bot engine acting on behalf of the active bot player
    if (activePlayer.isBot && activePlayer.id === playerId) {
      return true;
    }

    // In a local pass & play match, any connected human client can control human turns
    if (room.isLocal) {
      return !activePlayer.isBot;
    }
    return activePlayer.id === playerId;
  }

  rotateTile(roomId, playerId, direction = 1) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };

    if (!this.canPlayerAct(room, playerId)) {
      return { error: 'No es tu turno' };
    }

    const step = direction * 90;
    room.currentRotation = (room.currentRotation + step + 360) % 360;
    return { currentRotation: room.currentRotation };
  }

  placeTile(roomId, playerId, { x, y, rotation }) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };
    if (room.turnPhase !== 'place_tile' && !room.sandboxMode) return { error: 'Fase incorrecta: debes colocar seguidor o pasar' };

    const activePlayer = room.players[room.turnIndex];
    if (!this.canPlayerAct(room, playerId)) {
      return { error: 'No es tu turno' };
    }

    if (!room.currentTile) {
      return { error: 'No hay loseta en mano' };
    }

    let finalRot = rotation !== undefined ? rotation : room.currentRotation;

    // Authoritative edge validation (Strict rule enforcement)
    if (room.autoRules && !room.sandboxMode) {
      const validRots = room.board.getValidRotationsForSlot(x, y, room.currentTile, true);
      if (validRots.length === 0) {
        return { error: 'No se puede colocar la loseta en esa casilla: no encaja con los bordes adyacentes' };
      }

      if (!validRots.includes(finalRot)) {
        return { error: 'Orientación inválida: los caminos deben conectar con caminos, campos con campos y ciudades con ciudades' };
      }
    }

    // Place tile
    const placed = room.board.placeTile(x, y, room.currentTile, finalRot, activePlayer.id);
    room.lastPlacedPos = { x, y };
    this.addLog(room, `${activePlayer.name} colocó una loseta en (${x}, ${y}) a ${finalRot}°.`);

    // Build context before scoring (scores captured before finishTurn)
    const replayCtxTile = this._buildReplayContext(room, activePlayer, null);
    // Legal placements were computed just before placing
    replayCtxTile.legalPlacements = room.board.getValidPlacements(room.currentTile, room.autoRules && !room.sandboxMode)
      .map(p => ({ x: p.x, y: p.y, rotation: p.rotation })).slice(0, 50);

    ReplayManager.recordAction(room.id, activePlayer, 'place_tile', {
      x,
      y,
      rotation: finalRot,
      tileId: room.currentTile ? room.currentTile.id : null,
      tileImage: room.currentTile ? room.currentTile.image : null,
      tile: room.currentTile ? { id: room.currentTile.id, image: room.currentTile.image, edges: room.currentTile.edges, segments: room.currentTile.segments } : null,
      turnNumber: room.turnNumber
    }, replayCtxTile);

    // If player has ZERO meeples, skip meeple placement phase and finish turn immediately!
    if (activePlayer.meeples <= 0 && !room.sandboxMode) {
      this.addLog(room, `${activePlayer.name} no tiene meeples disponibles.`);
      return this.finishTurn(room);
    }

    room.turnPhase = 'place_meeple';

    // Prepare interactive placement dots (filter out river/noMeeple segments and evaluate occupation)
    const availableSegments = (room.currentTile.segments || []).filter(seg => !seg.noMeeple && seg.type !== 'river').map(seg => {
      const occCheck = (room.autoRules && !room.sandboxMode)
        ? room.graph.isSegmentOccupied(x, y, room.currentTile, finalRot, seg.id)
        : { occupied: false };

      let friendlyError = null;
      if (occCheck.occupied) {
        friendlyError = occCheck.error || 'Estructura ya ocupada';
        (room.players || []).forEach(p => {
          if (p && p.id && p.name) {
            friendlyError = friendlyError.replace(new RegExp(p.id, 'g'), p.name);
          }
        });
      }

      return {
        ...seg,
        pos: rotatePoint(seg.pos, finalRot),
        isOccupied: !!occCheck.occupied,
        occupiedError: friendlyError
      };
    });

    return {
      placed,
      turnPhase: room.turnPhase,
      hasMeeples: activePlayer.meeples > 0,
      segments: availableSegments,
      room: this.serializeRoom(room)
    };
  }

  cancelTilePlacement(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing' || (room.turnPhase !== 'place_meeple' && room.turnPhase !== 'confirm_turn')) {
      return { error: 'No se puede deshacer en este momento' };
    }

    const activePlayer = room.players[room.turnIndex];
    if (!this.canPlayerAct(room, playerId)) {
      return { error: 'No es tu turno' };
    }

    if (room.lastPlacedPos) {
      const placedTile = room.board.getTile(room.lastPlacedPos.x, room.lastPlacedPos.y);
      if (placedTile && placedTile.meeple && placedTile.meeple.player === activePlayer.id) {
        room.board.removeMeeple(room.lastPlacedPos.x, room.lastPlacedPos.y);
        activePlayer.meeples = Math.min(7, activePlayer.meeples + 1);
      }
      room.board.removeTile(room.lastPlacedPos.x, room.lastPlacedPos.y);
      room.lastPlacedPos = null;
      room.turnPhase = 'place_tile';
      this.addLog(room, `${activePlayer.name} deshizo la colocación de la loseta.`);
    }

    return { room: this.serializeRoom(room) };
  }

  placeMeeple(roomId, playerId, { segmentId }) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };
    if (room.turnPhase !== 'place_meeple' && room.turnPhase !== 'confirm_turn' && !room.sandboxMode) {
      return { error: 'Fase incorrecta: debes colocar una loseta primero' };
    }

    const activePlayer = room.players[room.turnIndex];
    if (!this.canPlayerAct(room, playerId)) {
      return { error: 'No es tu turno' };
    }

    if (!room.lastPlacedPos) {
      return { error: 'Debes colocar una loseta primero' };
    }

    const { x, y } = room.lastPlacedPos;
    const placedTile = room.board.getTile(x, y);
    if (!placedTile) return { error: 'No se encontró la loseta colocada' };

    // If a meeple was already temporarily placed on this tile in this turn, return it first!
    if (placedTile.meeple && placedTile.meeple.player === activePlayer.id) {
      room.board.removeMeeple(x, y);
      activePlayer.meeples = Math.min(7, activePlayer.meeples + 1);
    }

    if (activePlayer.meeples <= 0) {
      return { error: 'No tienes meeples disponibles' };
    }

    // Authoritatively resolve segment and position from canonical definition
    const segments = placedTile.tile.segments || [];
    let segDef = segments.find(s => s.id === segmentId);
    if (!segDef && segmentId) {
      segDef = segments.find(s => s.type === segmentId || s.id.startsWith(segmentId) || s.id.includes(segmentId));
    }
    if (!segDef) {
      segDef = segments.find(s => !s.noMeeple && s.type !== 'river');
    }

    if (!segDef || segDef.noMeeple || segDef.type === 'river') {
      return { error: 'No se puede colocar un seguidor en este segmento' };
    }

    // Check if connected feature is already occupied (authoritative graph check!)
    if (room.autoRules && !room.sandboxMode) {
      const occCheck = room.graph.isSegmentOccupied(x, y, placedTile.tile, placedTile.rotation, segDef.id);
      if (occCheck.occupied) {
        return { error: occCheck.error };
      }
    }

    const canonicalPos = rotatePoint(segDef.pos, placedTile.rotation);
    room.board.placeMeeple(x, y, activePlayer.id, segDef.id, canonicalPos, activePlayer.color);
    activePlayer.meeples -= 1;

    ReplayManager.recordAction(room.id, activePlayer, 'place_meeple', {
      x,
      y,
      segmentId,
      segmentType: segDef.type,
      segmentPos: canonicalPos,
      color: activePlayer.color,
      turnNumber: room.turnNumber
    }, this._buildReplayContext(room, activePlayer, null));

    this.addLog(room, `${activePlayer.name} ubicó un seguidor (${segDef.name || segDef.type}) en (${x}, ${y}).`);

    // For bots, auto finish turn. For humans, transition to confirm_turn so they have final confirmation & undo!
    if (activePlayer.isBot) {
      return this.finishTurn(room);
    }

    room.turnPhase = 'confirm_turn';
    return { room: this.serializeRoom(room) };
  }

  removePlacedMeeple(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };

    const activePlayer = room.players[room.turnIndex];
    if (!this.canPlayerAct(room, playerId)) return { error: 'No es tu turno' };

    if (!room.lastPlacedPos) return { error: 'No hay loseta activa' };
    const { x, y } = room.lastPlacedPos;
    const placedTile = room.board.getTile(x, y);
    if (!placedTile || !placedTile.meeple) return { error: 'No hay seguidor colocado' };

    room.board.removeMeeple(x, y);
    activePlayer.meeples = Math.min(7, activePlayer.meeples + 1);
    room.turnPhase = 'place_meeple';
    this.addLog(room, `${activePlayer.name} retiró su seguidor de (${x}, ${y}).`);

    ReplayManager.recordAction(room.id, activePlayer, 'remove_meeple', {
      x,
      y,
      turnNumber: room.turnNumber
    }, this._buildReplayContext(room, activePlayer, null));

    return { room: this.serializeRoom(room) };
  }

  surrender(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };

    const forfeitingPlayer = room.players.find(p => p.id === playerId);
    if (!forfeitingPlayer) return { error: 'Jugador no encontrado en la sala' };

    this.addLog(room, `🏳️ ${forfeitingPlayer.name} se ha rendido. Fin de la partida.`);

    // Finalize end game scoring
    const finalRes = room.rules.calculateFinalScores();
    finalRes.scoredFeatures.forEach(feat => {
      ReplayManager.recordFeatureScored(room.id, feat);
      this.addLog(room, `[Puntuación Final] ${feat.name}: +${feat.points} pts.`);
    });
    Object.entries(finalRes.totalPointsByPlayer).forEach(([pid, pts]) => {
      const p = room.players.find(x => x.id === pid);
      if (p) p.score += pts;
    });

    room.status = 'ended';

    // In 2-player matches, ensure opponent gets the higher score if needed
    const otherPlayers = room.players.filter(p => p.id !== playerId);
    if (otherPlayers.length === 1 && otherPlayers[0].score <= forfeitingPlayer.score) {
      otherPlayers[0].score = forfeitingPlayer.score + 1;
    }

    const finalReplay = ReplayManager.finalizeRecording(room);
    room.lastReplayId = finalReplay ? finalReplay.id : null;
    this.addLog(room, `¡Partida finalizada por rendición!`);

    return { room: this.serializeRoom(room) };
  }

  confirmTurn(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };
    if (room.turnPhase !== 'confirm_turn' && room.turnPhase !== 'place_meeple' && !room.sandboxMode) {
      return { error: 'No se puede finalizar la jugada en este momento' };
    }

    const activePlayer = room.players[room.turnIndex];
    if (!this.canPlayerAct(room, playerId)) {
      return { error: 'No es tu turno' };
    }

    return this.finishTurn(room);
  }

  passMeeple(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'playing') return { error: 'Partida no activa' };
    if (room.turnPhase !== 'place_meeple' && room.turnPhase !== 'confirm_turn' && !room.sandboxMode) {
      return { error: 'Debes colocar una loseta antes de pasar' };
    }

    const activePlayer = room.players[room.turnIndex];
    if (!this.canPlayerAct(room, playerId)) {
      return { error: 'No es tu turno' };
    }

    // If there was a meeple placed on lastPlacedPos, remove it when passing
    if (room.lastPlacedPos) {
      const placedTile = room.board.getTile(room.lastPlacedPos.x, room.lastPlacedPos.y);
      if (placedTile && placedTile.meeple && placedTile.meeple.player === activePlayer.id) {
        room.board.removeMeeple(room.lastPlacedPos.x, room.lastPlacedPos.y);
        activePlayer.meeples = Math.min(7, activePlayer.meeples + 1);
      }
    }

    ReplayManager.recordAction(room.id, activePlayer, 'pass_meeple', {
      turnNumber: room.turnNumber
    }, this._buildReplayContext(room, activePlayer, null));

    this.addLog(room, `${activePlayer.name} no colocó seguidor.`);
    return this.finishTurn(room);
  }

  finishTurn(room) {
    // 1. Check scoring features
    if (room.lastPlacedPos) {
      const { x, y } = room.lastPlacedPos;
      const scoringResult = room.rules.checkCompletedFeatures(x, y);

      if (scoringResult.scoredFeatures.length > 0) {
        scoringResult.scoredFeatures.forEach(feat => {
          ReplayManager.recordFeatureScored(room.id, feat);
          this.addLog(room, `¡${feat.name} completado! +${feat.points} pts para ${feat.winners.map(w => this.getPlayerName(room, w)).join(', ')}.`);
        });

        // Add points & return meeples
        Object.entries(scoringResult.totalPointsByPlayer).forEach(([pid, pts]) => {
          const p = room.players.find(x => x.id === pid);
          if (p) p.score += pts;
        });

        scoringResult.scoredFeatures.forEach(feat => {
          feat.meeplesToReturn.forEach(m => {
            const p = room.players.find(x => x.id === m.player);
            if (p) p.meeples = Math.min(7, p.meeples + 1);
          });
        });
      }
    }

    // 2. Advance turn
    room.lastPlacedPos = null;
    room.turnPhase = 'place_tile';
    room.currentRotation = 0;
    room.turnNumber += 1;

    // Draw next playable tile (with official impossible tile discard rule)
    this.drawNextValidTile(room);

    if (!room.currentTile) {
      // Execute End Game Final Scoring!
      const finalRes = room.rules.calculateFinalScores();
      finalRes.scoredFeatures.forEach(feat => {
        ReplayManager.recordFeatureScored(room.id, feat);
        this.addLog(room, `[Puntuación Final] ${feat.name}: +${feat.points} pts.`);
      });
      Object.entries(finalRes.totalPointsByPlayer).forEach(([pid, pts]) => {
        const p = room.players.find(x => x.id === pid);
        if (p) p.score += pts;
      });

      room.status = 'ended';
      const finalReplay = ReplayManager.finalizeRecording(room);
      room.lastReplayId = finalReplay ? finalReplay.id : null;
      this.addLog(room, `¡Se han agotado todas las losetas! Fin de la partida.`);
    } else {
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      const nextPlayer = room.players[room.turnIndex];
      this.addLog(room, `Turno de ${nextPlayer.name}.`);
    }

    const serialized = this.serializeRoom(room);
    this.checkTriggerBot(room);
    return { room: serialized };
  }

  // AI Bot Logic with BotEngine
  checkTriggerBot(room) {
    if (room.status !== 'playing') return;
    const activePlayer = room.players[room.turnIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    setTimeout(() => {
      this.executeBotTurn(room, activePlayer);
    }, 700);
  }

  executeBotTurn(room, botPlayer) {
    try {
      if (room.status !== 'playing' || !room.players[room.turnIndex] || room.players[room.turnIndex].id !== botPlayer.id) return;

      if (!room.botEngine) {
        room.botEngine = new BotEngine(room.rules, room.graph);
      }

      const move = room.botEngine.chooseMove(room, botPlayer);
      // Capture bot reasoning for replay
      const botReasoning = room.botEngine.lastReasoning || null;
      
      if (!move || move.action === 'discard') {
        this.addLog(room, `${botPlayer.name} no encontró colocación legal y descartó la loseta.`);
        this.drawNextValidTile(room);
        this.finishTurn(room);
        if (this.io) this.io.to(room.id).emit('room_updated', this.serializeRoom(room));
        return;
      }

      // 1. Place Tile — pass bot reasoning to replay
      const replayCtxBot = this._buildReplayContext(room, botPlayer, botReasoning);
      replayCtxBot.legalPlacements = move.candidateMoves ? move.candidateMoves.slice(0, 20) : null;
      const placeRes = this.placeTile(room.id, botPlayer.id, { x: move.x, y: move.y, rotation: move.rotation });
      // Patch last placed_tile action with bot reasoning
      const rec = ReplayManager.getRecording(room.id);
      if (rec && rec.actions.length > 0) {
        const lastAction = rec.actions[rec.actions.length - 1];
        if (lastAction.type === 'place_tile' && lastAction.isBot) {
          lastAction.reasoning = botReasoning;
          lastAction.legalPlacements = replayCtxBot.legalPlacements;
        }
      }
      
      if (this.io) {
        this.io.to(room.id).emit('room_updated', this.serializeRoom(room));
      }

      // 2. Decide Meeple placement after realistic thought delay
      setTimeout(() => {
        try {
          if (room.status === 'playing' && room.turnPhase === 'place_meeple' && room.players[room.turnIndex] && room.players[room.turnIndex].id === botPlayer.id) {
            const serialized = this.serializeRoom(room);
            const availableSegs = (serialized.availableSegments || []);
            const chosenSeg = room.botEngine.chooseMeeplePlacement(room, botPlayer, move.x, move.y, availableSegs);

            if (chosenSeg && !chosenSeg.isOccupied) {
              this.placeMeeple(room.id, botPlayer.id, { segmentId: chosenSeg.id });
            } else {
              this.passMeeple(room.id, botPlayer.id);
            }

            if (this.io) {
              this.io.to(room.id).emit('room_updated', this.serializeRoom(room));
            }
          }
        } catch (botMeepleErr) {
          console.error('⚠️ Error en fase de meeple del bot:', botMeepleErr);
          this.passMeeple(room.id, botPlayer.id);
          if (this.io) this.io.to(room.id).emit('room_updated', this.serializeRoom(room));
        }
      }, 550);
    } catch (botErr) {
      console.error('⚠️ Error en turno del bot:', botErr);
      this.finishTurn(room);
      if (this.io) this.io.to(room.id).emit('room_updated', this.serializeRoom(room));
    }
  }

  // Sandbox Mode controls
  setSandboxMode(roomId, { sandboxMode, autoRules }) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    if (sandboxMode !== undefined) room.sandboxMode = !!sandboxMode;
    if (autoRules !== undefined) room.autoRules = !!autoRules;

    this.addLog(room, `Ajustes actualizados: Sandbox=${room.sandboxMode ? 'ON' : 'OFF'}, Reglas=${room.autoRules ? 'ON' : 'OFF'}.`);
    return { room: this.serializeRoom(room) };
  }

  adjustScore(roomId, { playerId, delta }) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const p = room.players.find(x => x.id === playerId);
    if (p) {
      p.score = Math.max(0, p.score + delta);
      this.addLog(room, `Puntos de ${p.name} modificados (${delta > 0 ? '+' : ''}${delta}).`);
    }

    return { room: this.serializeRoom(room) };
  }

  adjustMeeples(roomId, { playerId, delta }) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    const p = room.players.find(x => x.id === playerId);
    if (p) {
      p.meeples = Math.max(0, Math.min(8, p.meeples + delta));
      this.addLog(room, `Meeples de ${p.name} ajustados a ${p.meeples}.`);
    }

    return { room: this.serializeRoom(room) };
  }

  saveGame(roomId, saveName) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Sala no encontrada' };

    // Determine consistent save name without random timestamps to prevent duplicate files
    let chosenName = (saveName || room.saveFileName || room.name || `partida_${room.id}`).trim();
    if (chosenName.endsWith('.json')) chosenName = chosenName.replace(/\.json$/i, '');
    const safeName = chosenName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = safeName + '.json';
    const filePath = path.join(SAVES_DIR, fileName);

    room.saveFileName = safeName;

    const saveData = {
      id: room.id,
      name: room.name,
      saveFileName: safeName,
      savedAt: new Date().toISOString(),
      status: room.status,
      players: room.players,
      turnIndex: room.turnIndex,
      turnNumber: room.turnNumber,
      turnPhase: room.turnPhase,
      currentTile: room.currentTile,
      currentRotation: room.currentRotation,
      sandboxMode: room.sandboxMode,
      autoRules: room.autoRules,
      includeRiver: room.includeRiver,
      board: room.board.toJSON(),
      deckRemaining: room.deck ? {
        deck: room.deck.deck,
        riverDeck: room.deck.riverDeck
      } : null,
      logs: room.logs
    };

    fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
    this.addLog(room, `Partida guardada como "${fileName}".`);
    return { success: true, fileName, room: this.serializeRoom(room) };
  }

  loadGame(saveName) {
    const safeName = path.basename(saveName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const baseSaveName = fileName.replace(/\.json$/i, '');
    const filePath = path.join(SAVES_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return { error: 'Archivo de guardado no encontrado' };
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const saveData = JSON.parse(raw);

    // Check if a room with this save file is already active to prevent duplicate rooms
    for (const existingRoom of this.rooms.values()) {
      if (existingRoom.saveFileName === baseSaveName || (saveData.id && existingRoom.id === saveData.id)) {
        return { success: true, room: this.serializeRoom(existingRoom), reconnected: true };
      }
    }

    const room = this.createRoom({
      name: saveData.name || 'Partida Cargada',
      options: {
        sandboxMode: saveData.sandboxMode,
        autoRules: saveData.autoRules,
        includeRiver: saveData.includeRiver,
        saveFileName: baseSaveName
      }
    });

    room.saveFileName = baseSaveName;
    room.status = saveData.status;
    room.players = saveData.players || [];
    room.turnIndex = saveData.turnIndex || 0;
    room.turnNumber = saveData.turnNumber || 1;
    room.turnPhase = saveData.turnPhase || 'place_tile';
    room.currentTile = saveData.currentTile;
    room.currentRotation = saveData.currentRotation || 0;
    room.board = Board.fromJSON(saveData.board);
    room.rules = new Rules(room.board);
    room.graph = new BoardGraph(room.board);
    room.logs = saveData.logs || [];

    if (saveData.deckRemaining) {
      room.deck = new TileDeck({ includeRiver: saveData.includeRiver });
      room.deck.deck = saveData.deckRemaining.deck || [];
      room.deck.riverDeck = saveData.deckRemaining.riverDeck || [];
    }

    // Auto-heal player meeples if corrupted: 7 starting minus active meeples on board
    if (!room.sandboxMode && room.board && room.players) {
      const placedByPlayer = {};
      for (const pt of room.board.grid.values()) {
        if (pt.meeple && pt.meeple.player) {
          placedByPlayer[pt.meeple.player] = (placedByPlayer[pt.meeple.player] || 0) + 1;
        }
      }
      room.players.forEach(p => {
        const placed = placedByPlayer[p.id] || 0;
        const expectedInHand = Math.max(0, 7 - placed);
        if (p.meeples !== expectedInHand) {
          console.log(`[Auto-Heal] Corrigiendo meeples de ${p.name}: tenía ${p.meeples}, ajustado a ${expectedInHand} (${placed} colocados en tablero).`);
          p.meeples = expectedInHand;
        }
      });
    }

    this.addLog(room, `Partida "${fileName}" cargada.`);
    return { room: this.serializeRoom(room) };
  }

  deleteGame(saveName) {
    const safeName = path.basename(saveName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const filePath = path.join(SAVES_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { error: 'Archivo de guardado no encontrado' };
  }

  listSavedGames() {
    if (!fs.existsSync(SAVES_DIR)) return [];
    return fs.readdirSync(SAVES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(SAVES_DIR, f));
        return {
          name: f,
          size: stats.size,
          updatedAt: stats.mtime
        };
      });
  }

  addLog(room, message) {
    const item = { time: new Date().toLocaleTimeString(), text: message };
    room.logs.push(item);
    if (room.logs.length > 50) room.logs.shift();
  }

  getPlayerName(room, pid) {
    const p = room.players.find(x => x.id === pid);
    return p ? p.name : 'Jugador';
  }

  /**
   * Builds enriched replay context for AI training.
   * Captures current scores, meeple counts, deck size, and a compact board snapshot.
   * @param {object} room  - The room object
   * @param {object|null} player - Active player (for scoreDelta calculation)
   * @param {object|null} reasoning - Bot reasoning object (if applicable)
   */
  _buildReplayContext(room, player, reasoning) {
    const scoresBefore = Object.fromEntries(room.players.map(p => [p.id, p.score]));
    const meeplesState = Object.fromEntries(room.players.map(p => [p.id, p.meeples]));
    const deckRemaining = room.deck ? room.deck.remainingCount() : 0;
    const boardSnapshot = this._buildBoardSnapshot(room);
    return {
      scoresBefore,
      scoresAfter: null,    // updated post-scoring in finishTurn if needed
      scoreDelta: null,     // computed in finishTurn
      meeplesState,
      deckRemaining,
      boardSnapshot,
      legalPlacements: null,  // filled by caller when relevant
      reasoning: reasoning || null
    };
  }

  /**
   * Builds a compact board snapshot: array of placed tiles with position, tile id, rotation, and meeple.
   * Kept compact to avoid bloating replay files too much.
   */
  _buildBoardSnapshot(room) {
    if (!room.board || !room.board.grid) return [];
    const snapshot = [];
    for (const [key, pt] of room.board.grid.entries()) {
      if (!pt || !pt.tile) continue;
      snapshot.push({
        x: pt.x,
        y: pt.y,
        tileId: pt.tile.id,
        rotation: pt.rotation || 0,
        meeple: pt.meeple ? { player: pt.meeple.player, segmentId: pt.meeple.segmentId, color: pt.meeple.color } : null
      });
    }
    return snapshot;
  }

  serializeRoom(room) {
    const validPlacements = (room.status === 'playing' && room.currentTile)
      ? room.board.getValidPlacements(room.currentTile, room.autoRules && !room.sandboxMode)
      : [];

    let availableSegments = [];
    if (room.status === 'playing' && room.turnPhase === 'place_meeple' && room.lastPlacedPos) {
      const placedTile = room.board.getTile(room.lastPlacedPos.x, room.lastPlacedPos.y);
      if (placedTile) {
        availableSegments = (placedTile.tile.segments || []).filter(seg => !seg.noMeeple && seg.type !== 'river').map(seg => {
          const occCheck = (room.autoRules && !room.sandboxMode)
            ? room.graph.isSegmentOccupied(room.lastPlacedPos.x, room.lastPlacedPos.y, placedTile.tile, placedTile.rotation, seg.id)
            : { occupied: false };

          let friendlyError = null;
          if (occCheck.occupied) {
            friendlyError = occCheck.error || 'Estructura ya ocupada';
            (room.players || []).forEach(p => {
              if (p && p.id && p.name) {
                friendlyError = friendlyError.replace(new RegExp(p.id, 'g'), p.name);
              }
            });
          }

          return {
            ...seg,
            pos: rotatePoint(seg.pos, placedTile.rotation),
            isOccupied: !!occCheck.occupied,
            occupiedError: friendlyError
          };
        });
      }
    }

    const playerColors = PLAYER_COLORS.map(c => ({
      ...c,
      isTaken: room.players.some(p => p.color === c.id),
      takenBy: (room.players.find(p => p.color === c.id) || {}).name || null
    }));

    const playerSounds = TURN_SOUNDS.map(s => ({
      ...s,
      isTaken: room.players.some(p => p.sound === s.id),
      takenBy: (room.players.find(p => p.sound === s.id) || {}).name || null
    }));

    const rankings = room.status === 'ended'
      ? [...room.players].sort((a, b) => b.score - a.score)
      : [];

    const nextTile = (room.deck && room.status === 'playing') ? room.deck.peekTile() : null;

    return {
      id: room.id,
      name: room.name,
      status: room.status,
      isLocal: !!room.isLocal,
      turnIndex: room.turnIndex,
      turnNumber: room.turnNumber,
      turnPhase: room.turnPhase,
      lastPlacedPos: room.lastPlacedPos,
      activePlayer: room.players[room.turnIndex] || null,
      players: room.players,
      playerColors,
      playerSounds,
      rankings,
      currentTile: room.currentTile,
      nextTile,
      currentRotation: room.currentRotation,
      validPlacements,
      availableSegments,
      remainingTiles: room.deck ? room.deck.remainingCount() : 0,
      board: room.board.toJSON(),
      sandboxMode: room.sandboxMode,
      autoRules: room.autoRules,
      includeRiver: room.includeRiver,
      lastReplayId: room.lastReplayId || null,
      logs: room.logs
    };
  }
}

module.exports = RoomManager;
