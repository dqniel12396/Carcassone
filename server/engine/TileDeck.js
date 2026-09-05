const fs = require('fs');
const path = require('path');

// Helper to rotate edges clockwise [N, E, S, W]
function rotateEdges(edges, rotationDeg) {
  const steps = ((rotationDeg / 90) % 4 + 4) % 4;
  const result = [...edges];
  for (let i = 0; i < steps; i++) {
    const last = result.pop();
    result.unshift(last);
  }
  return result;
}

// Rotate meeple segment position around center (0.5, 0.5) in 2D canvas coordinates (X right, Y down)
function rotatePoint(pos, rotationDeg) {
  const steps = ((Math.round(rotationDeg / 90) % 4) + 4) % 4;
  let x = pos.x;
  let y = pos.y;
  for (let i = 0; i < steps; i++) {
    // 90 deg clockwise: x' = 1 - y, y' = x
    const nx = 1 - y;
    const ny = x;
    x = nx;
    y = ny;
  }
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000
  };
}

// Canonical database as single source of truth
const canonicalPath = path.join(__dirname, 'canonical_tiles.json');
let canonicalCatalog = {};
if (fs.existsSync(canonicalPath)) {
  canonicalCatalog = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));
}

function getFullDeckCatalog() {
  return Object.values(canonicalCatalog);
}

class TileDeck {
  constructor(options = { includeRiver: true }) {
    this.options = options;
    this.catalog = getFullDeckCatalog();
    this.deck = [];
    this.riverDeck = [];
    this.startTile = null;
    this.init();
  }

  init() {
    const baseTiles = this.catalog.filter(t => t.set === 'base');
    const riverTiles = this.catalog.filter(t => t.set === 'river');

    if (this.options.includeRiver && riverTiles.length > 0) {
      // River setup:
      // Spring starts first, Lake ends last, other 10 river tiles in between
      const spring = riverTiles.find(t => t.isSpring) || riverTiles[3];
      const lake = riverTiles.find(t => t.isLake) || riverTiles[8];
      const middle = riverTiles.filter(t => t.id !== spring.id && t.id !== lake.id);

      this.shuffle(middle);
      this.startTile = spring;
      this.riverDeck = [...middle, lake];

      this.deck = [...baseTiles];
      this.shuffle(this.deck);
    } else {
      const startIndex = baseTiles.findIndex(t => t.isStartTile);
      if (startIndex !== -1) {
        this.startTile = baseTiles.splice(startIndex, 1)[0];
      } else {
        this.startTile = baseTiles.shift();
      }
      this.deck = [...baseTiles];
      this.shuffle(this.deck);
    }
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  drawTile() {
    if (this.riverDeck.length > 0) {
      return this.riverDeck.shift();
    }
    if (this.deck.length > 0) {
      return this.deck.shift();
    }
    return null;
  }

  remainingCount() {
    return this.riverDeck.length + this.deck.length;
  }
}

module.exports = {
  TileDeck,
  rotateEdges,
  rotatePoint,
  getFullDeckCatalog
};
