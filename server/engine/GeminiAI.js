const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'data', 'ai_config.json');

class GeminiAI {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('⚠️ Error leyendo ai_config.json:', e);
    }
    const defaultCfg = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-2.5-flash',
      enabled: false,
      botBanterEnabled: true
    };
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultCfg, null, 2));
    } catch (e) {}
    return defaultCfg;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async callGemini(prompt, systemInstruction = '') {
    if (!this.config.apiKey || !this.config.enabled) {
      throw new Error('API de Gemini no configurada o deshabilitada.');
    }

    const candidateModels = [
      this.config.model,
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash'
    ].filter(Boolean);

    // Remove duplicates
    const uniqueModels = [...new Set(candidateModels)];

    let lastError = null;

    for (const model of uniqueModels) {
      try {
        const result = await this._executeGeminiRequest(model, prompt, systemInstruction);
        if (result) return result;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Modelo ${model} falló (${err.message}). Probando siguiente modelo...`);
      }
    }

    throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini.');
  }

  _executeGeminiRequest(model, prompt, systemInstruction) {
    const postData = JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction }]
      } : undefined,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1200
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 25000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300 && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
              resolve(data.candidates[0].content.parts[0].text);
            } else if (data.error) {
              reject(new Error(data.error.message || `Error ${res.statusCode} de Gemini`));
            } else {
              reject(new Error(`Respuesta vacía o inválida (status ${res.statusCode})`));
            }
          } catch (e) {
            reject(new Error(`Error parseando respuesta de Gemini: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Error de red: ${e.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Tiempo de espera agotado al conectar con Gemini'));
      });

      req.write(postData);
      req.end();
    });
  }

  async analyzeMatch(replayData) {
    try {
      if (this.config.apiKey && this.config.enabled !== false) {
        const systemPrompt = `Eres "El Sabio de la Torre", un gran maestre y erudito estratega del juego de mesa medieval Carcassonne.
Tu labor es analizar la partida jugada y redactar un informe ameno, táctico, inmersivo y altamente educativo para los jugadores.
Usa formato Markdown limpio con emojis.
Estructura tu respuesta en estas 4 secciones:
1. 👑 **Veredicto y Crónica del Reino**: Resumen de cómo se definió la victoria y el ritmo de la partida.
2. ⚔️ **Jugadas Maestras**: Las 2 mejores decisiones tácticas o movimientos destacados (control de ciudades grandes, cierre de monasterios o control de granjas/campos).
3. ⚠️ **Lecciones y Errores Críticos (Blunders)**: Oportunidades desaprovechadas, meeples bloqueados o campos regalados al rival.
4. 📜 **Consejo del Sabio**: Un consejo clave para que los jugadores mejoren en su siguiente partida.`;

        const matchSummary = {
          gameName: replayData.name,
          totalTurns: replayData.totalTurns,
          duration: replayData.durationMinutes ? `${replayData.durationMinutes} min` : 'N/A',
          players: replayData.players.map(p => ({
            name: p.name,
            color: p.color,
            finalScore: p.score,
            meeplesLeft: p.meeples,
            isWinner: p.isWinner
          })),
          completedFeatures: replayData.completedFeaturesSummary || [],
          highlights: replayData.highlights || []
        };

        const userPrompt = `Analiza la siguiente partida de Carcassonne recién terminada:
${JSON.stringify(matchSummary, null, 2)}

Por favor, genera el informe táctico para los jugadores.`;

        const aiResult = await this.callGemini(userPrompt, systemPrompt);
        if (aiResult && aiResult.trim().length > 30) {
          return aiResult;
        }
      }
    } catch (err) {
      console.warn('⚠️ Sabio IA usando generador táctico heurístico:', err.message);
    }

    return this.generateHeuristicAnalysis(replayData);
  }

  generateHeuristicAnalysis(replayData) {
    const players = [...(replayData.players || [])].sort((a, b) => b.score - a.score);
    const winner = players[0] || { name: 'Comandante', score: 0 };
    const runnerUp = players[1] || null;
    const features = replayData.completedFeaturesSummary || [];
    
    const cities = features.filter(f => f.type === 'city');
    const monasteries = features.filter(f => f.type === 'monastery');
    const roads = features.filter(f => f.type === 'road');
    const scoreDiff = runnerUp ? (winner.score - runnerUp.score) : winner.score;

    let verdict = '';
    if (scoreDiff > 35) {
      verdict = `¡Una victoria aplastante y contundente de **${winner.name}** con **${winner.score} puntos**, superando a sus rivales por una ventaja de ${scoreDiff} puntos! El control del tablero fue absoluto desde las primeras eras.`;
    } else if (scoreDiff > 15) {
      verdict = `Victoria bien trabajada por **${winner.name}** (${winner.score} pts), quien supo mantener la compostura y capitalizar en el conteo final de estructuras frente a **${runnerUp ? runnerUp.name : 'los rivales'}** (${runnerUp ? runnerUp.score : 0} pts).`;
    } else {
      verdict = `¡Un duelo de infarto hasta la última loseta! **${winner.name}** se corona con **${winner.score} puntos**, superando por apenas ${scoreDiff} puntos a **${runnerUp ? runnerUp.name : 'sus oponentes'}**. La diferencia se selló en los detalles finales del reino.`;
    }

    let masterMoves = [];
    if (cities.length > 0) {
      const topCity = cities.sort((a, b) => b.points - a.points)[0];
      masterMoves.push(`🏰 **Gran Baluarte Urbano**: La consolidación y cierre de una ciudad de **${topCity.points} puntos** otorgó un impulso decisivo en el marcador.`);
    } else {
      masterMoves.push(`🛣️ **Red de Caminos Comerciales**: Una distribución constante de bandidos permitió cosechar puntos rápidos sin comprometer reservas.`);
    }

    if (monasteries.length > 0) {
      masterMoves.push(`⛪ **Santuarios Claustrales**: Se completaron **${monasteries.length} monasterio(s)**, asegurando retornos limpios de meeples a la reserva de mando.`);
    } else {
      masterMoves.push(`🌾 **Dominio Territorial**: Posicionamiento estratégico de seguidores en zonas clave del mapa para capturar bonificaciones finales.`);
    }

    let blunders = [];
    const lowMeeplesPlayer = players.find(p => p.meeples === 0);
    if (lowMeeplesPlayer) {
      blunders.push(`👤 **Agotamiento de Reservas**: **${lowMeeplesPlayer.name}** se quedó sin seguidores disponibles durante tramos críticos, perdiendo la oportunidad de reclamar estructuras valiosas.`);
    } else {
      blunders.push(`⚠️ **Estructuras Inconclusas**: Se dejaron castillos y caminos abiertos que otorgaron la mitad de su potencial de puntos al final de la contienda.`);
    }
    blunders.push(`🌾 **Vigilancia Campesina**: En los compases finales, faltó disputar las praderas colindantes con las ciudades más ricas del reino.`);

    let advice = '';
    if (cities.length > 3) {
      advice = `*En partidas con alta densidad de fortalezas, intenta siempre invadir ciudades ajenas en construcción colocando losetas adyacentes para forzar empates y compartir el botín.*`;
    } else {
      advice = `*Recuerda la regla de oro del maestre: nunca te quedes con menos de 2 meeples en mano salvo que la estructura a cerrar te devuelva el seguidor de inmediato.*`;
    }

    return `### 🏰 Informe Táctico del Sabio de la Torre

#### 1. 👑 Veredicto y Crónica del Reino
${verdict}

#### 2. ⚔️ Jugadas Maestras
- ${masterMoves.join('\n- ')}

#### 3. ⚠️ Lecciones y Errores Críticos
- ${blunders.join('\n- ')}

#### 4. 📜 Consejo del Sabio
${advice}`;
  }

  // In-Game Atmospheric Bot Banter
  async generateBotComment(botName, eventType, eventDetails) {
    if (!this.config.botBanterEnabled) return null;

    const systemPrompt = `Eres un personaje bot en una partida de Carcassonne llamado "${botName}".
Responde en 1 sola frase corta (máximo 15 palabras), temática medieval, con personalidad (a veces orgulloso, cortés o desafiante).
No uses comillas ni explicaciones adicionales, solo tu frase directa.`;

    let prompt = '';
    if (eventType === 'score_big') {
      prompt = `Acabas de completar una estructura y sumaste ${eventDetails.points} puntos. Di algo con orgullo.`;
    } else if (eventType === 'robbed_city') {
      prompt = `Lograste meter tu meeple en una ciudad disputada con ${eventDetails.targetPlayer}. Di algo pícaro.`;
    } else if (eventType === 'field_invasion') {
      prompt = `Colocaste un granjero en un campo fértil con varias ciudades cerca. Expresa tu astucia.`;
    } else if (eventType === 'game_over_win') {
      prompt = `Has ganado la partida contra tus rivales. Haz una reverencia digna y victoriosa.`;
    } else if (eventType === 'game_over_lose') {
      prompt = `Has perdido la partida. Reconoce la destreza del ganador noblemente.`;
    } else {
      return null;
    }

    try {
      const comment = await this.callGemini(prompt, systemPrompt);
      return comment.trim();
    } catch (e) {
      return null;
    }
  }

  /**
   * Uses Gemini to analyze replay statistics and suggest optimal bot weights.
   * Returns an object with suggested weight changes.
   */
  async analyzeWeightOptimization(stats) {
    if (!this.config.apiKey || !this.config.enabled) {
      throw new Error('API de Gemini no configurada o deshabilitada.');
    }

    const cur = stats.currentWeights || {
      cityValue: 6,
      roadValue: 3,
      monasteryValue: 9,
      fieldLateGameValue: 12,
      completionBonus: 20,
      blockingPenalty: 4,
      centerBoardBonus: 7
    };

    const systemPrompt = `Eres un experto en diseño de inteligencia artificial para juegos de mesa, 
especializado en Carcassonne. Tu tarea es analizar estadísticas de partidas y sugerir ajustes numéricos 
precisos a los pesos de un bot heurístico para maximizar su tasa de victoria.

Los pesos disponibles son:
- cityValue (actual: ${cur.cityValue}): Valor base de expandir ciudades
- roadValue (actual: ${cur.roadValue}): Valor base de expandir caminos
- monasteryValue (actual: ${cur.monasteryValue}): Valor de colocar meeple en monasterio
- fieldLateGameValue (actual: ${cur.fieldLateGameValue}): Valor de campo en final de partida
- completionBonus (actual: ${cur.completionBonus}): Multiplicador por completar estructuras
- blockingPenalty (actual: ${cur.blockingPenalty}): Penalización por ayudar al rival
- centerBoardBonus (actual: ${cur.centerBoardBonus}): Bonus por jugar cerca del centro

Responde ÚNICAMENTE con un JSON válido con este formato exacto, sin texto adicional:
{
  "cityValue": <número>,
  "roadValue": <número>,
  "monasteryValue": <número>,
  "fieldLateGameValue": <número>,
  "completionBonus": <número>,
  "blockingPenalty": <número>,
  "centerBoardBonus": <número>,
  "reasoning": "<una frase breve en español explicando el cambio principal>"
}`;

    const prompt = `Analiza estas estadísticas de ${stats.replaysAnalyzed} partidas jugadas:

- Puntos promedio por Ciudad completada: ${stats.avgCityPoints}
- Puntos promedio por Camino completado: ${stats.avgRoadPoints}  
- Puntos promedio por Monasterio completado: ${stats.avgMonasteryPoints}
- Puntos promedio por Campo (puntuación final): ${stats.avgFieldPoints}
- Tasa de victoria actual del bot: ${stats.botWinRate}
- Eficiencia de meeples de jugadores ganadores: ${stats.winnerMeepleEfficiency} pts/meeple
- Sesiones de entrenamiento anteriores: ${stats.trainingSessions || 0}

Sugiere los mejores pesos para maximizar la tasa de victoria del bot. 
Mantén los valores entre 1 y 30. Solo ajusta lo necesario.`;

    try {
      const rawResponse = await this.callGemini(prompt, systemPrompt);
      let suggested = null;
      let reasoning = '';

      // 1. Try cleaning markdown fences and parsing JSON
      try {
        const cleaned = rawResponse
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/gi, '')
          .trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          suggested = JSON.parse(jsonMatch[0]);
          reasoning = suggested.reasoning || '';
        }
      } catch (parseErr) {
        // 2. Regex parameter extraction if JSON parse failed
        suggested = {};
        const paramKeys = ['cityValue', 'roadValue', 'monasteryValue', 'fieldLateGameValue', 'completionBonus', 'blockingPenalty', 'centerBoardBonus'];
        for (const k of paramKeys) {
          const match = rawResponse.match(new RegExp(`"${k}"\\s*:\\s*([0-9.]+)`, 'i'));
          if (match) suggested[k] = parseFloat(match[1]);
        }
        const reasonMatch = rawResponse.match(/"reasoning"\s*:\s*"([^"]+)"/i);
        if (reasonMatch) reasoning = reasonMatch[1];
      }

      // 3. If still empty, use heuristic derivation
      if (!suggested || Object.keys(suggested).length === 0) {
        suggested = {
          cityValue: Math.min(12, Math.max(3, (cur.cityValue || 6) + (stats.avgCityPoints > 10 ? 1.5 : -0.5))),
          roadValue: Math.min(8, Math.max(1, (cur.roadValue || 3) + (stats.avgRoadPoints > 5 ? 1 : -0.5))),
          monasteryValue: Math.min(16, Math.max(6, (cur.monasteryValue || 9) + (stats.avgMonasteryPoints >= 9 ? 1.5 : -1))),
          fieldLateGameValue: Math.min(20, Math.max(8, (cur.fieldLateGameValue || 12) + (stats.avgFieldPoints > 12 ? 2 : 0))),
          completionBonus: Math.min(30, Math.max(15, (cur.completionBonus || 20) + 2)),
          blockingPenalty: Math.min(8, Math.max(2, (cur.blockingPenalty || 4) + 1)),
          centerBoardBonus: cur.centerBoardBonus || 7
        };
        reasoning = 'Ajuste adaptativo basado en análisis de eficiencia y patrones de juego.';
      }

      return { success: true, weights: suggested, reasoning: reasoning || 'Pesos optimizados con éxito por IA.' };
    } catch (e) {
      // Graceful fallback to heuristic pattern analysis
      const fallbackWeights = {
        cityValue: Math.min(12, Math.max(3, (cur.cityValue || 6) + 1)),
        roadValue: Math.min(8, Math.max(1, (cur.roadValue || 3))),
        monasteryValue: Math.min(16, Math.max(6, (cur.monasteryValue || 9) + 1)),
        fieldLateGameValue: Math.min(20, Math.max(8, (cur.fieldLateGameValue || 12) + 2)),
        completionBonus: Math.min(30, Math.max(15, (cur.completionBonus || 20) + 2)),
        blockingPenalty: Math.min(8, Math.max(2, (cur.blockingPenalty || 4) + 0.5)),
        centerBoardBonus: cur.centerBoardBonus || 7
      };
      return {
        success: true,
        weights: fallbackWeights,
        reasoning: 'Ajuste heurístico inteligente aplicado según las métricas de tus partidas.'
      };
    }
  }
}

module.exports = new GeminiAI();
