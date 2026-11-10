# Guía de Arquitectura e Instrucciones para Agentes y Desarrolladores

Este repositorio contiene la versión web multijugador completa de **Carcassonne Medieval Edition**, optimizada para ejecutarse localmente y en nuestro servidor CasaOS con acceso Tailscale.

---

## 📌 1. Información del Entorno y Acceso a CasaOS

* **Directorio local de trabajo:** `f:\Proyectos\CASAosServer\carcassonne-web`
* **Repositorio oficial de GitHub:** `git@github.com:dqniel12396/Carcassone.git` (o vía HTTPS `https://github.com/dqniel12396/Carcassone.git`)
* **Rama principal:** `main`
* **Servidor CasaOS:**
  * **IP Tailscale:** `100.84.82.77`
  * **Puerto Web:** `3080` (ej. `http://100.84.82.77:3080`)
  * **Acceso SSH:** `ssh server@100.84.82.77` | Contraseña: `server` (sudo pass: `server`)
  * **Directorio en el servidor:** `/DATA/AppData/carcassonne-web`
  * **Contenedor Docker:** `carcassonne-server` / `carcassonne-web:latest`
  * **Servicio de Túnel Cloudflare / Telegram:** `carcassonne-tunnel.service`

---

## 🛠️ 2. Arquitectura del Proyecto

* **Backend:** Node.js con Express y Socket.io (`server/index.js`, `server/RoomManager.js`).
* **Motor de Reglas y Grafo:**
  * `server/engine/BoardGraph.js`: Detección de caminos, ciudades, monasterios y granjas.
  * `server/engine/Rules.js`: Validación de colocación de fichas, meeples y cálculo de puntuaciones.
  * `server/engine/canonical_tiles.json`: Definición canónica de las 72 fichas del juego base.
  * `server/engine/UserManager.js`: Autenticación, perfiles, avatares y roles.
* **Frontend:** Vanilla JS modular + Canvas interactivo + CSS medieval tematizado (`client/js/board.js`, `client/js/game.js`, `client/css/style.css`).
* **Características Clave:**
  * Multi-sala y persistencia de partidas (`data/saves/`).
  * Reloj de ajedrez por turnos configurable.
  * Previsualización estratégica de la ficha entrante para el jugador en turno siguiente.
  * Crash Shield para protección ante errores inesperados en sockets.

---

## 📋 3. Reglas Obligatorias de Flujo de Trabajo (Git Colaborativo)

Para trabajar en equipo sin pisar cambios ni desincronizar la rama:

### ⚠️ ANTES de empezar a trabajar o modificar archivos:
1. Asegúrate de estar en la rama `main` y con el árbol limpio:
   ```bash
   git status
   ```
2. **Descarga siempre los últimos cambios remotos:**
   ```bash
   git pull origin main
   ```

### 🛠️ DURANTE el desarrollo:
* Verifica la sintaxis de los archivos modificados antes de commitear:
  ```bash
  node -c server/index.js
  ```
* Respeta la integridad de los datos en `data/` (no commitear archivos con claves privadas o secretos).

### 🚀 AL FINALIZAR cada mejora o corrección:
1. Realiza el commit con un mensaje descriptivo y claro:
   ```bash
   git add .
   git commit -m "feat/fix: descripción clara del cambio"
   ```
2. **Sube los cambios a GitHub inmediatamente:**
   ```bash
   git push origin main
   ```
3. Si el cambio debe reflejarse en el servidor CasaOS, actualiza el código en `/DATA/AppData/carcassonne-web` y reinicia el contenedor (`docker restart carcassonne-server`).

