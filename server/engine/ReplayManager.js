const fs = require('fs');
const path = require('path');

// ============================================================
// ReplayManager v2.0 — Full Traceability for AI Training
// Captures: board snapshots, score deltas, legal placements,
//           bot reasoning, per-action context
// ============================================================

const REPLAYS_DIR = path.join(__dirname, '..', '..', 'data', 'replays');
if (!fs.existsSync(REPLAYS_DIR)) {
  fs.mkdirSync(REPLAYS_DIR, { recursive: true });
}

class ReplayManager {
  constructor() {
    this.activeRecordings = new Map();
  }

  startRecording(room) {
    const replayId = 'rep_' + (room.id || Math.random().toString(36).substring(2, 8)) + '_' + Date.now();
    const recording = {
      id: replayId,
      roomId: room.id,
      name: room.name || 'Partida de Carcassonne',
      startedAt: Date.now(),
      endedAt: null,
      durationMinutes: 0,
      totalTurns: 0,
      includeRiver: !!room.includeRiver,
      isLocal: !!room.isLocal,
      players: (room.players || []).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isBot: !!p.isBot,
        difficulty: p.difficulty || null,
        score: 0,
        meeples: 7
      })),
      actions: [],
      completedFeaturesSummary: [],
      scoreHistory: [],
      analysis: null,
      // Metadata for AI training dataset compatibility
      trainingMetadata: {
        version: '2.0',
        hasFullBoardState: true,
        hasLegalPlacements: true,
        hasBotReasoning: true,
        hasScoreDeltas: true
      }
    };
    this.activeRecordings.set(room.id, recording);
    return recording;
  }

  getRecording(roomId) {
    return this.activeRecordings.get(roomId) || null;
  }

  /**
   * Graba una acción enriquecida con todo el contexto de estado para IA
   * @param {string} roomId
   * @param {object} player
   * @param {string} type  'place_tile' | 'place_meeple' | 'pass_meeple' | 'feature_scored' | 'start_tile'
   * @param {object} details  Datos propios de la acción
   * @param {object} context  Contexto rico: {boardState, scoresBefore, scoresAfter, meeplesState, deckRemaining, legalPlacements, reasoning}
   */
  recordAction(roomId, player, type, details = {}, context = {}) {
    const rec = this.activeRecordings.get(roomId);
    if (!rec) return;

    const action = {
      turn: details.turnNumber || (rec.actions.length + 1),
      timestamp: Date.now(),
      playerId: player ? player.id : null,
      playerName: player ? player.name : 'Sistema',
      playerColor: player ? player.color : null,
      isBot: player ? !!player.isBot : false,
      type,
      details,
      // === CONTEXT RICO PARA IA ===
      scoresBefore: context.scoresBefore || null,
      scoresAfter: context.scoresAfter || null,
      scoreDelta: context.scoreDelta || null,
      meeplesState: context.meeplesState || null,
      deckRemaining: context.deckRemaining !== undefined ? context.deckRemaining : null,
      boardSnapshot: context.boardSnapshot || null,
      legalPlacements: context.legalPlacements || null,
      reasoning: context.reasoning || null,
    };

    rec.actions.push(action);
    if (details.turnNumber) rec.totalTurns = Math.max(rec.totalTurns, details.turnNumber);

    // Guardar historial de puntajes por turno al colocar loseta
    if (context.scoresBefore && type === 'place_tile') {
      rec.scoreHistory.push({
        turn: action.turn,
        scores: context.scoresBefore
      });
    }
  }

  recordFeatureScored(roomId, feature) {
    const rec = this.activeRecordings.get(roomId);
    if (!rec) return;

    rec.completedFeaturesSummary.push({
      name: feature.name || feature.type,
      type: feature.type,
      points: feature.points,
      winners: feature.winners,
      tileCount: feature.tileCount || 0
    });
  }

  finalizeRecording(room) {
    let rec = this.activeRecordings.get(room.id);
    if (!rec) {
      rec = this.startRecording(room);
    }

    rec.endedAt = Date.now();
    rec.durationMinutes = Math.max(1, Math.round((rec.endedAt - rec.startedAt) / 60000));
    rec.totalTurns = room.turnNumber || rec.actions.length;

    // Calculate final player results
    const rankings = [...room.players].sort((a, b) => b.score - a.score);
    const topScore = rankings[0]?.score || 0;

    rec.players = room.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isBot: !!p.isBot,
      difficulty: p.difficulty || null,
      score: p.score,
      meeples: p.meeples,
      isWinner: p.score === topScore && topScore > 0
    }));

    // Final score history snapshot
    rec.scoreHistory.push({
      turn: rec.totalTurns,
      scores: Object.fromEntries(room.players.map(p => [p.id, p.score]))
    });

    // Aggregate summary stats for quick UI overview and AI analysis
    rec.summary = this._computeSummary(rec);

    // Save to permanent JSON file
    const filePath = path.join(REPLAYS_DIR, `${rec.id}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(rec, null, 2), 'utf8');
      console.log(`📹 Partida guardada en Replay: ${rec.id}.json`);
    } catch (e) {
      console.error('⚠️ Error guardando replay:', e);
    }

    this.activeRecordings.delete(room.id);
    return rec;
  }

  /**
   * Computes aggregate summary statistics for the replay (called on finalize)
   */
  _computeSummary(rec) {
    const tilePlacements = rec.actions.filter(a => a.type === 'place_tile').length;
    const meeplesPlacements = rec.actions.filter(a => a.type === 'place_meeple').length;
    const meeplesPasses = rec.actions.filter(a => a.type === 'pass_meeple').length;
    const botActions = rec.actions.filter(a => a.isBot && a.type === 'place_tile').length;
    const humanActions = tilePlacements - botActions;

    const playerStats = {};
    rec.players.forEach(p => {
      const pActions = rec.actions.filter(a => a.playerId === p.id);
      playerStats[p.id] = {
        name: p.name,
        color: p.color,
        isBot: p.isBot,
        tilesPlaced: pActions.filter(a => a.type === 'place_tile').length,
        meeplesPlaced: pActions.filter(a => a.type === 'place_meeple').length,
        meeplesPassed: pActions.filter(a => a.type === 'pass_meeple').length,
        finalScore: p.score,
        isWinner: p.isWinner
      };
    });

    return {
      totalTilePlacements: tilePlacements,
      totalMeeplePlacements: meeplesPlacements,
      totalMeeplesPassed: meeplesPasses,
      botTurns: botActions,
      humanTurns: humanActions,
      featuresCompleted: rec.completedFeaturesSummary.length,
      playerStats
    };
  }

  listReplays(limit = 20) {
    if (!fs.existsSync(REPLAYS_DIR)) return [];
    try {
      return fs.readdirSync(REPLAYS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const filePath = path.join(REPLAYS_DIR, f);
          const stats = fs.statSync(filePath);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
              id: data.id || f.replace('.json', ''),
              name: data.name || 'Partida',
              startedAt: data.startedAt,
              durationMinutes: data.durationMinutes || 1,
              totalTurns: data.totalTurns || 0,
              players: (data.players || []).map(p => ({ name: p.name, color: p.color, score: p.score, isWinner: p.isWinner, isBot: p.isBot })),
              hasAnalysis: !!data.analysis,
              hasFullBoardState: !!(data.trainingMetadata && data.trainingMetadata.hasFullBoardState),
              summary: data.summary || null,
              updatedAt: stats.mtime
            };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    } catch (e) {
      return [];
    }
  }

  getReplay(replayId) {
    const safeName = path.basename(replayId).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const filePath = path.join(REPLAYS_DIR, fileName);

    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  saveReplayAnalysis(replayId, analysisText) {
    const replay = this.getReplay(replayId);
    if (!replay) return false;

    replay.analysis = analysisText;
    const safeName = path.basename(replayId).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const filePath = path.join(REPLAYS_DIR, fileName);

    try {
      fs.writeFileSync(filePath, JSON.stringify(replay, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }

  deleteReplay(replayId) {
    const safeName = path.basename(replayId).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const filePath = path.join(REPLAYS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Crónica no encontrada' };
    }
    try {
      fs.unlinkSync(filePath);
      return { success: true, message: 'Crónica eliminada correctamente' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = new ReplayManager();
