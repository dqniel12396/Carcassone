#!/usr/bin/env node
// train_from_replays.js — Imitation Learning desde partidas reales
// Uso: node server/scripts/train_from_replays.js
// Analiza los replays guardados y ajusta los pesos del bot.

const path = require('path');
// Ensure we can find engine modules from project root
process.chdir(path.join(__dirname, '../../'));

const BotTrainer = require(path.join(__dirname, '../engine/BotTrainer'));

console.log('');
console.log('🏰 ================================================================');
console.log('   ENTRENAMIENTO POR IMITACIÓN — Carcassonne Bot');
console.log('   Analizando replays para mejorar la estrategia del bot...');
console.log('🏰 ================================================================');
console.log('');

const trainer = new BotTrainer();
trainer.verbose = true;

const results = trainer.learnFromReplays();

if (results.error) {
  console.error('❌ Error:', results.error);
  console.log('');
  console.log('💡 Consejo: Juega algunas partidas locales o contra bots para generar replays.');
  process.exit(1);
}

console.log('📊 ESTADÍSTICAS EXTRAÍDAS:');
console.log('   Replays analizados:', results.replaysAnalyzed);
if (results.patterns) {
  const p = results.patterns;
  console.log('   Puntos promedio por Ciudad completada:', p.avgCityPoints);
  console.log('   Puntos promedio por Camino completado:', p.avgRoadPoints);
  console.log('   Puntos promedio por Monasterio completado:', p.avgMonasteryPoints);
  console.log('   Puntos promedio por Campo (final):', p.avgFieldPoints);
  console.log('   Tasa de victoria del bot:', p.botWinRate);
  console.log('   Eficiencia de meeples (ganadores):', p.winnerMeepleEfficiency);
}

console.log('');

if (Object.keys(results.weightChanges || {}).length === 0) {
  console.log('✅ Los pesos ya están bien optimizados. ¡No se necesitaron cambios!');
} else {
  console.log('🔧 PESOS ACTUALIZADOS:');
  for (const [key, change] of Object.entries(results.weightChanges)) {
    const arrow = change.after > change.before ? '⬆️' : '⬇️';
    console.log(`   ${arrow} ${key}: ${change.before} → ${change.after}`);
  }
  console.log('');
  console.log('✅ Pesos guardados en data/bot_weights.json');
  console.log('   El bot aplicará la mejora automáticamente en la próxima partida.');
}

console.log('');
console.log('🏰 ================================================================');
console.log('');
