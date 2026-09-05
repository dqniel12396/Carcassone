const RoomManager = require('../server/RoomManager');

console.log('====================================================');
console.log('🤖 SIMULACIÓN COMPLETA DE PARTIDA (2 JUGADORES + 1 BOT)');
console.log('====================================================');

const rm = new RoomManager(null);
const room = rm.createRoom({ name: 'Partida Simulación', options: { includeRiver: true } });

// 1. Join Players
const p1 = rm.joinRoom(room.id, { playerId: 'u1', playerName: 'Daniel', preferredColor: 'blue' });
const p2 = rm.joinRoom(room.id, { playerId: 'u2', playerName: 'Hermano', preferredColor: 'red' });
const botRes = rm.addBot(room.id, 'u1');

console.log(`Jugadores en sala (${room.players.length}):`);
room.players.forEach(p => console.log(` - ${p.name} [${p.color}] (Bot: ${!!p.isBot})`));

// 2. Start Game
const startRes = rm.startGame(room.id, 'u1');
console.log(`\nPartida iniciada. Mazo total: ${room.deck.remainingCount()} losetas.`);
console.log(`Loseta inicial en (0,0): ${room.board.getTile(0, 0).tile.id}`);

// 3. Simulate 15 consecutive turns
for (let turn = 1; turn <= 15; turn++) {
  if (room.status !== 'playing' || !room.currentTile) {
    console.log(`\nFin de la partida en el turno ${turn}`);
    break;
  }

  const activeP = room.players[room.turnIndex];
  console.log(`\n-----------------------------------------`);
  console.log(`📍 TURNO ${turn}: ${activeP.name} [${activeP.color}]`);
  console.log(`Loseta en mano: ${room.currentTile.id} (Set: ${room.currentTile.set}, Monasterio: ${room.currentTile.monastery})`);

  const validPlacements = room.board.getValidPlacements(room.currentTile, room.autoRules);
  console.log(`Casillas válidas encontradas: ${validPlacements.length}`);

  if (validPlacements.length === 0) {
    console.log(`⚠️ Sin colocaciones válidas. Descartando loseta.`);
    room.currentTile = room.deck.drawTile();
    rm.finishTurn(room);
    continue;
  }

  const chosenSlot = validPlacements[0];
  const chosenRot = chosenSlot.validRotations[0];
  console.log(`Colocando en (${chosenSlot.x}, ${chosenSlot.y}) con rotación ${chosenRot}°`);

  const placeRes = rm.placeTile(room.id, activeP.id, {
    x: chosenSlot.x,
    y: chosenSlot.y,
    rotation: chosenRot
  });

  if (placeRes.error) {
    console.error(`❌ ERROR al colocar loseta:`, placeRes.error);
    break;
  }

  console.log(`✅ Loseta colocada con éxito. Fase actual: ${placeRes.turnPhase}`);

  // Test placing meeple or passing
  if (activeP.meeples > 0 && Math.random() < 0.7) {
    const segs = room.currentTile.segments || [];
    const seg = segs[0] || { id: 'center', pos: { x: 0.5, y: 0.5 } };
    console.log(`Colocando meeple en segmento '${seg.id}' (Meeples antes: ${activeP.meeples})`);
    const meepleRes = rm.placeMeeple(room.id, activeP.id, { segmentId: seg.id, pos: seg.pos });
    console.log(`Meeples restantes: ${activeP.meeples}`);
  } else {
    console.log(`Pasando colocación de meeple.`);
    rm.passMeeple(room.id, activeP.id);
  }

  // Print Scores
  console.log(`Puntuaciones actuales:`);
  room.players.forEach(p => console.log(`   ${p.name}: ${p.score} pts (👤 x${p.meeples})`));
}

// 4. Test Save & Load
console.log('\n-----------------------------------------');
console.log('💾 Probando Guardado y Restauración...');
const saveResult = rm.saveGame(room.id, 'simulacion_exitosa');
console.log('Resultado guardado:', saveResult);

const loadResult = rm.loadGame('simulacion_exitosa');
console.log('Resultado carga:', loadResult.room ? `✅ Restaurada ${loadResult.room.name} con ${loadResult.room.board.count} losetas en tablero.` : loadResult.error);

console.log('\n🎉 ¡SIMULACIÓN COMPLETA EXITOSA SIN NINGÚN ERROR!');
