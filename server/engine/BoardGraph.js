// Carcassonne Board Graph Engine
// Authoritative graph of tiles, rotated segments, connectivity, occupancy, and scoring

const { rotateEdges, rotatePoint } = require('./TileDeck');

const PERIMETER_CYCLE = ['N_W', 'N_E', 'E_N', 'E_S', 'S_E', 'S_W', 'W_S', 'W_N'];

const OPPOSITE_SUB_EDGES = {
  'N_W': 'S_W', 'N_E': 'S_E',
  'E_N': 'W_N', 'E_S': 'W_S',
  'S_W': 'N_W', 'S_E': 'N_E',
  'W_N': 'E_N', 'W_S': 'E_S',
  'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'
};

const EDGE_OFFSETS = {
  'N': { dx: 0, dy: -1 }, 'N_W': { dx: 0, dy: -1 }, 'N_E': { dx: 0, dy: -1 },
  'E': { dx: 1, dy: 0 },  'E_N': { dx: 1, dy: 0 },  'E_S': { dx: 1, dy: 0 },
  'S': { dx: 0, dy: 1 },  'S_W': { dx: 0, dy: 1 },  'S_E': { dx: 0, dy: 1 },
  'W': { dx: -1, dy: 0 }, 'W_N': { dx: -1, dy: 0 }, 'W_S': { dx: -1, dy: 0 }
};

class BoardGraph {
  constructor(board) {
    this.board = board;
  }

  // Check if placing a meeple on segmentId at (x, y) is legal (i.e. not already occupied)
  isSegmentOccupied(x, y, tileDef, rotation, segmentId) {
    const targetSeg = (tileDef.segments || []).find(s => s.id === segmentId);
    if (!targetSeg) return { error: 'Segmento no encontrado en la loseta' };
    if (targetSeg.noMeeple || targetSeg.type === 'river') return { error: 'No se pueden colocar seguidores en este tipo de segmento' };

    // Explore connected component in the graph for this feature type
    const feature = this.getConnectedFeature(x, y, targetSeg.type, segmentId);
    if (feature.meeples.length > 0) {
      return {
        occupied: true,
        error: `El/la ${targetSeg.name || targetSeg.type} ya contiene seguidores (${feature.meeples.map(m => m.player).join(', ')})`
      };
    }

    return { occupied: false };
  }

  // Get connected feature (city, road, field, monastery) starting from (startX, startY, segmentId)
  getConnectedFeature(startX, startY, featureType, startSegmentId) {
    const visited = new Set(); // Set of "x,y:segId"
    const tiles = new Set();   // Set of "x,y"
    const meeples = [];
    let shields = 0;
    let isOpen = false;

    if (featureType === 'monastery') {
      const tile = this.board.getTile(startX, startY);
      if (tile) {
        tiles.add(`${startX},${startY}`);
        if (tile.meeple && (tile.meeple.segmentId === 'monastery' || tile.meeple.type === 'monastery')) {
          meeples.push(tile.meeple);
        }
      }
      return { tiles: Array.from(tiles), meeples, isOpen: false, shields: 0 };
    }

    // Queue for BFS traversal: { x, y, segId }
    const queue = [{ x: startX, y: startY, segId: startSegmentId }];

    while (queue.length > 0) {
      const curr = queue.shift();
      const nodeKey = `${curr.x},${curr.y}:${curr.segId}`;
      if (visited.has(nodeKey)) continue;
      visited.add(nodeKey);

      tiles.add(`${curr.x},${curr.y}`);
      const tileObj = this.board.getTile(curr.x, curr.y);
      if (!tileObj) continue;

      if (tileObj.tile.shield && featureType === 'city') {
        shields++;
      }

      // Collect meeple on this segment
      if (tileObj.meeple && tileObj.meeple.segmentId === curr.segId) {
        meeples.push({ ...tileObj.meeple, x: curr.x, y: curr.y });
      }

      // Find canonical segment definition rotated
      const segDef = (tileObj.tile.segments || []).find(s => s.id === curr.segId);
      if (!segDef) continue;

      // Rotate edges for this segment
      const rotatedSegEdges = this.getRotatedEdgesForSegment(segDef.edges, tileObj.rotation);

      // 1. Traverse external connections through edges
      for (const edge of rotatedSegEdges) {
        const offset = EDGE_OFFSETS[edge];
        if (!offset) continue;

        const neighborX = curr.x + offset.dx;
        const neighborY = curr.y + offset.dy;
        const neighbor = this.board.getTile(neighborX, neighborY);
        const oppSubEdge = OPPOSITE_SUB_EDGES[edge];

        if (!neighbor) {
          if (featureType === 'city' || featureType === 'road') {
            isOpen = true; // Open edge!
          }
        } else {
          // Find matching segment on neighbor with oppSubEdge
          const neighborSegs = neighbor.tile.segments || [];
          for (const nSeg of neighborSegs) {
            if (nSeg.type === featureType) {
              const nRotEdges = this.getRotatedEdgesForSegment(nSeg.edges, neighbor.rotation);
              // Match exact sub-edge (e.g. N_W with S_W) or primary cardinal edge (e.g. N with S)
              const hasOppEdge = nRotEdges.some(e => {
                if (e === oppSubEdge) return true;
                if (e === oppSubEdge.split('_')[0] || e.split('_')[0] === oppSubEdge) return true;
                return false;
              });

              if (hasOppEdge) {
                const nextKey = `${neighborX},${neighborY}:${nSeg.id}`;
                if (!visited.has(nextKey)) {
                  queue.push({ x: neighborX, y: neighborY, segId: nSeg.id });
                }
              }
            }
          }
        }
      }
    }

    return {
      nodes: Array.from(visited),
      tiles: Array.from(tiles),
      meeples,
      isOpen,
      isComplete: !isOpen && tiles.size >= 1,
      shields
    };
  }

  getRotatedEdgesForSegment(edges, rotationDeg) {
    if (!edges || edges.length === 0) return [];
    const steps = ((rotationDeg / 90) % 4 + 4) % 4;

    return edges.map(edge => {
      const pIdx = PERIMETER_CYCLE.indexOf(edge);
      if (pIdx !== -1) {
        return PERIMETER_CYCLE[(pIdx + steps * 2) % 8];
      }
      const edgeCycle = ['N', 'E', 'S', 'W'];
      const cIdx = edgeCycle.indexOf(edge);
      if (cIdx !== -1) {
        return edgeCycle[(cIdx + steps) % 4];
      }
      return edge;
    });
  }

  validateRiverPlacement(x, y, tileDef, rotation) {
    return { valid: true };
  }
}

module.exports = BoardGraph;
