// Intelligent Bot Engine for Carcassonne
// Evaluates tile placements, feature completion, meeple ROI, and territory control.
// Weights are loaded from data/bot_weights.json for continuous improvement.

const { rotatePoint } = require('./TileDeck');
const path = require('path');
const fs = require('fs');

const WEIGHTS_PATH = path.join(__dirname, '../../data/bot_weights.json');

// Default weights in case the file doesn't exist
const DEFAULT_WEIGHTS = {
  cityValue: 6,
  roadValue: 3,
  monasteryValue: 10,
  fieldValue: 2,
  fieldLateGameValue: 12,
  completionBonus: 20,
  completionMeepleRecoveryBonus: 30,
  monasteryNeighborBonus: 10,
  monasteryOpponentPenalty: 2,
  monasteryNewPlacementBonus: 4,
  blockingPenalty: 4,
  blockingPenaltyEasy: 2,
  centerBoardBonus: 8,
  expandOwnCityMultiplier: 6,
  expandOwnRoadMultiplier: 3,
  meepleThresholdLowTiles: 25,
  meepleReservationTiles: 15
};

// Load weights once at module level (shared across all instances)
let cachedWeights = null;
let weightsLoadedAt = 0;

function loadWeights() {
  try {
    const now = Date.now();
    // Reload every 30 seconds to pick up training changes
    if (cachedWeights && (now - weightsLoadedAt) < 30000) return cachedWeights;
    const raw = fs.readFileSync(WEIGHTS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    cachedWeights = { ...DEFAULT_WEIGHTS, ...(parsed.weights || {}) };
    weightsLoadedAt = now;
    return cachedWeights;
  } catch (e) {
    return DEFAULT_WEIGHTS;
  }
}

function saveWeights(newWeights, meta = {}) {
  try {
    const dataDir = path.dirname(WEIGHTS_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    let existing = { weights: {}, difficulty: {}, trainingSessions: 0, lastTrainedAt: null };
    try { existing = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8')); } catch (_) {}
    existing.weights = { ...(existing.weights || {}), ...newWeights };
    existing.trainingSessions = (existing.trainingSessions || 0) + 1;
    existing.lastTrainedAt = new Date().toISOString();
    if (meta.method) existing.lastTrainingMethod = meta.method;
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(existing, null, 2), 'utf8');
    cachedWeights = null; // Invalidate cache
    console.log(`✅ Pesos del bot actualizados (sesión #${existing.trainingSessions}).`);
    return true;
  } catch (e) {
    console.error('❌ Error guardando pesos del bot:', e.message);
    return false;
  }
}

class BotEngine {
  constructor(rules, graph) {
    this.rules = rules;
    this.graph = graph;
    this.lastReasoning = null; // Populated after each chooseMove() for replay traceability
  }

  // Expose weights path for BotTrainer
  static get WEIGHTS_PATH() { return WEIGHTS_PATH; }

  // Reload weights dynamically (called before each evaluation)
  getWeights() {
    return loadWeights();
  }

  // Choose the best move for a bot player
  chooseMove(room, botPlayer) {
    const tile = room.currentTile;
    if (!tile) return null;

    const validPlacements = room.board.getValidPlacements(tile, true);
    if (validPlacements.length === 0) {
      this.lastReasoning = { decision: 'discard', reason: 'No legal placements found for this tile', topCandidates: [] };
      return { action: 'discard' };
    }

    const difficulty = botPlayer.difficulty || 'medium';
    let move;

    if (difficulty === 'easy') {
      move = this.chooseEasyMove(room, botPlayer, validPlacements);
    } else if (difficulty === 'hard') {
      move = this.chooseHardMove(room, botPlayer, validPlacements);
    } else {
      move = this.chooseMediumMove(room, botPlayer, validPlacements);
    }

    return move;
  }

  // Easy: Plays casual moves but captures immediate completed features
  chooseEasyMove(room, botPlayer, validPlacements) {
    // 1. Check if any move immediately completes a feature
    for (const slot of validPlacements) {
      for (const rot of slot.validRotations) {
        room.board.placeTile(slot.x, slot.y, room.currentTile, rot, botPlayer.id);
        const scoring = room.rules.checkCompletedFeatures(slot.x, slot.y, false);
        room.board.removeTile(slot.x, slot.y);
        if (scoring.totalPointsByPlayer[botPlayer.id] && scoring.totalPointsByPlayer[botPlayer.id] > 0) {
          const pts = scoring.totalPointsByPlayer[botPlayer.id];
          this.lastReasoning = {
            difficulty: 'easy',
            decision: `Placed at (${slot.x},${slot.y}) rot ${rot} — completes feature for ${pts} pts`,
            topCandidates: [{ x: slot.x, y: slot.y, rotation: rot, score: pts, reason: 'feature_completion' }]
          };
          return { x: slot.x, y: slot.y, rotation: rot };
        }
      }
    }
    // 2. Otherwise pick a casual random valid placement
    const slot = validPlacements[Math.floor(Math.random() * validPlacements.length)];
    const rot = slot.validRotations[Math.floor(Math.random() * slot.validRotations.length)];
    this.lastReasoning = {
      difficulty: 'easy',
      decision: `Random placement at (${slot.x},${slot.y}) rot ${rot}`,
      topCandidates: [{ x: slot.x, y: slot.y, rotation: rot, score: 0, reason: 'random' }]
    };
    return { x: slot.x, y: slot.y, rotation: rot };
  }

  // Medium: Greedy heuristic evaluating immediate points and available features
  chooseMediumMove(room, botPlayer, validPlacements) {
    let bestScore = -999;
    let bestMove = null;
    const candidates = [];

    for (const slot of validPlacements) {
      for (const rot of slot.validRotations) {
        const score = this.evaluatePlacementScore(room, botPlayer, slot.x, slot.y, rot, 'medium');
        candidates.push({ x: slot.x, y: slot.y, rotation: rot, score });
        if (score > bestScore) {
          bestScore = score;
          bestMove = { x: slot.x, y: slot.y, rotation: rot, score };
        }
      }
    }

    if (!bestMove) {
      const slot = validPlacements[0];
      bestMove = { x: slot.x, y: slot.y, rotation: slot.validRotations[0] };
    }

    // Sort and keep top 10 candidates for reasoning
    candidates.sort((a, b) => b.score - a.score);
    this.lastReasoning = {
      difficulty: 'medium',
      decision: `Greedy best at (${bestMove.x},${bestMove.y}) rot ${bestMove.rotation} score=${bestScore.toFixed(1)}`,
      topCandidates: candidates.slice(0, 10)
    };

    return bestMove;
  }

  // Hard: Advanced heuristic with opponent blocking and territory control
  chooseHardMove(room, botPlayer, validPlacements) {
    let bestScore = -9999;
    let bestMove = null;
    const candidates = [];

    for (const slot of validPlacements) {
      for (const rot of slot.validRotations) {
        const score = this.evaluatePlacementScore(room, botPlayer, slot.x, slot.y, rot, 'hard');
        candidates.push({ x: slot.x, y: slot.y, rotation: rot, score });
        if (score > bestScore) {
          bestScore = score;
          bestMove = { x: slot.x, y: slot.y, rotation: rot, score };
        }
      }
    }

    if (!bestMove) {
      const slot = validPlacements[0];
      bestMove = { x: slot.x, y: slot.y, rotation: slot.validRotations[0] };
    }

    // Sort and keep top 10 candidates for reasoning
    candidates.sort((a, b) => b.score - a.score);
    this.lastReasoning = {
      difficulty: 'hard',
      decision: `Advanced best at (${bestMove.x},${bestMove.y}) rot ${bestMove.rotation} score=${bestScore.toFixed(1)}`,
      topCandidates: candidates.slice(0, 10)
    };

    return bestMove;
  }

  // Evaluates a candidate tile placement using configurable weights
  evaluatePlacementScore(room, botPlayer, x, y, rot, difficulty) {
    const W = this.getWeights(); // Load dynamic weights
    let score = 0;
    const tile = room.currentTile;

    // Simulate placing tile temporarily on board
    room.board.placeTile(x, y, tile, rot, botPlayer.id);

    try {
      // 1. Immediate completed features
      const scoringResult = room.rules.checkCompletedFeatures(x, y, false);
      if (scoringResult.totalPointsByPlayer[botPlayer.id]) {
        const pts = scoringResult.totalPointsByPlayer[botPlayer.id];
        score += pts * W.completionBonus;
        // Strong bonus when low on meeples to recover them
        if (botPlayer.meeples <= 1) score += W.completionMeepleRecoveryBonus;
      }

      // If completing opponents' features, penalize
      Object.entries(scoringResult.totalPointsByPlayer).forEach(([pid, pts]) => {
        if (pid !== botPlayer.id) {
          score -= pts * (difficulty === 'hard' ? W.blockingPenalty : W.blockingPenaltyEasy);
        }
      });

      // 2. Monasteries nearby (supporting own or penalizing helping opponent)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const neighbor = room.board.getTile(x + dx, y + dy);
          if (neighbor && neighbor.tile.monastery && neighbor.meeple) {
            if (neighbor.meeple.player === botPlayer.id) {
              score += W.monasteryNeighborBonus;
            } else if (difficulty === 'hard') {
              score -= W.monasteryOpponentPenalty;
            }
          }
        }
      }

      // 3. New monastery placement value
      if (tile.monastery) {
        let surroundingCount = 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (room.board.getTile(x + dx, y + dy)) surroundingCount++;
          }
        }
        score += surroundingCount * W.monasteryNewPlacementBonus;
      }

      // 4. Feature size / expansion heuristic
      const remainingTiles = room.deck ? room.deck.remainingCount() : 30;
      const segments = tile.segments || [];
      for (const seg of segments) {
        if (seg.noMeeple || seg.type === 'river') continue;
        try {
          const feat = this.graph.getConnectedFeature(x, y, seg.type, seg.id);
          const myMeeples = feat.meeples.filter(m => m.player === botPlayer.id).length;
          const oppMeeples = feat.meeples.filter(m => m.player !== botPlayer.id).length;

          const segW = seg.type === 'city' ? W.expandOwnCityMultiplier
            : seg.type === 'road' ? W.expandOwnRoadMultiplier
            : seg.type === 'monastery' ? W.monasteryValue
            : (remainingTiles < W.meepleThresholdLowTiles && difficulty === 'hard') ? W.fieldLateGameValue
            : W.fieldValue;

          if (myMeeples > 0 && myMeeples >= oppMeeples) {
            score += segW * feat.tiles.length;
          } else if (oppMeeples > myMeeples && difficulty === 'hard') {
            if (!feat.isComplete) score -= 2;
          }
        } catch (_) {}
      }

      // 5. Positional center bias
      score += Math.max(0, W.centerBoardBonus - Math.hypot(x, y));

    } finally {
      room.board.removeTile(x, y);
    }

    return score;
  }

  // Choose the best segment to place a meeple after placing tile
  chooseMeeplePlacement(room, botPlayer, x, y, availableSegments) {
    const W = this.getWeights();
    if (botPlayer.meeples <= 0) return null;

    const freeSegments = availableSegments.filter(s => !s.noMeeple && s.type !== 'river' && !s.isOccupied);
    if (freeSegments.length === 0) return null;

    const remainingTiles = room.deck ? room.deck.remainingCount() : 0;
    const difficulty = botPlayer.difficulty || 'medium';

    // Meeple reservation: if only 1 left and many tiles remain, be conservative
    if (botPlayer.meeples === 1 && remainingTiles > W.meepleReservationTiles && difficulty !== 'easy') {
      const highValue = freeSegments.find(s => s.type === 'monastery' || s.type === 'city');
      if (!highValue) return null;
    }

    let bestScore = -1;
    let bestSeg = null;

    for (const seg of freeSegments) {
      let val = 0;
      if (seg.type === 'monastery') {
        val = W.monasteryValue;
      } else if (seg.type === 'city') {
        val = W.cityValue * 2;
      } else if (seg.type === 'road') {
        val = W.roadValue * 2.5;
      } else if (seg.type === 'field') {
        val = (remainingTiles < W.meepleThresholdLowTiles && difficulty === 'hard')
          ? W.fieldLateGameValue
          : W.fieldValue;
      }

      if (val > bestScore) {
        bestScore = val;
        bestSeg = seg;
      }
    }

    // Load difficulty-specific threshold from weights config
    let thresholdKey;
    try {
      const raw = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
      const diff = raw.difficulty || {};
      thresholdKey = (diff[difficulty] || {}).meepleThreshold;
    } catch (_) {}
    const threshold = thresholdKey !== undefined ? thresholdKey : (difficulty === 'hard' ? 7 : difficulty === 'medium' ? 5 : 2);

    if (bestScore >= threshold) return bestSeg;
    return null;
  }
}

// Export static helpers for training scripts
BotEngine.loadWeights = loadWeights;
BotEngine.saveWeights = saveWeights;
BotEngine.WEIGHTS_PATH = WEIGHTS_PATH;

module.exports = BotEngine;
