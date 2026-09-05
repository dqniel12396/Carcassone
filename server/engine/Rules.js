// Carcassonne Official Rules and Scoring Engine (Graph-Based)

const BoardGraph = require('./BoardGraph');

class Rules {
  constructor(board) {
    this.board = board;
    this.graph = new BoardGraph(board);
  }

  // Check features completed after placing a tile at (lastX, lastY)
  // applyChanges = false is used for bot evaluations/heuristics to avoid mutating the board
  checkCompletedFeatures(lastX, lastY, applyChanges = true) {
    const results = {
      scoredFeatures: [], // { type, name, points, winners: [playerId], meeplesToReturn: [{player, x, y}] }
      totalPointsByPlayer: {}
    };

    const placedTile = this.board.getTile(lastX, lastY);
    if (!placedTile) return results;

    // 1. Check Monasteries (Check 3x3 surrounding tiles)
    this.checkMonasteriesAround(lastX, lastY, results, applyChanges);

    // 2. Check Roads connected to placedTile segments
    this.checkRoadsConnected(lastX, lastY, results, applyChanges);

    // 3. Check Cities connected to placedTile segments
    this.checkCitiesConnected(lastX, lastY, results, applyChanges);

    return results;
  }

  // 1. Monasteries (Monk): 9 points when all 8 neighbors exist
  checkMonasteriesAround(cx, cy, results, applyChanges = true) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = cx + dx;
        const y = cy + dy;
        const tile = this.board.getTile(x, y);

