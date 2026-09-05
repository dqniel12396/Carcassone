const fs = require('fs');
const path = require('path');
const assert = require('assert');

const jsonPath = path.join(__dirname, '..', 'server', 'engine', 'canonical_tiles.json');
const assetsDir = path.join(__dirname, '..', 'client', 'assets', 'tiles');

console.log('====================================================');
console.log('🔍 VALIDANDO BASE DE DATOS CANÓNICA DE 84 LOSETAS');
console.log('====================================================');

assert(fs.existsSync(jsonPath), 'canonical_tiles.json no existe!');
const catalog = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const tileIds = Object.keys(catalog);

assert.strictEqual(tileIds.length, 84, `Deben haber exactamente 84 losetas, se encontraron ${tileIds.length}`);

let baseCount = 0;
let riverCount = 0;
let springCount = 0;
let lakeCount = 0;

tileIds.forEach(tid => {
  const tile = catalog[tid];
  assert(tile.id === tid, `ID mismatch for ${tid}`);
  assert(Array.isArray(tile.edges) && tile.edges.length === 4, `${tid} debe tener 4 aristas [N, E, S, W]`);
  assert(Array.isArray(tile.segments) && tile.segments.length > 0, `${tid} debe tener al menos 1 segmento`);

  // Verify PNG file exists
  const imgPath = path.join(assetsDir, `${tid}.png`);
  assert(fs.existsSync(imgPath), `Imagen ${tid}.png no existe en ${assetsDir}`);

  if (tile.set === 'base') baseCount++;
  if (tile.set === 'river') riverCount++;
  if (tile.isSpring) springCount++;
  if (tile.isLake) lakeCount++;

  // Validate segments
  tile.segments.forEach(seg => {
    assert(seg.id, `${tid}: Segmento sin ID`);
    assert(['city', 'road', 'field', 'monastery', 'river'].includes(seg.type), `${tid}: Tipo inválido ${seg.type}`);
    assert(seg.pos && typeof seg.pos.x === 'number' && typeof seg.pos.y === 'number', `${tid}: Posición inválida en ${seg.id}`);
    assert(seg.pos.x >= 0 && seg.pos.x <= 1 && seg.pos.y >= 0 && seg.pos.y <= 1, `${tid}: Coordenadas fuera de rango en ${seg.id}`);
  });
});

assert.strictEqual(baseCount, 72, `Deben haber 72 losetas base, hay ${baseCount}`);
assert.strictEqual(riverCount, 12, `Deben haber 12 losetas de río, hay ${riverCount}`);
assert.strictEqual(springCount, 1, `Debe haber exactamente 1 nacimiento (Spring), hay ${springCount}`);
assert.strictEqual(lakeCount, 1, `Debe haber exactamente 1 lago (Lake), hay ${lakeCount}`);

console.log(`✅ Las 84 losetas (${baseCount} base + ${riverCount} río) son 100% canónicas y válidas.`);
console.log('====================================================');
