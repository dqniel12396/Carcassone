# 🏰 Carcassonne Medieval Edition (Web & CasaOS)

Una recreación web completa, inmersiva y autosuficiente del aclamado juego de mesa **Carcassonne**, diseñada para jugar en línea con amigos, en modo local en el mismo dispositivo, o contra bots impulsados por heurística e inteligencia artificial.

Totalmente compatible con navegadores de escritorio y dispositivos móviles (touch / gestos táctiles).

---

## ✨ Características Principales

### 🎲 Modos de Juego
* **Multijugador en Tiempo Real (Online):** Salas privadas y públicas mediante WebSockets (`Socket.io`) con sincronización instantánea entre múltiples dispositivos.
* **Modo Local (Mismo Dispositivo / Pass & Play):** Juega en familia o con amigos en una sola pantalla sin necesidad de crear salas en red.
* **Inteligencia Artificial y Bots:** 
  * Bots con múltiples niveles de dificultad (Fácil, Medio, Difícil, Maestro).
  * Motor de entrenamiento por auto-juego (*Self-Play*) y aprendizaje a partir de repeticiones (*Replays*).
  * Integración opcional con Google Gemini AI para análisis y comentarios de partidas.

### 📜 Motor de Reglas Oficiales y Validación
* **Juego Base Completo (72 losetas):** Ciudades, caminos, monasterios y campos de cultivo (granjas).
* **Expansión del Río (12 losetas):** Reglas de colocación del río al inicio de la partida (prohibición de curvas en U y cierre con el lago).
* **Colocación de Meeples de Alta Precisión:** Selección granular de la zona (Camino Norte/Sur/Este/Oeste, Ciudad, Monasterio, Esquinas de Campo).
* **Cálculo Automático de Puntuación:**
  * Puntuación intermedia al cerrar caminos, ciudades (con escudos/catedrales) y monasterios.
  * Puntuación final completa (ciudades incompletas, monasterios, caminos y control de granjas por ciudades abastecidas).
* **Modo Sandbox / Libre Opcional:** Permite mover piezas libremente sin restricciones de reglas si se desea jugar estilo simulador de mesa.

### 🎨 Experiencia Visual e Interacción
* **Puntero Láser Multijugador:**
  * Permite señalar y mostrar jugadas a los demás jugadores en tiempo real.
  * **Soporte Móvil Inteligente:** 1 dedo apunta con el láser sin mover el tablero; 2 dedos permiten desplazar (*pan*) y hacer zoom (*pinch to zoom*).
* **Catálogo Rápido y Manuales de Reglas:**
  * Botón integrado para consultar el esquema visual de todas las losetas del juego.
  * Documentación en PDF con las reglas oficiales incluidas en `docs/`.
* **Sistema de Diálogos Medievales:** Modales inmersivos con pergaminos, tipografía temática y botones con efectos de sonido.
* **Audio y Efectos Inmersivos:** Sintetizador de audio web y efectos de madera, colocación de losetas, campanas y fanfarrias.
* **Chat y Replays:** Chat en vivo durante la partida, guardado/carga de partidas en JSON y reproducción paso a paso de partidas finalizadas.

---

## 📁 Estructura del Proyecto

```text
carcassonne-web/
├── client/                     # Interfaz web (Frontend)
│   ├── assets/                 # Texturas HD, meeples, audios, fichas
│   ├── css/                    # Estilos visuales medievales y responsive
│   ├── js/                     # Lógica de cliente (game.js, board.js, audio.js, profile.js)
│   └── index.html              # Punto de entrada de la aplicación
├── server/                     # Backend Node.js
│   ├── engine/                 # Motor de reglas, grafos, mazo, bots y persistencia
│   ├── scripts/                # Scripts de entrenamiento de IA y optimización
│   ├── RoomManager.js          # Gestor de salas y sincronización Socket.io
│   └── index.js                # Servidor Express y WebSocket
├── docs/                       # Manuales oficiales de Carcassonne en PDF
├── scripts/                    # Utilidades de despliegue, validación y catálogo
├── data/                       # Almacén de partidas, usuarios y pesos de IA
├── Dockerfile                  # Imagen Docker optimizada
├── docker-compose.yml          # Configuración de Docker Compose
├── package.json                # Dependencias del proyecto
└── README.md                   # Documentación principal
```

---

## 🚀 Instalación y Ejecución

### 1. Ejecución Local con Node.js

**Requisitos:** Node.js 18+ instalado.

```bash
# Clonar o entrar a la carpeta del proyecto
cd carcassonne-web

# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

Abre tu navegador en: [http://localhost:3080](http://localhost:3080)

---

### 2. Despliegue con Docker Compose

```bash
# Iniciar contenedor en segundo plano
docker compose up -d --build
```

El servidor estará accesible en el puerto `3080`.

---

### 3. Despliegue en CasaOS

1. Abre tu panel de **CasaOS**.
2. Ve a **App Store** > **Instalar app personalizada** (Custom Install).
3. Selecciona **Importar Docker Compose** y utiliza la configuración de `docker-compose.yml`:

```yaml
name: carcassonne-server

services:
  carcassonne:
    build: .
    container_name: carcassonne-server
    restart: unless-stopped
    ports:
      - "3080:3080"
    volumes:
      - ./data:/app/data
    environment:
      - PORT=3080
      - NODE_ENV=production
```

---

## 🤖 Entrenamiento de Bots e Inteligencia Artificial

El proyecto cuenta con herramientas para entrenar y evaluar los bots de juego:

```bash
# Simular partidas automáticas para calibrar pesos heurísticos:
node server/scripts/selfplay_train.js

# Entrenar pesos a partir del historial de partidas guardadas:
node server/scripts/train_from_replays.js
```

---

## 🔒 Variables de Entorno (Opcional)

Puedes configurar un archivo `.env` tomando como base `.env.example`:

```env
PORT=3080
NODE_ENV=production
ADMIN_TOKEN=tu_token_secreto_aqui
GEMINI_API_KEY=tu_api_key_de_gemini
```

---

## 📜 Licencia

Proyecto desarrollado con fines educativos y de entretenimiento. El juego original Carcassonne es propiedad de Hans im Glück y Klaus-Jürgen Wrede.
