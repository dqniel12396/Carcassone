const assert = require('assert');
const Board = require('../server/engine/Board');
const Rules = require('../server/engine/Rules');
const BoardGraph = require('../server/engine/BoardGraph');
const catalog = require('../server/engine/canonical_tiles.json');

console.log('====================================================');
console.log('🧪 PRUEBAS UNITARIAS DE CONTEO Y ESCUDOS');
console.log('====================================================');

// 1. Verificar los 10 escudos canónicos en canonical_tiles.json
console.log('1. Verificando los 10 escudos canónicos:');
const expectedShieldTiles = [
  'base_21_02', 'base_21_05', 'base_21_15', 'base_21_25', 
  'base_21_26', 'base_21_30', 'base_21_31', 'base_21_34', 
  'base_21_37', 'base_22_09'
];

for (const tid of expectedShieldTiles) {
  assert.strictEqual(catalog[tid].shield, true, `La loseta ${tid} debe tener escudo (shield: true)`);
}

let totalShieldsInCatalog = 0;
for (const [tid, tile] of Object.entries(catalog)) {
  if (tile.shield) totalShieldsInCatalog++;
}
assert.strictEqual(totalShieldsInCatalog, 10, 'Debe haber exactamente 10 losetas con escudo en el catálogo');
console.log('   ✅ Los 10 escudos canónicos están perfectamente registrados.');

// 2. Probar la estructura exacta de Nicolas San de la partida:
console.log('2. Probando la estructura de Nicolas San de la partida:');
const b = new Board();
const tilesUpTo2Minus1 = [
  { x: 0, y: 0, rot: 0, tileId: "base_21_03" },
  { x: 0, y: -1, rot: 90, tileId: "base_21_59" },
  { x: 0, y: -2, rot: 90, tileId: "base_21_43" },
  { x: -1, y: 0, rot: 90, tileId: "base_22_02" },
  { x: -1, y: 1, rot: 0, tileId: "base_22_00" },
  { x: -2, y: 1, rot: 0, tileId: "base_22_10" },
  { x: 1, y: -2, rot: 270, tileId: "base_21_00" },
  { x: 1, y: -1, rot: 0, tileId: "base_22_09" },
  { x: -1, y: -2, rot: 0, tileId: "base_21_37" },
  { x: 2, y: -1, rot: 270, tileId: "base_21_27" }
];

for (const t of tilesUpTo2Minus1) {
  b.placeTile(t.x, t.y, catalog[t.tileId], t.rot);
}

// Colocar meeple de Nicolas San en city_main de (0, -1)
b.placeMeeple(0, -1, 'Nicolas San', 'city_main');

const rules = new Rules(b);
const scoreRes = { scoredFeatures: [], totalPointsByPlayer: {} };
rules.checkCitiesConnected(2, -1, scoreRes);

assert.strictEqual(scoreRes.scoredFeatures.length, 1, 'Debe haber 1 estructura completada');
const cityFeat = scoreRes.scoredFeatures[0];
console.log(`   Estructura: ${cityFeat.name}`);
console.log(`   Puntos obtenidos: ${cityFeat.points}`);
console.log(`   Ganador: ${cityFeat.winners.join(', ')}`);

assert.strictEqual(cityFeat.points, 10, 'La ciudad debe otorgar exactamente 10 puntos (4 losetas * 2 + 1 escudo * 2 = 10 pts)');
assert.strictEqual(scoreRes.totalPointsByPlayer['Nicolas San'], 10, 'Nicolas San debe recibir exactamente 10 puntos');
console.log('   ✅ Caso de Nicolas San resuelto: 10 puntos calculados correctamente.');

// 3. Probar ciudad cerrada independiente con 2 escudos
console.log('3. Probando ciudad con múltiples escudos (3 losetas + 2 escudos):');
const b2 = new Board();
b2.placeTile(0, 0, catalog['base_21_02'], 0);
b2.placeTile(1, 0, catalog['base_22_09'], 0);
b2.placeTile(2, 0, catalog['base_21_27'], 270);
b2.placeMeeple(0, 0, 'Jugador 1', 'city_main');

const g2 = new BoardGraph(b2);
const feat2 = g2.getConnectedFeature(0, 0, 'city', 'city_main');
assert.strictEqual(feat2.shields, 2, 'Deben contabilizarse 2 escudos');
console.log('   ✅ Ciudad con 2 escudos detecta shields=2 correctamente.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE REGLAS PASARON EXITOSAMENTE!');
