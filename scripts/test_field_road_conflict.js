const assert = require('assert');
const Board = require('../server/engine/Board');
const { getFullDeckCatalog } = require('../server/engine/TileDeck');

console.log('=== TEST DE CONEXION CAMPO VS CAMINO ===');
const catalog = getFullDeckCatalog();
const b = new Board();

// Left tile: river_23_00 rotated 270 deg
// At 0 deg: [C, W, F, W]
// At 270 deg: [W, F, W, C] (North: W, East: F, South: W, West: C)
const riverTile = catalog.find(t => t.id === 'river_23_00');
b.placeTile(0, 0, riverTile, 270, 'p1');

console.log('Loseta colocada en (0,0):', b.getTile(0, 0).rotatedEdges);

// Try placing crossroads base_22_07 at (1, 0)
// base_22_07 edges: [F, R, R, R] (North: F, East: R, South: R, West: R)
const crossTile = catalog.find(t => t.id === 'base_22_07');

// At rotation 0: West edge is 'R'. Left tile East edge is 'F'.
const canPlaceAt0 = b.canPlace(1, 0, crossTile, 0, true);
console.log('¿Se puede colocar cruce en (1,0) a 0° (Camino Oeste contra Campo Este)?:', canPlaceAt0);

const validRotations = b.getValidRotationsForSlot(1, 0, crossTile, true);
console.log('Rotaciones válidas para cruce en (1, 0):', validRotations);

assert.strictEqual(canPlaceAt0, false, 'ERROR CRITICO: canPlace permitió conectar Campo con Camino!');
assert.strictEqual(validRotations.includes(0), false, 'ERROR CRITICO: 0° no puede ser una rotación válida!');

console.log('✅ TEST PASADO: El motor rechaza estrictamente conectar Campo con Camino.');
