const assert = require('assert');
const Board = require('../server/engine/Board');
const { TileDeck, getFullDeckCatalog, rotateEdges, rotatePoint } = require('../server/engine/TileDeck');
const Rules = require('../server/engine/Rules');
const BoardGraph = require('../server/engine/BoardGraph');
const RoomManager = require('../server/RoomManager');

console.log('====================================================');
console.log('🧪 SUITE EXHAUSTIVA DE PRUEBAS AUTOMATIZADAS');
console.log('====================================================');

const catalog = getFullDeckCatalog();

// 1. Test Canonical Rotation
console.log('1. Probando rotación canónica de aristas y posiciones:');
const origEdges = ['C', 'R', 'F', 'R'];
const rot90Edges = rotateEdges(origEdges, 90);
assert.deepStrictEqual(rot90Edges, ['R', 'C', 'R', 'F'], 'Rotación de 90° de aristas incorrecta');
const rotPoint = rotatePoint({ x: 0.5, y: 0.2 }, 90);
assert.strictEqual(rotPoint.x, 0.8, 'Rotación X incorrecta');
assert.strictEqual(rotPoint.y, 0.5, 'Rotación Y incorrecta');
console.log('   ✅ Rotación canónica verificada.');

// 2. Complete Straight Road (3 tiles)
console.log('2. Probando camino recto cerrado:');
const b2 = new Board();
const r2 = new Rules(b2);
const uTile = catalog.find(t => t.type === 'U');
const wTile = catalog.find(t => t.type === 'W'); // village terminal
b2.placeTile(0, 0, wTile, 0, 'p1'); // Village South road at y=0
b2.placeTile(0, 1, uTile, 0, 'p1'); // Straight road North-South at y=1
b2.placeTile(0, 2, wTile, 180, 'p1'); // Village North road at y=2
b2.placeMeeple(0, 1, 'p1', 'road_NS', { x: 0.5, y: 0.5 });
const roadRes = r2.checkCompletedFeatures(0, 2);
assert.strictEqual(roadRes.scoredFeatures.length, 1, 'El camino recto debe completarse');
assert.strictEqual(roadRes.scoredFeatures[0].points, 3, 'El camino debe sumar 3 puntos (3 losetas)');
assert.strictEqual(b2.getTile(0, 1).meeple, null, 'El meeple debe ser devuelto');
console.log('   ✅ Camino cerrado verificado: 3 pts otorgados y meeple recuperado.');

// 3. Road Terminating at City Gate (as in user Image 3)
console.log('3. Probando camino entre cruce de aldea y puerta de ciudad (Caso Imagen 3):');
const b3 = new Board();
const r3 = new Rules(b3);
const villageTile = catalog.find(t => t.type === 'W'); // Type W [F, R, R, R] -> West road ends at village
const tile42 = catalog.find(t => t.id === 'base_21_42'); // Type P [C, C, R, C] -> South road ends at city gate
b3.placeTile(0, 0, villageTile, 0, 'p1'); // West road at (0, 0)
b3.placeTile(-1, 0, tile42, 270, 'p1'); // Rotated 270° so South road faces East towards (0, 0)
b3.placeMeeple(-1, 0, 'p1', 'road_S', { x: 0.5, y: 0.85 });
const gateRes = r3.checkCompletedFeatures(-1, 0);
assert.strictEqual(gateRes.scoredFeatures.length, 1, 'Debe cerrarse el camino entre aldea y ciudad');
assert.strictEqual(gateRes.scoredFeatures[0].points, 2, 'El camino debe sumar exactamente 2 puntos');
assert.strictEqual(b3.getTile(-1, 0).meeple, null, 'El meeple debe ser devuelto');
console.log('   ✅ Caso Imagen 3 verificado: 2 pts sumados y meeple devuelto.');

// 4. Closed City (2 tiles)
console.log('4. Probando ciudad cerrada (2 losetas = 4 pts):');
const b4 = new Board();
const r4 = new Rules(b4);
const city1 = catalog.find(t => t.type === 'E'); // Type E: City North [C, F, F, F]
const city2 = catalog.find(t => t.type === 'E'); // Type E: City North [C, F, F, F]
b4.placeTile(0, 0, city1, 0, 'p1'); // City North
b4.placeTile(0, -1, city2, 180, 'p1'); // Rotated 180° -> City South facing (0,0)
b4.placeMeeple(0, 0, 'p1', 'city_N', { x: 0.5, y: 0.2 });
const cityRes = r4.checkCompletedFeatures(0, -1);
assert.strictEqual(cityRes.scoredFeatures.length, 1, 'La ciudad de 2 losetas debe cerrarse');
assert.strictEqual(cityRes.scoredFeatures[0].points, 4, 'Ciudad de 2 losetas sin escudo debe valer 4 puntos (2x2)');
assert.strictEqual(b4.getTile(0, 0).meeple, null, 'El caballero debe regresar');
console.log('   ✅ Ciudad cerrada: 4 pts otorgados y caballero devuelto.');

