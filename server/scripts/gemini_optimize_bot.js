#!/usr/bin/env node
// gemini_optimize_bot.js — Optimización de pesos con Gemini AI
// Uso: node server/scripts/gemini_optimize_bot.js

const path = require('path');
process.chdir(path.join(__dirname, '../../'));

const BotTrainer = require(path.join(__dirname, '../engine/BotTrainer'));
const BotEngine = require(path.join(__dirname, '../engine/BotEngine'));
const GeminiAI = require(path.join(__dirname, '../engine/GeminiAI'));
const fs = require('fs');

console.log('');
console.log('🧙‍♂️ ================================================================');
console.log('   OPTIMIZACIÓN DE PESOS CON GEMINI IA');
console.log('   El Sabio de la Torre analizará tus partidas...');
console.log('🧙‍♂️ ================================================================');
console.log('');

async function run() {
  // Step 1: Run imitation learning to get stats
  const trainer = new BotTrainer();
  console.log('📊 Paso 1: Analizando replays para extraer estadísticas...');
  const learnResult = trainer.learnFromReplays();

  if (learnResult.error) {
    console.error('❌ Error:', learnResult.error);
    process.exit(1);
  }

  const currentWeights = BotEngine.loadWeights();
  const weightConfig = JSON.parse(fs.readFileSync(BotEngine.WEIGHTS_PATH, 'utf8'));
  
  const stats = {
    ...learnResult.patterns,
    currentWeights,
    trainingSessions: weightConfig.trainingSessions || 0,
    replaysAnalyzed: learnResult.replaysAnalyzed
  };

  console.log('   ✅ Estadísticas listas.');
  console.log('');
  console.log('🤖 Paso 2: Consultando a Gemini para optimización de pesos...');
  console.log('   (Esto puede tomar unos segundos)');
  console.log('');

  // Step 2: Ask Gemini for optimal weights
  const geminiResult = await GeminiAI.analyzeWeightOptimization(stats);

  if (!geminiResult.success) {
    console.error('❌ Error al consultar Gemini:', geminiResult.error);
    console.log('   Aplicando solo los ajustes de Imitation Learning...');
    // Fall back to imitation learning results only
    process.exit(0);
  }

  const suggestedWeights = geminiResult.weights;
  delete suggestedWeights.reasoning;

  // Filter to only valid numeric weights
  const validWeights = {};
  for (const [key, val] of Object.entries(suggestedWeights)) {
    if (typeof val === 'number' && val >= 1 && val <= 30) {
      validWeights[key] = val;
    }
  }

  console.log('💡 Razonamiento de Gemini:');
  console.log('  ', geminiResult.reasoning || '(Sin razonamiento proporcionado)');
  console.log('');
  console.log('🔧 PESOS SUGERIDOS POR GEMINI:');
  for (const [key, val] of Object.entries(validWeights)) {
    const prev = currentWeights[key];
    const arrow = val > prev ? '⬆️' : val < prev ? '⬇️' : '➡️';
    console.log(`   ${arrow} ${key}: ${prev} → ${val}`);
  }
  console.log('');

  // Step 3: Apply weights
  BotEngine.saveWeights(validWeights, { method: 'gemini_optimization' });

  console.log('✅ ¡Pesos actualizados con la sabiduría de Gemini!');
  console.log('   El bot aplicará los cambios automáticamente en la próxima partida.');
  console.log('');
  console.log('🧙‍♂️ ================================================================');
  console.log('');
}

run().catch(e => {
  console.error('Error inesperado:', e.message);
  process.exit(1);
});
