# Plan de Implementación: Sistema de Notificaciones de Turno, Sonidos Personalizados, Estado Listo, Eliminación de Salas y Corrección de Bugs

Este plan detalla la solución completa a los 5 puntos solicitados por el usuario para llevar la experiencia multijugador y local de Carcassonne al siguiente nivel.

---

## 1. Diagnóstico de Problemas y Bugs Identificados

1. **Retardo y Clics Múltiples al Colocar Loseta:**
   - Al hacer clic en una casilla o confirmar una loseta, no había bloqueo de interacción inmediato ni *feedback* optimista instantáneo en el cliente mientras viajaba la respuesta por socket. Esto permitía dar clics repetidos y producía la sensación de que "no se ponía" hasta que llegaba el evento de golpe.
2. **Duplicación y Eliminación de Salas en el Lobby:**
   - La lista de salas en `game.js` acumulaba elementos si no se limpiaba el contenedor antes de re-renderizar, y faltaba el endpoint / evento `delete_room` para que el anfitrión pueda borrar su sala del listado si decide no jugar.
3. **Bug de "Jugadores en Reposo":**
   - En partidas locales (`room.isLocal`), los jugadores se creaban con IDs locales, pero la lógica evaluaba `!p.connected`. En partidas locales o con reconexiones, no se distinguía entre jugador local y jugador socket desconectado, marcando a ambos en reposo por error.
4. **Falta de Sistema "Listo" (Ready Check) y Sonidos de Turno Personalizados:**
   - No existía botón de "Listo" en el lobby, por lo que el anfitrión podía iniciar sin que los demás estuviesen preparados.
   - El sonido de cambio de turno era genérico y no había selector de sonidos medievales/guerra ni notificaciones de navegador cuando el usuario está en otra pestaña.

---

## 2. Cambios Propuestos

### A. Corrección de Detección de Estado Conectado / Reposo (`RoomManager.js` & `game.js`)
- En `server/RoomManager.js`:
  - Partidas locales (`isLocal: true`) siempre mantienen `connected: true`.
  - En partidas online, vincular `socket.id` y `player.id` de forma persistente. Al reconectarse con el mismo `playerId`, marcar `connected: true` inmediatamente y emitir la actualización.
- En `client/js/game.js`:
  - `isIdle = !room.isLocal && !p.isBot && !p.connected`. Nunca marcar en reposo en partidas locales o bots.

### B. Bloqueo Inmediato Anti-Doble Clic y Feedback Optimista (`board.js` & `game.js`)
- Añadir bandera `this.isSubmittingPlacement = true` en `BoardRenderer` y `game.js`.
- Al confirmar la colocación:
  - Deshabilitar inmediatamente nuevos clics en el tablero.
  - Reproducir sonido de colocación al instante.
  - Mostrar micro-animación de colocación inmediata mientras el servidor valida.
  - Liberar el bloqueo cuando llegue `room_updated` o `error`.

### C. Eliminación de Salas y Limpieza de Duplicados en Lobby (`RoomManager.js`, `index.js`, `game.js`)
- Añadir evento socket y API `delete_room`:
  - Solo el anfitrión (`isHost`) puede eliminar la sala.
  - Al eliminar la sala, notificar a los miembros y redirigirlos al lobby.
  - Re-renderizado limpio de la lista de salas (`roomsListEl.innerHTML = ''` con prevención de duplicados por ID).

### D. Sistema de Preparación "Estoy Listo" en Sala de Espera (`RoomManager.js` & `game.js`)
- Cada jugador en el lobby tendrá un estado `isReady: boolean`.
- Botón interactivo: `⚔️ ¡Estoy Listo!` / `⏳ No Preparado`.
- El anfitrión verá qué jugadores están listos con un badge verde brillante `✅ Listo` / amarillo `⏳ Esperando`.
- El botón de "Iniciar Partida" se activará cuando todos los jugadores humanos estén listos (o con confirmación del anfitrión).

### E. Sonidos de Turno Personalizados y Notificaciones Web (`audio.js`, `game.js`, `index.html`)
- Generador y sintetizador de Audio Web temático medieval / bélico en `audio.js`:
  1. 📯 **Cuerno de Guerra Nórdico** (*Deep War Horn*)
  2. 🎺 **Fanfarria Real de Trompetas** (*Royal Trumpets*)
  3. ⚔️ **Choque de Espadas y Escudos** (*Sword Clash*)
  4. 🔔 **Campana de Catedral Medieval** (*Cathedral Bell*)
  5. 🥁 **Tambores de Asedio** (*Siege War Drums*)
  6. 🪕 **Arpa / Laúd de Trovador** (*Bard Harp*)
- Selector de sonido en el Lobby con botón de prueba `🔊 Probar`.
- Guardado de preferencia de sonido en el perfil local (`profile.js` / `localStorage`).
- **Notificaciones Web (Push / Browser Notifications API):**
  - Solicitar permiso al unirse a una partida (`Notification.requestPermission()`).
  - Si el usuario minimiza la pestaña o cambia de ventana, enviar notificación nativa:  
    *🏰 ¡Es tu turno en Carcassonne! Te toca colocar loseta.*
  - Parpadeo dinámico del título de la pestaña: `🔔 [¡TU TURNO!] Carcassonne`.

---

## 3. Plan de Verificación

1. **Prueba de Colocación Rápida:**
   - Hacer clics rápidos al colocar una loseta para verificar que no hay duplicación de peticiones ni congelamiento, y que la loseta entra al instante.
2. **Prueba de Eliminación de Sala:**
   - Crear una sala, verificar el listado, eliminarla con el botón del anfitrión y comprobar que desaparece de la lista sin duplicados.
3. **Prueba del Sistema "Listo":**
   - Entrar con 2 jugadores, alternar el botón de "Listo" y verificar que el anfitrión ve los estados en tiempo real.
4. **Prueba de Sonidos y Notificaciones Web:**
   - Probar cada uno de los 6 sonidos en el lobby.
   - Cambiar a otra pestaña del navegador en un turno y verificar que salta la notificación nativa del sistema y el sonido personalizado elegido.
5. **Prueba de Estado Conectado / Reposo:**
   - Verificar que en partidas locales no aparezca "En reposo" y que en online solo aparezca si un socket realmente se desconecta.
