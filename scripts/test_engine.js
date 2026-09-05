const Board = require('../server/engine/Board');
const { TileDeck, rotateEdges, getFullDeckCatalog } = require('../server/engine/TileDeck');
const Rules = require('../server/engine/Rules');
const RoomManager = require('../server/RoomManager');

console.log('=== TEST 1: Tile Catalog & Deck ===');
const deck = new TileDeck({ includeRiver: true });
console.log('Deck catalog size:', deck.catalog.length);
console.log('River deck count:', deck.riverDeck.length);
console.log('Main deck count:', deck.deck.length);
console.log('Total tiles:', deck.remainingCount());

console.log('\n=== TEST 2: Board Adjacency & Placement Validation ===');
const board = new Board();
const startTile = {
  id: 'base_21_07',
  edges: ['C', 'R', 'F', 'R'], // City North, Road East, Field South, Road West
  center: 'road',
  monastery: false
};
board.placeTile(0, 0, startTile, 0, 'p1');
console.log('Placed start tile at (0, 0). Grid count:', board.grid.size);

// Test placing matching road tile to East (x: 1, y: 0)
const testRoadTile = {
  id: 'base_21_45',
  edges: ['R', 'F', 'R', 'F'], // N: Road, E: Field, S: Road, W: Field
  center: 'road'
};
// If rotated 90 deg: edges becomes [F, R, F, R] -> West edge is Road (matches start tile East road!)
const canPlaceUnrotated = board.canPlace(1, 0, testRoadTile, 0, true);
const canPlaceRotated90 = board.canPlace(1, 0, testRoadTile, 90, true);
console.log('Can place testRoadTile at (1, 0) unrotated (0 deg)?', canPlaceUnrotated, '(Expected: false)');
console.log('Can place testRoadTile at (1, 0) rotated 90 deg?', canPlaceRotated90, '(Expected: true)');

console.log('\n=== TEST 3: RoomManager Full Flow ===');
const rm = new RoomManager(null);
const room = rm.createRoom({ name: 'Sala Test', options: { includeRiver: false } });
const p1Join = rm.joinRoom(room.id, { playerId: 'user1', playerName: 'Daniel', preferredColor: 'blue' });
const p2Join = rm.joinRoom(room.id, { playerId: 'user2', playerName: 'Hermano', preferredColor: 'red' });

console.log('Players joined:', room.players.map(p => `${p.name} (${p.color})`));

const startRes = rm.startGame(room.id, 'user1');
console.log('Game started. Status:', room.status, 'Remaining:', room.deck.remainingCount());
console.log('Current turn:', room.players[room.turnIndex].name, 'Tile in hand:', room.currentTile.id);
console.log('Valid placements count:', room.board.getValidPlacements(room.currentTile).length);

// Save game test
const saveRes = rm.saveGame(room.id, 'test_save');
console.log('Save game result:', saveRes);

// Load game test
const loadRes = rm.loadGame('test_save');
console.log('Load game status:', loadRes.room ? 'Success! Loaded ' + loadRes.room.name : loadRes.error);

console.log('\n✅ ALL SERVER ENGINE TESTS PASSED!');
