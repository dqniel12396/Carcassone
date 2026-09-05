#!/usr/bin/env node
// selfplay_train.js — Entrenamiento autónomo: Bot vs Bot con Hill-Climbing
// Uso: node server/scripts/selfplay_train.js [--games N] [--iterations N]
// Ejemplo: node server/scripts/selfplay_train.js --games 300 --iterations 8

const path = require('path');
process.chdir(path.join(__dirname, '../../'));

const BotTrainer = require(path.join(__dirname, '../engine/BotTrainer'));
const BotEngine = require(path.join(__dirname, '../engine/BotEngine'));

// Parse args
const args = process.argv.slice(2);
let games = 200;
let iterations = 5;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--games' && args[i + 1]) games = parseInt(args[i + 1]);
  if (args[i] === '--iterations' && args[i + 1]) iterations = parseInt(args[i + 1]);
}

console.log('');
console.log('⚔️  ================================================================');
console.log('   ENTRENAMIENTO SELF-PLAY — Bot vs Bot');
console.log(`   ${games} partidas × ${iterations} iteraciones de optimización`);
console.log('⚔️  ================================================================');
console.log('');
console.log('   Esto puede tardar varios minutos. No cierres esta ventana.');
console.log('');

const startTime = Date.now();
const trainer = new BotTrainer();

function formatTime(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function onProgress(iterResult) {
  const elapsed = Date.now() - startTime;
  const pctA = ((iterResult.playerAWins / iterResult.games) * 100).toFixed(1);
  const pctB = ((iterResult.playerBWins / iterResult.games) * 100).toFixed(1);
  console.log(`   📈 Iter ${iterResult.iteration}/${iterations} | ` +
    `Bot A: ${iterResult.playerAWins} victorias (${pctA}%) | ` +
    `Bot B: ${iterResult.playerBWins} victorias (${pctB}%) | ` +
    `Empates: ${iterResult.draws} | ` +
    `Puntos A: ${iterResult.avgPointsA} | ` +
    `Tiempo: ${formatTime(elapsed)}`);
}

const initialWeights = BotEngine.loadWeights();
console.log('📊 Pesos iniciales:');
for (const [k, v] of Object.entries(initialWeights)) {
  if (typeof v === 'number') console.log(`   ${k}: ${v}`);
}
console.log('');
console.log('🎮 Iniciando partidas simuladas...');
console.log('');

trainer.selfPlayTrain({ games, iterations, onProgress }).then(summary => {
  const elapsed = Date.now() - startTime;
  const totalGames = games * iterations;

  console.log('');
  console.log('✅ ¡Entrenamiento completado!');
  console.log(`   Total de partidas simuladas: ${totalGames}`);
  console.log(`   Tiempo total: ${formatTime(elapsed)}`);
  console.log(`   Tasa de victoria óptima encontrada: ${(summary.bestWinRate * 100).toFixed(1)}%`);
  console.log('');

  if (summary.finalWeights) {
    const prev = initialWeights;
    const curr = summary.finalWeights;
    const changes = Object.keys(curr).filter(k => typeof curr[k] === 'number' && Math.abs((curr[k] || 0) - (prev[k] || 0)) > 0.01);
    if (changes.length > 0) {
      console.log('🔧 PESOS MEJORADOS:');
      for (const key of changes) {
        const arrow = curr[key] > prev[key] ? '⬆️' : '⬇️';
        console.log(`   ${arrow} ${key}: ${prev[key]} → ${parseFloat(curr[key].toFixed(3))}`);
      }
    } else {
      console.log('✨ Los pesos ya estaban bien optimizados.');
    }
  }

  console.log('');
  console.log('   Los cambios se aplicarán automáticamente en la próxima partida.');
  console.log('');
  console.log('⚔️  ================================================================');
  console.log('');
}).catch(e => {
  console.error('❌ Error durante el entrenamiento:', e.message);
  process.exit(1);
});
