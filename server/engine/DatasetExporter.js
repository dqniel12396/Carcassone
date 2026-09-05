const fs = require('fs');
const path = require('path');

// ============================================================
// DatasetExporter.js — Exportador de Datasets para IA
// Convierte replays de Carcassonne a formato JSONL para RL/IL
// Formato: { state, action, reward, isWinnerMove, metadata }
// ============================================================

const REPLAYS_DIR = path.join(__dirname, '../../data/replays');

class DatasetExporter {

  /**
   * Exports a single replay to an array of (state, action, reward) training samples.
   * Each sample represents one decision made by a player.
   * @param {string} replayId
   * @returns {{ samples: Array, meta: object } | { error: string }}
   */
  exportReplay(replayId) {
    const safeName = path.basename(replayId).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = safeName.endsWith('.json') ? safeName : (safeName + '.json');
    const filePath = path.join(REPLAYS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return { error: 'Replay no encontrado: ' + replayId };
    }

    let replay;
    try {
      replay = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return { error: 'Error leyendo replay: ' + e.message };
    }

    return this._replayToSamples(replay);
  }

  /**
   * Exports all replays to a single JSONL string.
   * @param {object} opts { onlyWinners: bool, onlyBots: bool, minTurns: number }
   */
  exportAllToJSONL(opts = {}) {
    const { onlyWinners = false, onlyBots = false, minTurns = 5 } = opts;
    if (!fs.existsSync(REPLAYS_DIR)) return '';

    const files = fs.readdirSync(REPLAYS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('test'));
    const lines = [];

    for (const file of files) {
      try {
        const replay = JSON.parse(fs.readFileSync(path.join(REPLAYS_DIR, file), 'utf8'));
        if (replay.totalTurns < minTurns) continue;

        const { samples } = this._replayToSamples(replay);

        for (const sample of samples) {
          if (onlyBots && !sample.metadata.isBot) continue;
          if (onlyWinners && !sample.isWinnerMove) continue;
          lines.push(JSON.stringify(sample));
        }
      } catch (e) {
        // skip broken replays
      }
    }

    return lines.join('\n');
  }

  /**
   * Core conversion: replay actions -> RL training samples
   */
  _replayToSamples(replay) {
    const samples = [];

    // Determine winners for winner-move labeling
    const winners = new Set((replay.players || []).filter(p => p.isWinner).map(p => p.id));
    const playerMap = {};
    (replay.players || []).forEach(p => { playerMap[p.id] = p; });

    // Process only tile placement actions (key decision point)
    const tileActions = (replay.actions || []).filter(a => a.type === 'place_tile');
    const meepleActions = (replay.actions || []).filter(a => a.type === 'place_meeple' || a.type === 'pass_meeple');

    for (const action of tileActions) {
      const turn = action.turn;
      const player = playerMap[action.playerId];

      // Find corresponding meeple action for this turn
      const meepleAct = meepleActions.find(m => m.turn === turn && m.playerId === action.playerId);

      // Build state representation
      const state = {
        turn,
        deckRemaining: action.deckRemaining,
        boardSnapshot: action.boardSnapshot || [],
        currentTile: action.details ? {
          id: action.details.tileId,
          image: action.details.tileImage,
          edges: action.details.tile ? action.details.tile.edges : null,
          segments: action.details.tile ? action.details.tile.segments : null
        } : null,
        scores: action.scoresBefore || {},
        meeplesLeft: action.meeplesState || {},
        legalPlacements: action.legalPlacements || null
      };

      // Build action representation
      const actionData = {
        x: action.details ? action.details.x : null,
        y: action.details ? action.details.y : null,
        rotation: action.details ? action.details.rotation : null,
        meepleSegment: meepleAct && meepleAct.type === 'place_meeple' ? meepleAct.details.segmentId : null,
        meepleType: meepleAct && meepleAct.type === 'place_meeple' ? meepleAct.details.segmentType : null,
        placedMeeple: !!(meepleAct && meepleAct.type === 'place_meeple')
      };

      // Reward: score delta for this player from this action
      const scoreBefore = action.scoresBefore ? (action.scoresBefore[action.playerId] || 0) : 0;
      const scoreAfter = action.scoresAfter ? (action.scoresAfter[action.playerId] || scoreBefore) : scoreBefore;
      const reward = scoreAfter - scoreBefore;

      samples.push({
        state,
        action: actionData,
        reward,
        isWinnerMove: winners.has(action.playerId),
        metadata: {
          replayId: replay.id,
          turn,
          playerId: action.playerId,
          playerName: action.playerName,
          playerColor: action.playerColor,
          isBot: action.isBot || false,
          botDifficulty: player ? (player.difficulty || null) : null,
          botReasoning: action.reasoning || null,
          gameDurationMinutes: replay.durationMinutes || 0,
          totalTurns: replay.totalTurns || 0
        }
      });
    }

    const meta = {
      replayId: replay.id,
      totalSamples: samples.length,
      winners: Array.from(winners),
      players: replay.players || [],
      exportedAt: new Date().toISOString()
    };

    return { samples, meta };
  }

  /**
   * Get statistics about available training data
   */
  getDatasetStats() {
    if (!fs.existsSync(REPLAYS_DIR)) return { totalReplays: 0, totalSamples: 0 };
    const files = fs.readdirSync(REPLAYS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('test'));
    let totalSamples = 0;
    let botSamples = 0;
    let humanSamples = 0;
    let winnerSamples = 0;

    for (const file of files) {
      try {
        const replay = JSON.parse(fs.readFileSync(path.join(REPLAYS_DIR, file), 'utf8'));
        const { samples } = this._replayToSamples(replay);
        totalSamples += samples.length;
        botSamples += samples.filter(s => s.metadata.isBot).length;
        humanSamples += samples.filter(s => !s.metadata.isBot).length;
        winnerSamples += samples.filter(s => s.isWinnerMove).length;
      } catch (e) {}
    }

    return {
      totalReplays: files.length,
      totalSamples,
      botSamples,
      humanSamples,
      winnerSamples,
      winnerRatio: totalSamples > 0 ? (winnerSamples / totalSamples).toFixed(3) : 0
    };
  }
}

module.exports = new DatasetExporter();