        if (tile && tile.tile.monastery && tile.meeple && (tile.meeple.segmentId.startsWith('monastery') || tile.meeple.type === 'monastery')) {
          let complete = true;
          for (let nx = -1; nx <= 1; nx++) {
            for (let ny = -1; ny <= 1; ny++) {
              if (!this.board.getTile(x + nx, y + ny)) {
                complete = false;
                break;
              }
            }
            if (!complete) break;
          }

          if (complete) {
            const player = tile.meeple.player;
            results.scoredFeatures.push({
              type: 'monastery',
              name: `Monasterio en (${x}, ${y})`,
              points: 9,
              winners: [player],
              meeplesToReturn: [{ player, x, y }]
            });
            results.totalPointsByPlayer[player] = (results.totalPointsByPlayer[player] || 0) + 9;
            if (applyChanges) {
              this.board.removeMeeple(x, y);
            }
          }
        }
      }
    }
  }

  // 2. Roads (Thief / Bandido): 1 point per distinct tile when closed on both ends
  checkRoadsConnected(cx, cy, results, applyChanges = true) {
    const placed = this.board.getTile(cx, cy);
    if (!placed) return;

    const roadSegments = (placed.tile.segments || []).filter(s => s.type === 'road');
    const evaluatedFeatures = new Set();

    for (const seg of roadSegments) {
      const feat = this.graph.getConnectedFeature(cx, cy, 'road', seg.id);
      const featKey = feat.tiles.slice().sort().join('|');

      if (evaluatedFeatures.has(featKey)) continue;
      evaluatedFeatures.add(featKey);

      if (feat.isComplete && feat.tiles.length >= 1 && feat.meeples.length > 0) {
        const points = feat.tiles.length; // 1 pt per tile
        const playerCounts = {};
        feat.meeples.forEach(m => {
          playerCounts[m.player] = (playerCounts[m.player] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(playerCounts));
        const winners = Object.keys(playerCounts).filter(p => playerCounts[p] === maxCount);

        winners.forEach(w => {
          results.totalPointsByPlayer[w] = (results.totalPointsByPlayer[w] || 0) + points;
        });

        results.scoredFeatures.push({
          type: 'road',
          name: `Camino de ${points} loseta${points > 1 ? 's' : ''}`,
          points,
          winners,
          meeplesToReturn: feat.meeples
        });

        if (applyChanges) {
          feat.meeples.forEach(m => {
            this.board.removeMeeple(m.x, m.y);
          });
        }
      }
    }
  }

  // 3. Cities (Knight / Caballero): 2 points per tile + 2 per shield when closed
  checkCitiesConnected(cx, cy, results, applyChanges = true) {
    const placed = this.board.getTile(cx, cy);
    if (!placed) return;

    const citySegments = (placed.tile.segments || []).filter(s => s.type === 'city');
    const evaluatedFeatures = new Set();

    for (const seg of citySegments) {
      const feat = this.graph.getConnectedFeature(cx, cy, 'city', seg.id);
      const featKey = feat.tiles.slice().sort().join('|');

      if (evaluatedFeatures.has(featKey)) continue;
      evaluatedFeatures.add(featKey);

      if (feat.isComplete && feat.tiles.length >= 1 && feat.meeples.length > 0) {
        const points = feat.tiles.length * 2 + feat.shields * 2;
        const playerCounts = {};
        feat.meeples.forEach(m => {
          playerCounts[m.player] = (playerCounts[m.player] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(playerCounts));
        const winners = Object.keys(playerCounts).filter(p => playerCounts[p] === maxCount);

        winners.forEach(w => {
          results.totalPointsByPlayer[w] = (results.totalPointsByPlayer[w] || 0) + points;
        });

        results.scoredFeatures.push({
          type: 'city',
          name: `Ciudad de ${feat.tiles.length} loseta${feat.tiles.length > 1 ? 's' : ''}${feat.shields > 0 ? ` con ${feat.shields} escudo${feat.shields > 1 ? 's' : ''}` : ''}`,
          points,
          winners,
          meeplesToReturn: feat.meeples
        });

        if (applyChanges) {
          feat.meeples.forEach(m => {
            this.board.removeMeeple(m.x, m.y);
          });
        }
      }
    }
  }

  // 4. End Game Final Scoring (Farmers + Incomplete Features)
  calculateFinalScores() {
    const finalResults = {
      scoredFeatures: [],
      totalPointsByPlayer: {}
    };

    const allPlacedTiles = Array.from(this.board.grid.values());
    if (allPlacedTiles.length === 0) return finalResults;

    // Find all completed cities to award 3 points per touching completed city to farmers
    const completedCities = [];
    const evaluatedCities = new Set();

    for (const t of allPlacedTiles) {
      const citySegs = (t.tile.segments || []).filter(s => s.type === 'city');
      for (const cs of citySegs) {
        const feat = this.graph.getConnectedFeature(t.x, t.y, 'city', cs.id);
        const featKey = feat.tiles.slice().sort().join('|');
        if (feat.isComplete && !evaluatedCities.has(featKey)) {
          evaluatedCities.add(featKey);
          completedCities.push(feat);
        }
      }
    }

    // 1. Incomplete Monasteries (1 pt per tile)
    for (const t of allPlacedTiles) {
      if (t.meeple) {
        const p = t.meeple.player;
        const segId = t.meeple.segmentId || '';

        if (segId.startsWith('monastery') || t.meeple.type === 'monastery') {
          let count = 1;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx !== 0 || dy !== 0) {
                if (this.board.getTile(t.x + dx, t.y + dy)) count++;
              }
            }
          }
          finalResults.scoredFeatures.push({
            type: 'monastery_incomplete',
            name: `Monasterio Incompleto (${count}/9 pts)`,
            points: count,
            winners: [p],
            meeplesToReturn: [t.meeple]
          });
          finalResults.totalPointsByPlayer[p] = (finalResults.totalPointsByPlayer[p] || 0) + count;
        }
      }
    }

    // 2. Incomplete Roads (1 pt per tile)
    const evaluatedFinalRoads = new Set();
    for (const t of allPlacedTiles) {
      const roadSegs = (t.tile.segments || []).filter(s => s.type === 'road');
      for (const rs of roadSegs) {
        const feat = this.graph.getConnectedFeature(t.x, t.y, 'road', rs.id);
        const featKey = feat.tiles.slice().sort().join('|');

        if (evaluatedFinalRoads.has(featKey)) continue;
        evaluatedFinalRoads.add(featKey);

        if (!feat.isComplete && feat.meeples.length > 0) {
          const points = feat.tiles.length; // 1 pt per tile
          const playerCounts = {};
          feat.meeples.forEach(m => {
            playerCounts[m.player] = (playerCounts[m.player] || 0) + 1;
          });

          const maxCount = Math.max(...Object.values(playerCounts));
          const winners = Object.keys(playerCounts).filter(p => playerCounts[p] === maxCount);

          winners.forEach(w => {
            finalResults.totalPointsByPlayer[w] = (finalResults.totalPointsByPlayer[w] || 0) + points;
          });

          finalResults.scoredFeatures.push({
            type: 'road_incomplete',
            name: `Camino Incompleto de ${points} loseta${points > 1 ? 's' : ''}`,
            points,
            winners,
            meeplesToReturn: feat.meeples
          });
        }
      }
    }

    // 3. Incomplete Cities (1 pt per tile + 1 pt per shield)
    const evaluatedFinalCities = new Set();
    for (const t of allPlacedTiles) {
      const citySegs = (t.tile.segments || []).filter(s => s.type === 'city');
      for (const cs of citySegs) {
        const feat = this.graph.getConnectedFeature(t.x, t.y, 'city', cs.id);
        const featKey = feat.tiles.slice().sort().join('|');

        if (evaluatedFinalCities.has(featKey)) continue;
        evaluatedFinalCities.add(featKey);

        if (!feat.isComplete && feat.meeples.length > 0) {
          const points = feat.tiles.length * 1 + feat.shields * 1; // 1 pt per tile + 1 pt per shield
          const playerCounts = {};
          feat.meeples.forEach(m => {
            playerCounts[m.player] = (playerCounts[m.player] || 0) + 1;
          });

          const maxCount = Math.max(...Object.values(playerCounts));
          const winners = Object.keys(playerCounts).filter(p => playerCounts[p] === maxCount);

          winners.forEach(w => {
            finalResults.totalPointsByPlayer[w] = (finalResults.totalPointsByPlayer[w] || 0) + points;
          });

          finalResults.scoredFeatures.push({
            type: 'city_incomplete',
            name: `Ciudad Incompleta de ${feat.tiles.length} loseta${feat.tiles.length > 1 ? 's' : ''}${feat.shields > 0 ? ` con ${feat.shields} escudo${feat.shields > 1 ? 's' : ''}` : ''}`,
            points,
            winners,
            meeplesToReturn: feat.meeples
          });
        }
      }
    }

    // 4. Farmers (Granjeros): Evaluate each unique connected field
    const evaluatedFields = new Set();

    for (const t of allPlacedTiles) {
      if (t.meeple && (t.meeple.type === 'field' || (t.meeple.segmentId && t.meeple.segmentId.startsWith('field')))) {
        const fieldFeat = this.graph.getConnectedFeature(t.x, t.y, 'field', t.meeple.segmentId);
        const fieldKey = fieldFeat.nodes.slice().sort().join('|');

        if (evaluatedFields.has(fieldKey)) continue;
        evaluatedFields.add(fieldKey);

        if (fieldFeat.meeples.length === 0) continue;

        // Find all completed cities that touch this field
        const fieldTileCoords = new Set(fieldFeat.tiles);
        let touchingCompletedCitiesCount = 0;

        for (const cityFeat of completedCities) {
          let touches = false;
          for (const cityTileKey of cityFeat.tiles) {
            if (fieldTileCoords.has(cityTileKey)) {
              touches = true;
              break;
            }
            const [cx, cy] = cityTileKey.split(',').map(Number);
            const neighborOffsets = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
            for (const off of neighborOffsets) {
              if (fieldTileCoords.has(`${cx + off.dx},${cy + off.dy}`)) {
                touches = true;
                break;
              }
            }
            if (touches) break;
          }

          if (touches) {
            touchingCompletedCitiesCount++;
          }
        }

        if (touchingCompletedCitiesCount > 0) {
          const points = touchingCompletedCitiesCount * 3;
          const playerCounts = {};
          fieldFeat.meeples.forEach(m => {
            playerCounts[m.player] = (playerCounts[m.player] || 0) + 1;
          });

          const maxCount = Math.max(...Object.values(playerCounts));
          const winners = Object.keys(playerCounts).filter(p => playerCounts[p] === maxCount);

          winners.forEach(w => {
            finalResults.totalPointsByPlayer[w] = (finalResults.totalPointsByPlayer[w] || 0) + points;
          });

          finalResults.scoredFeatures.push({
            type: 'field',
            name: `Campo abastece a ${touchingCompletedCitiesCount} ciudad(es) completa(s) (3 pts c/u)`,
            points,
            winners,
            meeplesToReturn: fieldFeat.meeples
          });
        }
      }
    }

    return finalResults;
  }
}

module.exports = Rules;
