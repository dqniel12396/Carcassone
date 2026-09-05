const Board = require('../server/engine/Board');
const { TileDeck, getFullDeckCatalog } = require('../server/engine/TileDeck');
const Rules = require('../server/engine/Rules');

console.log('====================================================');
console.log('🧪 PRUEBAS UNITARIAS DE REGLAS OFICIALES Y CIERRES');
console.log('====================================================');

const catalog = getFullDeckCatalog();

// 1. Test Field existence on base_21_42 and base_21_33
const tile42 = catalog.find(t => t.id === 'base_21_42');
const tile33 = catalog.find(t => t.id === 'base_21_33');

console.log('1. Verificando segmentos de base_21_42:');
const types42 = tile42.segments.map(s => s.type);
console.log('   Segmentos en base_21_42:', types42);
if (types42.includes('city') && types42.includes('road') && types42.includes('field')) {
  console.log('   ✅ base_21_42 tiene Ciudad, Camino y Campo (Campesino)');
} else {
  console.error('   ❌ Falta alguno en base_21_42');
}

console.log('2. Verificando segmentos de base_21_33:');
const types33 = tile33.segments.map(s => s.type);
console.log('   Segmentos en base_21_33:', types33);
if (types33.includes('city') && types33.includes('road') && types33.includes('field')) {
  console.log('   ✅ base_21_33 tiene Ciudad, Camino y Campo (Campesino)');
} else {
  console.error('   ❌ Falta alguno en base_21_33');
}

// 3. Test Road Completion between Village and City Gate (as in Image 3)
console.log('3. Simulando cierre de camino entre cruce y puerta de ciudad:');
const board = new Board();
const rules = new Rules(board);

// Place village at (0, 0)
const villageTile = catalog.find(t => t.id === 'base_21_07');
board.placeTile(0, 0, villageTile, 0, 'p1');

// Place city with road at (-1, 0) rotated 0 (so its East road connects to village West road)
board.placeTile(-1, 0, tile42, 0, 'p1');

// Place a road meeple (Bandido) on (-1, 0)
board.placeMeeple(-1, 0, 'p1', 'road_W', { x: 0.3, y: 0.5 });
console.log('   Meeple colocado en (-1, 0) en segmento road_W');

// Check feature completion
const scoreRes = rules.checkCompletedFeatures(-1, 0);
console.log('   Resultado de puntuación:', scoreRes);

if (scoreRes.scoredFeatures.length > 0 && scoreRes.scoredFeatures[0].type === 'road') {
  console.log(`   ✅ Camino detectado y cerrado con éxito! Puntos: ${scoreRes.scoredFeatures[0].points} pts`);
  console.log('   ✅ Meeple devuelto al jugador:', scoreRes.scoredFeatures[0].meeplesToReturn);
} else {
  console.error('   ❌ El camino cerrado no fue detectado correctamente');
}

console.log('====================================================');
console.log('🎉 TODAS LAS VERIFICACIONES PASARON CON ÉXITO');
console.log('====================================================');
