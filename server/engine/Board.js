const { rotateEdges } = require('./TileDeck');

class Board {
  constructor() {
    this.grid = new Map(); // key "x,y" -> PlacedTile object
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
  }

  key(x, y) {
    return `${x},${y}`;
  }

  getTile(x, y) {
    return this.grid.get(this.key(x, y)) || null;
  }

  placeTile(x, y, tile, rotation = 0, player = null, meeple = null) {
    const rotatedEdges = rotateEdges(tile.edges, rotation);
    const placedTile = {
      x,
      y,
      tile,
      rotation,
      rotatedEdges,
      player,
      meeple: meeple || null, // { player, segmentId, pos }
      placedAt: Date.now()
    };

    this.grid.set(this.key(x, y), placedTile);
    
    // Update bounding box
    this.minX = Math.min(this.minX, x);
    this.maxX = Math.max(this.maxX, x);
    this.minY = Math.min(this.minY, y);
    this.maxY = Math.max(this.maxY, y);

    return placedTile;
  }

  removeTile(x, y) {
    const key = this.key(x, y);
    const existed = this.grid.get(key);
    this.grid.delete(key);
    this.recomputeBounds();
    return existed;
  }

  recomputeBounds() {
    if (this.grid.size === 0) {
      this.minX = this.maxX = this.minY = this.maxY = 0;
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const tile of this.grid.values()) {
      minX = Math.min(minX, tile.x);
      maxX = Math.max(maxX, tile.x);
      minY = Math.min(minY, tile.y);
      maxY = Math.max(maxY, tile.y);
    }
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
  }

  getAdjacent(x, y) {
    return {
      N: this.getTile(x, y - 1),
      E: this.getTile(x + 1, y),
      S: this.getTile(x, y + 1),
      W: this.getTile(x - 1, y)
    };
  }

  getOpenNeighbors() {
    const openSlots = new Set();
    const directions = [
      { dx: 0, dy: -1 }, // N
      { dx: 1, dy: 0 },  // E
      { dx: 0, dy: 1 },  // S
      { dx: -1, dy: 0 }  // W
    ];

    for (const tile of this.grid.values()) {
      for (const d of directions) {
        const nx = tile.x + d.dx;
        const ny = tile.y + d.dy;
        if (!this.getTile(nx, ny)) {
          openSlots.add(`${nx},${ny}`);
        }
      }
    }

    return Array.from(openSlots).map(s => {
      const [x, y] = s.split(',').map(Number);
      return { x, y };
    });
  }

  // Strict 4-cardinal edge compatibility validation
  checkEdgeCompatibility(x, y, tile, rotation) {
    const adj = this.getAdjacent(x, y);
    const rotated = rotateEdges(tile.edges, rotation); // [N, E, S, W]

    // 1. North neighbor (x, y - 1): South edge of neighbor must match North edge of current tile
    if (adj.N && adj.N.rotatedEdges[2] !== rotated[0]) {
      return false;
    }

    // 2. East neighbor (x + 1, y): West edge of neighbor must match East edge of current tile
    if (adj.E && adj.E.rotatedEdges[3] !== rotated[1]) {
      return false;
    }

    // 3. South neighbor (x, y + 1): North edge of neighbor must match South edge of current tile
    if (adj.S && adj.S.rotatedEdges[0] !== rotated[2]) {
      return false;
    }

    // 4. West neighbor (x - 1, y): East edge of neighbor must match West edge of current tile
    if (adj.W && adj.W.rotatedEdges[1] !== rotated[3]) {
      return false;
    }

    return true;
  }

  // Check if tile can legally be placed at (x, y) with a specific rotation
  canPlace(x, y, tile, rotation, enforceRules = true) {
    if (this.getTile(x, y)) return false; // Already occupied

    // If sandbox mode is active and rules are disabled, allow any placement
    if (!enforceRules) return true;

    // Must be adjacent to at least one tile (unless it's the very first tile)
    if (this.grid.size === 0) return true;

    const adj = this.getAdjacent(x, y);
    const hasNeighbor = adj.N || adj.E || adj.S || adj.W;
    if (!hasNeighbor) return false;

    return this.checkEdgeCompatibility(x, y, tile, rotation);
  }

  // Get all valid rotations for a tile at (x, y)
  getValidRotationsForSlot(x, y, tile, enforceRules = true) {
    const rotations = [0, 90, 180, 270];
    return rotations.filter(r => this.canPlace(x, y, tile, r, enforceRules));
  }

  // Get all valid placements and their rotations for a tile
  getValidPlacements(tile, enforceRules = true) {
    if (this.grid.size === 0) {
      return [{ x: 0, y: 0, validRotations: [0, 90, 180, 270] }];
    }

    const openSlots = this.getOpenNeighbors();
    const valid = [];

    for (const slot of openSlots) {
      const validRots = this.getValidRotationsForSlot(slot.x, slot.y, tile, enforceRules);
      if (validRots.length > 0) {
        valid.push({
          x: slot.x,
          y: slot.y,
          validRotations: validRots
        });
      }
    }

    return valid;
  }

  placeMeeple(x, y, player, segmentId, pos, playerColor = null) {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    tile.meeple = {
      player,
      segmentId,
      pos: pos || { x: 0.5, y: 0.5 },
      color: playerColor || player
    };
    return true;
  }

  removeMeeple(x, y) {
    const tile = this.getTile(x, y);
    if (!tile || !tile.meeple) return null;
    const removed = tile.meeple;
    tile.meeple = null;
    return removed;
  }

  toJSON() {
    return {
      tiles: Array.from(this.grid.values()),
      bounds: {
        minX: this.minX,
        maxX: this.maxX,
        minY: this.minY,
        maxY: this.maxY
      },
      count: this.grid.size
    };
  }

  static fromJSON(data) {
    const b = new Board();
    if (data && data.tiles) {
      for (const t of data.tiles) {
        b.grid.set(b.key(t.x, t.y), t);
      }
      b.recomputeBounds();
    }
    return b;
  }
}

module.exports = Board;
