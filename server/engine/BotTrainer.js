// BotTrainer.js — Sistema de aprendizaje continuo del Bot de Carcassonne
// Fase 2: Imitation Learning desde replays
// Fase 4: Self-Play con hill-climbing de pesos

const fs = require('fs');
const path = require('path');
const BotEngine = require('./BotEngine');

const REPLAYS_DIR = path.join(__dirname, '../../data/replays');
const WEIGHTS_PATH = BotEngine.WEIGHTS_PATH;

class BotTrainer {
  constructor() {
    this.verbose = false;
  }

  log(...args) {
    if (this.verbose) console.log(...args);
  }

  // ============================================================
  // FASE 2: Imitation Learning — Aprender de replays ganados
  // ============================================================

  /**
   * Lee todos los replays y extrae estadísticas de qué tipos de acciones
   * producen más puntos y victorias. Ajusta los pesos hacia esas acciones.
   */
  learnFromReplays() {
    const results = { replaysAnalyzed: 0, patterns: {}, weightChanges: {}, skipped: 0 };

    // Acumuladores de estadísticas
    const stats = {
      cityCompletions: { count: 0, totalPoints: 0 },
      roadCompletions: { count: 0, totalPoints: 0 },
      monasteryCompletions: { count: 0, totalPoints: 0 },
      fieldFinalPoints: { count: 0, totalPoints: 0 },
      winnerMeepleEfficiency: [],   // ratio puntos/meeple_colocados ganadores
      loserMeepleEfficiency: [],
      winnerCityPref: 0,
      winnerRoadPref: 0,
      winnerMonasteryPref: 0,
      winnerFieldPref: 0,
      loserCityPref: 0,
      loserRoadPref: 0,
      totalGames: 0,
      botWins: 0
    };

    // Leer todos los archivos de replay
    let files = [];
    try {
      files = fs.readdirSync(REPLAYS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('test'));
    } catch (e) {
      return { error: 'No se encontraron replays en ' + REPLAYS_DIR };
    }

    if (files.length === 0) {
      return { error: 'No hay replays disponibles para aprender. ¡Juega algunas partidas primero!' };
    }

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(REPLAYS_DIR, file), 'utf8');
        const replay = JSON.parse(raw);

        if (!replay.players || replay.players.length < 2) { results.skipped++; continue; }
        if (!replay.actions || replay.actions.length < 10) { results.skipped++; continue; }

        results.replaysAnalyzed++;
        stats.totalGames++;

        const winner = replay.players.find(p => p.isWinner);
        const losers = replay.players.filter(p => !p.isWinner);

        // Analizar features completadas
        if (replay.completedFeaturesSummary) {
          for (const feat of replay.completedFeaturesSummary) {
            const isWinnerFeature = winner && feat.winners && feat.winners.includes(winner.name);
            if (feat.type === 'city') {
              stats.cityCompletions.count++;
              stats.cityCompletions.totalPoints += feat.points || 0;
              if (isWinnerFeature) stats.winnerCityPref++;
              else stats.loserCityPref++;
            } else if (feat.type === 'road') {
              stats.roadCompletions.count++;
              stats.roadCompletions.totalPoints += feat.points || 0;
              if (isWinnerFeature) stats.winnerRoadPref++;
              else stats.loserRoadPref++;
            } else if (feat.type === 'monastery') {
              stats.monasteryCompletions.count++;
              stats.monasteryCompletions.totalPoints += feat.points || 0;
            } else if (feat.type === 'field') {
              stats.fieldFinalPoints.count++;
              stats.fieldFinalPoints.totalPoints += feat.points || 0;
            }
          }
        }

        // Analizar eficiencia de meeples
        if (winner) {
          const winnerScore = winner.score || 0;
          const winnerMeepleActions = replay.actions.filter(
            a => a.action === 'place_meeple' && a.playerId === winner.id
          ).length;
          if (winnerMeepleActions > 0) {
            stats.winnerMeepleEfficiency.push(winnerScore / winnerMeepleActions);
          }
        }
        for (const loser of losers) {
          const loserScore = loser.score || 0;
          const loserMeepleActions = replay.actions.filter(
            a => a.action === 'place_meeple' && a.playerId === loser.id
          ).length;
          if (loserMeepleActions > 0) {
            stats.loserMeepleEfficiency.push(loserScore / loserMeepleActions);
          }
        }