// 5. Monastery Completed (9 tiles)
console.log('5. Probando monasterio completo (9 losetas = 9 pts):');
const b5 = new Board();
const r5 = new Rules(b5);
const monTile = catalog.find(t => t.type === 'B');
const fTile = catalog.find(t => t.type === 'B');
b5.placeTile(0, 0, monTile, 0, 'p1');
b5.placeMeeple(0, 0, 'p1', 'monastery', { x: 0.5, y: 0.5 });
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    if (dx !== 0 || dy !== 0) {
      b5.placeTile(dx, dy, fTile, 0, 'p1');
    }
  }
}
const monRes = r5.checkCompletedFeatures(1, 1);
assert.strictEqual(monRes.scoredFeatures.length, 1, 'El monasterio debe completarse');
assert.strictEqual(monRes.scoredFeatures[0].points, 9, 'El monasterio completado debe sumar 9 puntos');
assert.strictEqual(b5.getTile(0, 0).meeple, null, 'El monje debe regresar');
console.log('   ✅ Monasterio completado: 9 pts otorgados y monje devuelto.');

// 6. Occupancy Rejection (Cannot place meeple on already occupied feature)
console.log('6. Probando rechazo autoritativo en obra ocupada:');
const b6 = new Board();
const g6 = new BoardGraph(b6);
b6.placeTile(0, 0, uTile, 0, 'p1');
b6.placeMeeple(0, 0, 'p1', 'road_NS', { x: 0.5, y: 0.5 });
b6.placeTile(0, 1, uTile, 0, 'p2');
const occRes = g6.isSegmentOccupied(0, 1, uTile, 0, 'road_NS');
assert.strictEqual(occRes.occupied, true, 'Debe detectar que el camino ya está ocupado por p1');
console.log('   ✅ Intento de colocar meeple en camino ocupado rechazado con éxito.');

// 7. Authoritative State Machine & Turn Flow
console.log('7. Probando máquina de estados autoritativa en RoomManager:');
const rm = new RoomManager(null);
const room = rm.createRoom({ name: 'Sala Test' });
rm.joinRoom(room.id, { playerId: 'p1', playerName: 'Jugador 1' });
rm.joinRoom(room.id, { playerId: 'p2', playerName: 'Jugador 2' });
rm.startGame(room.id, 'p1');

// Test: Cannot pass before placing tile
const passEarly = rm.passMeeple(room.id, 'p1');
assert(passEarly.error, 'No se puede pasar turno antes de colocar loseta');

// Test: Place tile
const activeRoom = rm.getRoom(room.id);
const valid = activeRoom.board.getValidPlacements(activeRoom.currentTile, true);
assert(valid.length > 0, 'Debe haber casillas válidas');
const placeRes = rm.placeTile(room.id, 'p1', { x: valid[0].x, y: valid[0].y, rotation: valid[0].validRotations[0] });
assert.strictEqual(placeRes.turnPhase, 'place_meeple', 'La fase debe ser place_meeple');

// Test: Pass meeple
const finishRes = rm.passMeeple(room.id, 'p1');
assert.strictEqual(finishRes.room.turnPhase, 'place_tile', 'El turno debe avanzar a place_tile para el siguiente jugador');
assert.strictEqual(finishRes.room.turnIndex, 1, 'Debe ser el turno del Jugador 2');
console.log('   ✅ Máquina de estados de turnos y validaciones autoritativas funcionando al 100%.');

// 8. Full Game Simulation with 84 Tiles
console.log('8. Ejecutando simulación de partida completa hasta agotar el mazo:');
const simRoom = rm.createRoom({ name: 'Simulación Total', options: { includeRiver: true } });
rm.joinRoom(simRoom.id, { playerId: 'bot1', playerName: 'Bot 1' });
rm.joinRoom(simRoom.id, { playerId: 'bot2', playerName: 'Bot 2' });
rm.startGame(simRoom.id, 'bot1');

let safety = 0;
while (simRoom.status === 'playing' && safety < 120) {
  safety++;
  const activeP = simRoom.players[simRoom.turnIndex];
  const validSlots = simRoom.board.getValidPlacements(simRoom.currentTile, true);

  if (validSlots.length === 0) {
    simRoom.currentTile = simRoom.deck.drawTile();
    rm.finishTurn(simRoom);
    continue;
  }

  const slot = validSlots[0];
  const rot = slot.validRotations[0];
  rm.placeTile(simRoom.id, activeP.id, { x: slot.x, y: slot.y, rotation: rot });

  if (simRoom.status === 'playing' && simRoom.turnPhase === 'place_meeple') {
    if (activeP.meeples > 0 && Math.random() < 0.5) {
      const segs = (simRoom.currentTile.segments || []).filter(s => !s.noMeeple && s.type !== 'river');
      if (segs.length > 0) {
        rm.placeMeeple(simRoom.id, activeP.id, { segmentId: segs[0].id });
      } else {
        rm.passMeeple(simRoom.id, activeP.id);
      }
    } else {
      rm.passMeeple(simRoom.id, activeP.id);
    }
  }
}

assert.strictEqual(simRoom.status, 'ended', 'La partida debe finalizar al agotarse el mazo');
console.log(`   ✅ Partida completada exitosamente en ${safety} turnos con puntuación final calculada.`);
console.log('====================================================');
console.log('🎉 TODAS LAS 8 PRUEBAS INTEGRALES PASARON SIN ERRORES');
console.log('====================================================');