        // Bot wins
        if (winner && winner.isBot) stats.botWins++;

      } catch (e) {
        results.skipped++;
      }
    }

    if (results.replaysAnalyzed === 0) {
      return { error: 'No se pudieron analizar replays válidos.' };
    }

    // ---- Calcular ajustes de pesos basados en patrones ----
    const current = BotEngine.loadWeights();
    const newWeights = { ...current };

    // Promedio de puntos por tipo de feature
    const avgCityPts = stats.cityCompletions.count > 0
      ? stats.cityCompletions.totalPoints / stats.cityCompletions.count : 0;
    const avgRoadPts = stats.roadCompletions.count > 0
      ? stats.roadCompletions.totalPoints / stats.roadCompletions.count : 0;
    const avgMonPts = stats.monasteryCompletions.count > 0
      ? stats.monasteryCompletions.totalPoints / stats.monasteryCompletions.count : 0;
    const avgFieldPts = stats.fieldFinalPoints.count > 0
      ? stats.fieldFinalPoints.totalPoints / stats.fieldFinalPoints.count : 0;

    // Ajustar cityValue según rendimiento real
    if (avgCityPts > 0) {
      const cityAdjust = Math.min(2, Math.max(-2, (avgCityPts - 10) * 0.15));
      newWeights.cityValue = Math.max(3, Math.min(12, current.cityValue + cityAdjust));
    }

    // Ajustar roadValue
    if (avgRoadPts > 0) {
      const roadAdjust = Math.min(1.5, Math.max(-1.5, (avgRoadPts - 5) * 0.1));
      newWeights.roadValue = Math.max(1, Math.min(8, current.roadValue + roadAdjust));
    }

    // Ajustar monasteryValue
    if (avgMonPts > 0) {
      const monAdjust = Math.min(2, Math.max(-2, (avgMonPts - 9) * 0.2));
      newWeights.monasteryValue = Math.max(6, Math.min(16, current.monasteryValue + monAdjust));
    }

    // Ajustar fieldLateGameValue si los campos dan muchos puntos al final
    if (avgFieldPts > 12) {
      newWeights.fieldLateGameValue = Math.min(20, current.fieldLateGameValue + 1);
    }

    // Si el bot pierde mucho, aumentar agresividad de bloqueo
    const botWinRate = stats.botWins / stats.totalGames;
    if (botWinRate < 0.4) {
      newWeights.blockingPenalty = Math.min(8, current.blockingPenalty + 0.5);
      newWeights.completionBonus = Math.min(30, current.completionBonus + 2);
    }

    // Eficiencia de meeples: si ganadores usan meeples más eficientemente, premiar colocación
    const avgWinnerEff = stats.winnerMeepleEfficiency.length > 0
      ? stats.winnerMeepleEfficiency.reduce((a, b) => a + b, 0) / stats.winnerMeepleEfficiency.length : 0;
    const avgLoserEff = stats.loserMeepleEfficiency.length > 0
      ? stats.loserMeepleEfficiency.reduce((a, b) => a + b, 0) / stats.loserMeepleEfficiency.length : 0;

    if (avgWinnerEff > avgLoserEff * 1.2) {
      // Ganadores son más selectivos al colocar meeples
      newWeights.completionMeepleRecoveryBonus = Math.min(50, current.completionMeepleRecoveryBonus + 3);
    }

    // Registrar cambios
    for (const key of Object.keys(newWeights)) {
      if (Math.abs(newWeights[key] - current[key]) > 0.01) {
        results.weightChanges[key] = { before: current[key], after: parseFloat(newWeights[key].toFixed(3)) };
      }
    }

    results.patterns = {
      replaysAnalyzed: results.replaysAnalyzed,
      avgCityPoints: parseFloat(avgCityPts.toFixed(1)),
      avgRoadPoints: parseFloat(avgRoadPts.toFixed(1)),
      avgMonasteryPoints: parseFloat(avgMonPts.toFixed(1)),
      avgFieldPoints: parseFloat(avgFieldPts.toFixed(1)),
      botWinRate: parseFloat((botWinRate * 100).toFixed(1)) + '%',
      winnerMeepleEfficiency: parseFloat(avgWinnerEff.toFixed(1))
    };

    BotEngine.saveWeights(newWeights, { method: 'imitation_learning' });
    return results;
  }

  // ============================================================
  // FASE 4: Self-Play — Torneo Evolutivo Campeón vs Retador
  // ============================================================

  /**
   * Simulates N competitive games between a Challenger (mutated weights)
   * and the Champion (incumbent baseline weights).
   * Uses competitive selection to evolve weights based on real win rates.
   */
  async selfPlayTrain({ games = 200, iterations = 5, onProgress = null }) {
    const summary = { iterations: [], bestWeights: null, bestWinRate: 0, promotions: 0 };
    let championWeights = { ...BotEngine.loadWeights() };
    summary.bestWeights = { ...championWeights };

    for (let iter = 0; iter < iterations; iter++) {
      // Generate a promising challenger genome using strategic mutations
      const challengerWeights = this._generateChallenger(championWeights, iter);

      // Run head-to-head match: Challenger (Bot A) vs Champion (Bot B)
      const results = await this._runCompetitiveMatch(games, challengerWeights, championWeights);
      const challengerWinRate = results.challengerWins / (results.challengerWins + results.championWins || 1);
      const avgPointDelta = (results.totalPointsChallenger - results.totalPointsChampion) / games;

      // Promotion condition: Challenger beats Champion with > 51.5% win rate or clear point advantage
      const isPromoted = challengerWinRate > 0.515 || (challengerWinRate >= 0.49 && avgPointDelta > 2.0);

      if (isPromoted) {
        championWeights = { ...challengerWeights };
        summary.bestWeights = { ...challengerWeights };
        summary.bestWinRate = parseFloat((challengerWinRate * 100).toFixed(1));
        summary.promotions++;
      }

      const iterResult = {
        iteration: iter + 1,
        totalIterations: iterations,
        games,
        challengerWins: results.challengerWins,
        championWins: results.championWins,
        draws: results.draws,
        winRate: parseFloat((challengerWinRate * 100).toFixed(1)) + '%',
        avgPointsChallenger: parseFloat((results.totalPointsChallenger / games).toFixed(1)),
        avgPointsChampion: parseFloat((results.totalPointsChampion / games).toFixed(1)),
        avgPointDelta: parseFloat(avgPointDelta.toFixed(1)),
        promoted: isPromoted,
        currentBestWeights: { ...championWeights }
      };

      summary.iterations.push(iterResult);
      if (onProgress) onProgress(iterResult);
    }

    // Save final champion weights found
    if (summary.bestWeights) {
      BotEngine.saveWeights(summary.bestWeights, { method: 'self_play_evolutionary' });
      summary.finalWeights = summary.bestWeights;
    }

    return summary;
  }

  async _runCompetitiveMatch(numGames, challengerWeights, championWeights) {
    const result = {
      challengerWins: 0,
      championWins: 0,
      draws: 0,
      totalPointsChallenger: 0,
      totalPointsChampion: 0
    };

    const { TileDeck } = require('./TileDeck');
    const Board = require('./Board');
    const Rules = require('./Rules');
    const BoardGraph = require('./BoardGraph');

    for (let g = 0; g < numGames; g++) {
      try {
        const deck = new TileDeck({ includeRiver: false });
        const board = new Board();
        const rules = new Rules(board);
        const graph = new BoardGraph(board);

        // Separate bot engine instances for Challenger and Champion
        const engineChallenger = new BotEngine(rules, graph);
        engineChallenger.getWeights = () => challengerWeights;

        const engineChampion = new BotEngine(rules, graph);
        engineChampion.getWeights = () => championWeights;

        // Place start tile
        if (deck.startTile) board.placeTile(0, 0, deck.startTile, 0, null);

        // Alternate starting player 50/50 to eliminate first-player advantage!
        const challengerStarts = g % 2 === 0;

        const players = [
          {
            id: 'challenger',
            name: 'Retador IA',
            color: challengerStarts ? 'red' : 'blue',
            score: 0,
            meeples: 7,
            isBot: true,
            difficulty: 'hard',
            engine: engineChallenger
          },
          {
            id: 'champion',
            name: 'Campeón IA',
            color: challengerStarts ? 'blue' : 'red',
            score: 0,
            meeples: 7,
            isBot: true,
            difficulty: 'hard',
            engine: engineChampion
          }
        ];

        // If champion starts, swap player array order
        if (!challengerStarts) {
          players.reverse();
        }

        const room = { board, deck, rules, graph, players, turnIndex: 0, status: 'playing' };
        room.currentTile = deck.drawTile();

        let turnCount = 0;
        while (room.currentTile && turnCount < 120) {
          turnCount++;
          const currentPlayer = players[room.turnIndex];
          const currentEngine = currentPlayer.engine;

          const validPlacements = board.getValidPlacements(room.currentTile, true);
          if (validPlacements.length === 0) {
            room.currentTile = deck.drawTile();
            continue;
          }

          const move = currentEngine.chooseMove(room, currentPlayer);
          if (!move || move.action === 'discard') {
            room.currentTile = deck.drawTile();
            room.turnIndex = (room.turnIndex + 1) % 2;
            continue;
          }

          board.placeTile(move.x, move.y, room.currentTile, move.rotation, currentPlayer.id);

          // Choose meeple placement
          if (currentPlayer.meeples > 0) {
            const availableSegs = (room.currentTile.segments || []).filter(s => !s.noMeeple && s.type !== 'river');
            const chosenSeg = currentEngine.chooseMeeplePlacement(room, currentPlayer, move.x, move.y, availableSegs);
            if (chosenSeg) {
              const placed = board.getTile(move.x, move.y);
              if (placed && !placed.meeple) {
                board.placeMeeple(move.x, move.y, currentPlayer.id, chosenSeg.id, chosenSeg.pos, currentPlayer.color);
                currentPlayer.meeples = Math.max(0, currentPlayer.meeples - 1);
              }
            }
          }

          // Score completed features
          const scoring = rules.checkCompletedFeatures(move.x, move.y, true);
          for (const [pid, pts] of Object.entries(scoring.totalPointsByPlayer)) {
            const p = players.find(pl => pl.id === pid);
            if (p) p.score += pts;
          }
          scoring.scoredFeatures.forEach(feat => {
            feat.meeplesToReturn.forEach(m => {
              const p = players.find(x => x.id === m.player);
              if (p) p.meeples = Math.min(7, p.meeples + 1);
            });
          });

          // Next turn
          room.turnIndex = (room.turnIndex + 1) % 2;
          room.currentTile = deck.drawTile();
        }

        // End Game Final Scoring
        const finalScores = rules.calculateFinalScores();
        for (const [pid, pts] of Object.entries(finalScores.totalPointsByPlayer)) {
          const p = players.find(pl => pl.id === pid);
          if (p) p.score += pts;
        }

        const scoreChallenger = (players.find(p => p.id === 'challenger') || {}).score || 0;
        const scoreChampion = (players.find(p => p.id === 'champion') || {}).score || 0;

        result.totalPointsChallenger += scoreChallenger;
        result.totalPointsChampion += scoreChampion;

        if (scoreChallenger > scoreChampion) result.challengerWins++;
        else if (scoreChampion > scoreChallenger) result.championWins++;
        else result.draws++;

      } catch (e) {
        // Skip errored game
      }
    }

    return result;
  }

  _generateChallenger(baseWeights, iteration) {
    const challenger = { ...baseWeights };
    const archetypes = [
      // 1. City Master: Heavy investment in cities and majority expansion
      { cityValue: 1.35, expandOwnCityMultiplier: 1.4, completionBonus: 1.2, roadValue: 0.85 },
      // 2. Fortress & Monasteries: High monastery value, tight blocking
      { monasteryValue: 1.4, monasteryNeighborBonus: 1.5, blockingPenalty: 1.3, monasteryNewPlacementBonus: 1.3 },
      // 3. Farmer Dominator: Heavy endgame agricultural strategy
      { fieldLateGameValue: 1.4, fieldValue: 1.25, meepleThresholdLowTiles: 1.2, meepleReservationTiles: 1.3 },
      // 4. Meeple Conservation & Fast Cycling
      { completionMeepleRecoveryBonus: 1.5, completionBonus: 1.3, expandOwnRoadMultiplier: 1.25, centerBoardBonus: 1.2 }
    ];

    const archetype = archetypes[iteration % archetypes.length];
    for (const [k, mult] of Object.entries(archetype)) {
      if (challenger[k] !== undefined) {
        const jitter = 0.95 + Math.random() * 0.1; // ±5% jitter
        challenger[k] = parseFloat((challenger[k] * mult * jitter).toFixed(2));
      }
    }

    // Additional Gaussian noise on 2 random parameters
    const allKeys = Object.keys(challenger).filter(k => typeof challenger[k] === 'number');
    for (let i = 0; i < 2; i++) {
      const randKey = allKeys[Math.floor(Math.random() * allKeys.length)];
      const noise = (Math.random() - 0.5) * 1.5;
      challenger[randKey] = Math.max(1, Math.min(35, parseFloat((challenger[randKey] + noise).toFixed(2))));
    }

    return challenger;
  }
}

module.exports = BotTrainer;
