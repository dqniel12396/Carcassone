# Auditoría completa de Carcassonne Web

**Fecha:** 28 de agosto de 2026  
**Proyecto auditado:** `carcassonne-web`  
**Alcance:** arquitectura, servidor, cliente, motor de juego, multijugador, guardado/carga, seguridad, despliegue, accesibilidad, experiencia de uso, scripts de prueba, recursos gráficos, README y `carcassonereglas2.pdf`.

## 1. Resumen ejecutivo

El proyecto tiene una base visual atractiva, se inicia correctamente, sirve todos los recursos principales y permite crear salas, colocar losetas, guardar partidas y ejecutar simulaciones. La estructura es pequeña y fácil de seguir. Sin embargo, **todavía no implementa una partida reglamentaria fiable de Carcassonne**. El mayor riesgo no es cosmético: está en las reglas, el control del estado y la ausencia de autorización en los eventos Socket.IO.

### Veredicto

| Área | Estado | Evaluación |
|---|---:|---|
| Arranque y recursos HTTP | Aprobado | La instancia existente respondió 200 en siete rutas y recursos principales. |
| Presentación de escritorio | Aprobado con observaciones | El lobby renderiza bien en Chrome a 1440×1000. |
| Reglas de colocación de losetas | Parcial | Valida bordes básicos, pero no la regla especial del Río ni varias topologías internas. |
| Seguidores | No aprobado | No valida segmento, ocupación ni conectividad; permite posiciones y segmentos inventados. |
| Puntuación durante la partida | No aprobado | La mayoría de caminos y ciudades con seguidores no se detectan por IDs incompatibles y topologías simplificadas. |
| Puntuación final | No implementada | No puntúa caminos/ciudades/monasterios incompletos ni campos. |
| Flujo de turnos | No aprobado | Un cliente puede pasar sin haber colocado loseta y consumir el mazo. |
| Multijugador y reconexión | No aprobado | Identidad suplantable, reconexión incompleta, carga de partidas inutilizable para continuar de forma normal. |
| Seguridad/autorización | Crítico | Cualquier cliente de la sala puede cambiar modo, puntuaciones y tablero; los guardados son globales y manipulables. |
| Pruebas | Insuficiente | Hay scripts de demostración sin aserciones; no existe suite automatizada declarada. |
| Manuales | No alineados | El README promete más de lo implementado y el PDF corresponde a Posadas y Catedrales, expansión ausente. |
| Producción pública | No recomendable | Adecuado sólo como prototipo en una red confiable hasta corregir los bloqueantes. |

### Conteo de hallazgos

- 12 críticos.
- 17 altos.
- 15 medios.
- 9 bajos/mejoras.

## 2. Qué se revisó y qué se ejecutó

### Inspección estática

- `server/index.js`, `server/RoomManager.js` y todo `server/engine/`.
- `client/index.html`, `client/js/` y `client/css/style.css`.
- `Dockerfile`, `docker-compose.yml`, `package.json` y `package-lock.json`.
- Los tres catálogos JSON de losetas y los scripts de `scripts/`.
- README y las dos páginas del PDF `carcassonereglas2.pdf` mediante renderizado visual; el PDF es una imagen y no contiene texto extraíble.
- 85 imágenes de loseta (84 frentes + reverso) y 6 SVG de seguidores.

### Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `node scripts/test_engine.js` | Termina, pero no contiene aserciones y siempre imprime “ALL ... PASSED”. Catálogo 84; Río 11 en mazo más nacimiento inicial; base 72. |
| `node scripts/simulate_game.js` | Simuló 15 turnos y guardó/cargó, pero usa aleatoriedad, no tiene aserciones y coloca seguidores sin comprobar legalidad. |
| `node --check` sobre servidor y JS cliente | Sin errores de sintaxis. |
| `npm audit --omit=dev` | 0 vulnerabilidades conocidas. |
| `npm ci --ignore-scripts --dry-run` | Lockfile consistente. |
| `python scripts/check_tile_images.py` | Muestras comprobadas a 400×400. |
| `python scripts/validate_river_definitions.py` | 12 definiciones encontradas; el script sólo valida presencia/forma básica. |
| HTTP sobre instancia en `127.0.0.1:3080` | 200 para `/`, `/api/rooms`, `/api/saves`, una loseta, un meeple, CSS y JS. |
| Chrome headless 1440×1000 | Lobby visible, alineado y funcional visualmente. |
| Prueba dirigida: pasar antes de colocar | **Fallo confirmado:** sin error, consumió una loseta y avanzó el turno. |
| Prueba dirigida: seguidor inventado | **Fallo confirmado:** aceptó `segmentId="NOT_A_REAL_SEGMENT"` y posición `{x:999,y:-999}`. |
| `npm start` adicional | No arrancó porque el puerto 3080 ya estaba ocupado por una instancia existente; esto no es un defecto de la app, pero no hay manejo amigable del error. |
| Docker Compose/build | No ejecutable en este equipo: el comando `docker` no está instalado. Se hizo revisión estática. |

Los scripts existentes crearon/actualizaron `data/saves/test_save.json` y `data/saves/simulacion_exitosa.json`, que quedan como artefactos de prueba.

## 3. Hallazgos críticos

### C-01. Se puede omitir la fase de colocar loseta y consumir el mazo

**Evidencia:** `RoomManager.passMeeple()` comprueba partida y turno, pero no exige `turnPhase === 'place_meeple'` ni `lastPlacedPos`. Después llama siempre a `finishTurn()`, que roba otra loseta.  
**Reproducción confirmada:** inmediatamente tras iniciar, llamar `passMeeple(roomId, 'p1')`; el mazo pasó de 70 a 69 y `turnIndex` de 0 a 1 sin colocar loseta.  
**Impacto:** cualquier jugador puede saltar su turno, descartar la loseta visible y agotar el mazo.  
**Corrección:** centralizar una máquina de estados y rechazar toda acción que no corresponda exactamente a estado, fase, jugador y versión de turno.

### C-02. No se valida la legalidad de un seguidor

**Evidencia:** `placeMeeple()` llama directamente a `Board.placeMeeple()`; no comprueba que `segmentId` exista en la loseta, que `pos` corresponda al segmento, que el segmento sea del tipo indicado ni que el accidente conectado esté libre.  
**Reproducción confirmada:** el motor aceptó un ID inexistente y coordenadas fuera de la loseta.  
**Impacto:** se pueden colocar seguidores ilegales, fuera del dibujo, en campos/caminos/ciudades ocupados o en cualquier cadena arbitraria.  
**Corrección:** resolver el segmento exclusivamente en servidor a partir de un ID canónico; ignorar `pos` enviada por el cliente; recorrer el accidente conectado y rechazarlo si ya contiene seguidores.

### C-03. Los IDs de segmentos son incompatibles con el motor de puntuación

**Evidencia:** las losetas generan IDs como `road_N`, `road_E`, `road_curve`, `road_straight`, `road_junc`, `city_N`, `city_corner`, `city_all`, etc. `Rules.js` sólo reconoce seguidores cuyo `segmentId` sea exactamente `road` o `city`.  
**Impacto:** casi todos los seguidores de caminos y ciudades jamás se cuentan ni retornan y esas obras no otorgan puntos. El Río tiene la misma inconsistencia salvo `river_23_10`, cuyo camino sí usa `road`.  
**Corrección:** representar segmentos con identificador único y `type`; el recorrido debe buscar `meeple.segmentId` en la topología, no comparar contra dos literales.

### C-04. Las conexiones internas de las losetas están modeladas incorrectamente

**Evidencia:** el catálogo deriva segmentos contando bordes. Dos o más bordes de ciudad se tratan generalmente como una sola ciudad, aunque una loseta puede contener ciudades separadas. Los caminos también se agrupan por cantidad y el recorrido parte de todos los bordes a la vez. El propio PDF muestra una loseta con cuatro segmentos de ciudad separados y caminos separados por claustro/intersección.  
**Impacto:** fusiona accidentes que deberían estar separados, altera ocupación, mayorías, cierre y puntuación.  
**Corrección:** definir por loseta un grafo explícito de segmentos y conexiones internas, verificado contra cada imagen.

### C-05. No existe puntuación de final de partida

**Evidencia:** al agotarse el mazo sólo se asigna `status='ended'`. No se recorren caminos, ciudades o monasterios incompletos y no hay algoritmo de campos.  
**Impacto:** el resultado final no corresponde a Carcassonne y los granjeros nunca puntúan.  
**Corrección:** implementar una fase `final_scoring`, puntuar cada accidente una sola vez, campos por ciudades completadas y reglas específicas de expansiones activas.

### C-06. Cualquier jugador puede activar Sandbox o cambiar reglas

**Evidencia:** `sandbox_set_mode` no transmite identidad ni verifica anfitrión. `setSandboxMode()` sólo comprueba que la sala exista.  
**Impacto:** un invitado puede desactivar las reglas en medio de la partida.  
**Corrección:** autorización de anfitrión, sólo en lobby salvo votación explícita, y registro de auditoría.

### C-07. Cualquier participante puede alterar puntos y seguidores

**Evidencia:** `sandbox_adjust_score` y `sandbox_adjust_meeples` no comprueban emisor, anfitrión ni que Sandbox esté activo.  
**Impacto:** manipulación silenciosa incluso en una partida asistida. `delta` tampoco se valida como número finito.  
**Corrección:** exigir permiso y modo, validar entero/rango y rechazar `NaN`, cadenas y objetos.

### C-08. Cualquier participante puede mover o sobrescribir losetas

**Evidencia:** `sandbox_move_tile` tampoco comprueba modo ni autorización. Quita primero el origen y `Board.placeTile()` sobrescribe sin verificar el destino.  
**Impacto:** se puede borrar una loseta existente, mover la inicial y corromper tablero, seguidores y puntuación.  
**Corrección:** comprobar modo/rol, destino libre, límites y operación atómica; impedir o tratar explícitamente la loseta inicial.

### C-09. Identidad y privilegios suplantables

**Evidencia:** el cliente decide `playerId`, guardado en `localStorage`; `join_room` confía en él. Quien reutilice el ID de otro recibe esa identidad y sus capacidades, incluido anfitrión.  
**Impacto:** secuestro de jugador, turno o sala.  
**Corrección:** sesión opaca firmada por servidor, token secreto de reconexión y nunca usar un ID público como credencial.

### C-10. El código de acceso de sala no protege nada

**Evidencia:** `passCode` se almacena y `hasPass` se publica, pero `joinRoom()` no recibe ni valida código; la interfaz ni siquiera permite escribirlo.  
**Impacto:** falsa sensación de privacidad.  
**Corrección:** eliminar la función hasta implementarla o validar un hash con comparación segura y limitación de intentos.

### C-11. Traversal de archivos en carga y eliminación de guardados

**Evidencia:** `loadGame()` y `deleteGame()` concatenan el nombre recibido con `path.join(SAVES_DIR, fileName)` sin `basename`, lista blanca ni comprobación de que la ruta resuelta permanezca en `SAVES_DIR`. El guardado sí sanea el nombre, pero carga/borrado no.  
**Impacto:** lectura y, para archivos `.json`, borrado fuera de `data/saves` con rutas `../`; además, un JSON inesperado puede causar excepción.  
**Corrección:** aceptar sólo IDs de guardado emitidos por servidor; usar `path.basename`, extensión estricta, `path.resolve` y verificar prefijo/directorio padre. Añadir autenticación y propiedad.

### C-12. Los guardados son públicos y cualquier usuario puede borrarlos o cargarlos

**Evidencia:** `/api/saves`, `DELETE /api/saves/:name`, `delete_save` y `load_game` carecen de autenticación/autorización.  
**Impacto:** pérdida de partidas y exposición del estado/jugadores en cualquier red donde se publique el puerto.  
**Corrección:** usuarios o tokens de sala, propietario/ACL, CSRF si se introducen cookies y confirmación/backup recuperable.

## 4. Hallazgos altos

### A-01. Cargar una partida no permite retomarla correctamente

`load_game` asigna al socket visualmente `players[0]`, pero no actualiza `currentPlayerId`. Los IDs persistidos normalmente no coinciden con el ID local del usuario; el cliente tampoco sustituye su ID. Resultado: no es anfitrión, no es su turno y sus acciones se rechazan. Debe existir un flujo explícito de “reclamar asiento” mediante token.

### A-02. Se pierde `lastPlacedPos` al guardar

El guardado conserva `turnPhase` pero omite `lastPlacedPos`. Si se guarda en `place_meeple`, al cargar no se puede colocar seguidor. El bug C-01 deja pasar, pero eso sólo oculta la corrupción. Guardar todo el estado transaccional o permitir guardar únicamente entre turnos.

### A-03. No se valida `turnPhase` al colocar loseta

`placeTile()` tampoco exige `place_tile`. Un cliente puede intentar colocar otra durante `place_meeple`; con reglas activas normalmente choca con ocupación/adyacencia, pero el estado no está protegido y en Sandbox permite comportamientos inconsistentes.

### A-04. No hay solución para una loseta imposible

La UI humana queda bloqueada si `validPlacements` es vacío. Sólo el bot intenta descartarla. Debe aplicarse la regla de descarte/robo de forma autoritativa y trazable, con búsqueda automática antes de declararla imposible.

### A-05. El bot descarta dos losetas cuando no puede colocar

En `executeBotTurn()` roba una loseta manualmente y luego llama `finishTurn()`, que roba otra. Se pierden dos losetas y la primera nunca se juega.

### A-06. La regla especial del Río no está implementada

El PDF exige nacimiento primero, lago al final y prohíbe giros en “U”. El mazo sí ordena nacimiento/intermedias/lago, pero la validación sólo compara bordes `W`; no evita la “U”, bucles, ramificaciones o contactos indebidos del río. Tampoco explica el tratamiento del seguidor en las piezas de río.

### A-07. La puntuación de caminos mezcla ramales

`checkRoadsConnected()` encola todos los bordes de camino de la loseta recién puesta. En cruces o segmentos separados puede tratarlos como un solo accidente. La condición de terminación se aplica de forma asimétrica y depende de valores `center` no normalizados.

### A-08. La puntuación de ciudades mezcla ciudades separadas

El recorrido visita por coordenada de loseta, no por `(loseta, segmento)`, y recorre todos sus bordes de ciudad. Esto fusiona ciudades independientes y cuenta escudos/losetas incorrectos.

### A-09. No se impide puntuar el mismo accidente de forma inconsistente

No existe ID persistente de accidente ni conjunto global de accidentes ya puntuados. La retirada del seguidor evita algunos dobles conteos, pero el modelo no garantiza unicidad, especialmente con topologías fusionadas y múltiples seguidores.

### A-10. Un usuario puede entrar durante una partida

`joinRoom()` no restringe por `status`. Añade al jugador al arreglo y cambia el módulo usado por `turnIndex`, alterando el orden. Debe entrar como espectador o esperar a la siguiente partida.

### A-11. Se puede reiniciar una partida activa

`startGame()` no exige estado lobby. El anfitrión puede resetear tablero, mazo, puntuaciones y seguidores en cualquier momento.

### A-12. Agregar/eliminar jugadores en partida corrompe el turno

Los métodos no restringen el estado. Eliminar un índice anterior al turno o el jugador activo deja `turnIndex` apuntando a otra persona o fuera de rango. También se permite que el anfitrión se elimine y no hay transferencia segura de host.

### A-13. Carrera para obtener el rol de anfitrión

Crear una sala no agrega a `hostName`; el primer socket que se una recibe `isHost`. Como la sala aparece en `/api/rooms`, un tercero puede ganar la carrera antes que quien la creó. Crear sala y sesión de host debe ser una operación atómica.

### A-14. La reconexión de Socket.IO no vuelve a unir al jugador

El cliente no escucha `connect` para volver a emitir `join_room`. Después de una reconexión, el nuevo contexto de servidor tiene `currentRoomId/currentPlayerId = null`; la UI puede parecer activa, pero los eventos se ignoran.

### A-15. Desconexión incorrecta con varias pestañas

Dos sockets pueden usar el mismo `playerId`. Al cerrar uno, `leaveRoom()` marca al jugador desconectado aunque el otro siga activo. Se necesita contar conexiones por jugador/token.

### A-16. Eventos malformados pueden derribar o desestabilizar el proceso

Muchos handlers desestructuran directamente el argumento (`({x,y}) => ...`). Emitir sin objeto produce `TypeError`. Carga/parseo de JSON y operaciones síncronas de archivos tampoco están contenidos en `try/catch` ni hay manejador de error del servidor.

### A-17. El PDF de reglas no corresponde a lo implementado

`carcassonereglas2.pdf` es “Posadas y Catedrales”: 30 losetas, posadas, catedrales, piezas 50/100, sexto color y seguidores grandes; también incluye la sección Río. El proyecto no contiene las 30 losetas ni lógica de posadas/catedrales, seguidores grandes o fichas de puntuación. Mostrar ese PDF como manual del producto induciría a reglas inexistentes.

## 5. Hallazgos medios

### M-01. El README sobrepromete el motor automático

Afirma validar y calcular carreteras, ciudades, monasterios y persistencia completa. Monasterios completos sí tienen una ruta razonable, pero ciudades/caminos están rotos para la mayoría de IDs, los campos no existen y la restauración no es reanudable en todos los estados. Debe distinguir “prototipo/parcial” de funciones terminadas.

### M-02. No existe comando de pruebas, lint ni cobertura

`package.json` sólo declara `start` y `dev`. Los scripts imprimen resultados, no fallan ante expectativas incumplidas y uno usa `Math.random()`. Añadir Node Test Runner/Vitest/Jest, ESLint, cobertura y CI.

### M-03. El mensaje de éxito de las pruebas es incondicional

`test_engine.js` y `simulate_game.js` anuncian éxito aunque una expectativa impresa sea falsa o la puntuación sea siempre cero. Convertir cada expectativa a `assert` y código de salida no cero.

### M-04. Las tres fuentes de datos de losetas pueden divergir

Existen `verified_tiles.json`, `exact_tiles.json` y `tiles-data.json`, todos con 84 entradas, pero producción sólo carga `verified_tiles.json`; además hay definiciones del Río codificadas en JS. Definir una única fuente canónica con esquema y generación reproducible.

### M-05. Detección de monasterios y escudos está hardcodeada

Se deduce por listas de IDs y una heurística de centro/bordes. Una modificación del catálogo o imagen puede desincronizar reglas y arte. Incluir metadatos explícitos validados por loseta.

### M-06. Valores de entrada sin esquema ni límites de servidor

No se limitan longitud de nombres/salas/chat en servidor, tipos, coordenadas, rotaciones, deltas u opciones. El `maxlength` del cliente no protege Socket.IO/REST. Usar Zod/Ajv/Valibot o validadores manuales estrictos.

### M-07. Sin límites de frecuencia o recursos

Se pueden crear salas, enviar chat, guardar archivos y emitir eventos sin rate limit. Un cliente puede llenar RAM/disco o producir carga de CPU con serializaciones completas.

### M-08. Operaciones de archivos síncronas en el event loop

`readFileSync`, `writeFileSync`, `unlinkSync`, `readdirSync` y `statSync` bloquean todas las partidas. Migrar a `fs.promises`, límites de tamaño, escritura atómica (`temp + rename`) y manejo de errores.

### M-09. Guardados sin versión ni migración

No incluyen `schemaVersion`, checksum ni validación al cargar. Cualquier cambio futuro o archivo truncado puede romper el proceso. Añadir versión, esquema, migraciones y backups.

### M-10. Estado completo enviado en cada actualización

Cada acción serializa tablero, catálogo de la loseta, jugadores, logs y todas las colocaciones válidas, a veces dos veces (`tile_placed` y `room_updated`). En partidas largas aumenta CPU/red. Usar eventos incrementales o snapshots con versión y reducir duplicados.

### M-11. CORS totalmente abierto

Express y Socket.IO usan `origin: '*'`. Combinado con endpoints mutables sin autenticación facilita acciones desde cualquier origen contra un servidor accesible. Configurar orígenes permitidos y autenticación; CORS no sustituye autorización.

### M-12. Sala y guardados sólo residen en memoria/archivos locales

Las salas activas desaparecen al reiniciar y no es posible escalar a varias réplicas sin adaptador Socket.IO y almacenamiento compartido. Documentar esta limitación o usar Redis/DB si se requiere producción.

### M-13. Chat y registros no son accesibles en pantallas ≤1024 px

CSS oculta `.chat-drawer` con `display:none` y no hay botón móvil alternativo. Añadir drawer/modal accesible.

### M-14. Panel móvil cubre 220 px del tablero

A ≤768 px el panel lateral se convierte en overlay inferior horizontal. Puede tapar controles/losetas y no considera `safe-area-inset-*`. Probar en 360×640, 390×844, tablet y orientación horizontal.

### M-15. Lista de salas no se actualiza automáticamente

Sólo carga al inicio o al pulsar “Actualizar”. Añadir evento global de cambios o sondeo moderado con estados de carga/error.

## 6. Hallazgos bajos y mejoras de calidad

### B-01. Accesibilidad del canvas

El tablero depende de puntero/táctil y no tiene alternativa semántica, foco, ARIA ni navegación completa por teclado. Ofrecer cuadrícula/acciones accesibles, instrucciones y anuncios `aria-live` para turno/puntuación.

### B-02. Zoom del navegador deshabilitado

`user-scalable=no` y `maximum-scale=1.0` perjudican a usuarios con baja visión. Permitir zoom de página y distinguirlo del zoom del tablero.

### B-03. Controles sólo con iconos o títulos

Varios botones dinámicos y acciones del tablero dependen de emoji/color. Añadir nombres accesibles, foco visible y no comunicar estado sólo con color.

### B-04. Contraste y color negro

El meeple “negro” se representa con gris en CSS para hacerlo visible; conviene verificar contraste WCAG y que color/nombre no sean el único identificador.

### B-05. Errores de red poco visibles

`loadRooms/loadSaves` sólo escriben en consola; crear sala tampoco maneja HTTP no exitoso. Mostrar estado de carga, error y reintento.

### B-06. `innerHTML` e handlers inline innecesarios

Los nombres normales se escapan, pero se interpolan IDs/nombres de archivo en atributos `onclick`. Los archivos creados por la app quedan saneados, aunque archivos externos con comillas podrían romper el contexto. Preferir `textContent` y `addEventListener`.

### B-07. No hay política de cabeceras de seguridad

Faltan CSP, `X-Content-Type-Options`, políticas de frame/referrer y Helmet. Una CSP exigirá retirar script y handlers inline.

### B-08. Imagen CasaOS remota

El icono de Compose depende de Imgur, contradiciendo parcialmente la idea “100% offline” del paquete. Incluir un icono local o documentar que sólo el juego es offline.

### B-09. Error de puerto sin diagnóstico amigable

Una segunda instancia termina con stack trace `EADDRINUSE`. Añadir `server.on('error')` con mensaje claro y documentar `PORT`.

## 7. Comparación detallada con los manuales

### README

| Afirmación | Realidad observada | Acción recomendada |
|---|---|---|
| Multijugador en tiempo real | Existe, pero sin identidad segura, reconexión fiable ni control de entrada en curso. | Marcar beta y documentar límites. |
| 72 losetas base + 12 Río | El catálogo devuelve 84 y hay 84 frentes; el mazo separa una inicial. | Añadir prueba de distribución/topología, no sólo conteo. |
| Valida reglas y puntúa automáticamente | Sólo bordes básicos y monasterio completo son razonables; seguidores, ciudades, caminos y final están incompletos/rotos. | Corregir motor antes de afirmarlo. |
| Sandbox estilo TTS | Hay ajustes, pero mover losetas no está conectado de forma funcional desde `onTileClicked()` y carece de permisos/seguridad. | Completar interacción y permisos. |
| Guardar y reanudar | Guarda JSON, pero carga no reasigna identidad y pierde `lastPlacedPos`. | Corregir restauración y versionado. |
| Compatibilidad móvil total | Diseño adaptable parcial; chat desaparece y el panel tapa tablero. | Hacer matriz real de dispositivos. |
| Docker Compose para CasaOS | Configuración plausible; no se pudo construir por falta de Docker local. | Probar en CI y CasaOS real. |

### PDF `carcassonereglas2.pdf`

El PDF contiene:

- Posadas: caminos completos a 2 puntos por loseta y 0 si quedan incompletos al final.
- Catedrales: ciudades completas a 3 puntos por loseta/escudo y 0 si quedan incompletas al final.
- Río de 12 piezas, nacimiento primero, lago último y prohibición de giro en U.
- Losetas con accidentes separados de forma especial.
- Piezas 50/100, sexto jugador gris y seis seguidores grandes que valen doble para mayorías.

La aplicación:

- No modela posadas, catedrales, seguidores grandes ni fichas 50/100.
- Sí ofrece seis colores y puntuación numérica, pero todos empiezan con siete seguidores normales.
- Ordena nacimiento y lago, pero no aplica la prohibición de U.
- No puede representar fielmente varias separaciones internas mostradas en la página 2.
- No aplica puntuación final, por lo que tampoco podría aplicar las excepciones de 0 puntos.

**Conclusión documental:** conservar el PDF sólo si se implementará esa expansión y se etiqueta claramente. Para el producto actual hace falta un manual del juego base y un anexo específico del Río, además de una guía de controles de esta interfaz.

## 8. Arquitectura y mantenibilidad

### Aspectos positivos

- Separación inicial entre `Board`, `Rules`, `TileDeck` y `RoomManager`.
- El servidor es autoritativo para colocación y puntuación, una dirección arquitectónica correcta aunque las validaciones estén incompletas.
- Recursos locales, imágenes uniformes y despliegue simple.
- `escapeHtml` se usa en nombres/chat/logs visibles.
- Lockfile presente y auditoría de dependencias limpia al momento de la revisión.

### Mejoras estructurales

1. Convertir el motor en un módulo puro, determinista y sin temporizadores ni I/O.
2. Definir entidades `TileDefinition`, `PlacedTile`, `FeatureSegment`, `FeatureGraph`, `GameState` y `Command` con esquema validado.
3. Implementar un reductor `applyCommand(state, command, actor)` que compruebe permisos y fases.
4. Separar sala/transporte/persistencia del dominio de Carcassonne.
5. Añadir versión monotónica del estado para ignorar eventos obsoletos y evitar doble acción.
6. Sustituir temporizadores de bot por una cola cancelable ligada a `room.id + turnVersion`.
7. Guardar con repositorio abstracto y escritura atómica; nunca confiar en nombres de ruta del cliente.
8. Considerar TypeScript para contratos compartidos cliente-servidor.

## 9. Plan de pruebas recomendado

### Unitarias del dominio

- Rotación de bordes y segmentos en 0/90/180/270 y grados inválidos.
- Cada una de las 84 losetas contra un snapshot de topología verificada.
- Colocación con 0, 1, 2, 3 y 4 vecinos; ocupación y desconexión.
- Río: orden, continuidad, U prohibida, nacimiento/lago y descarte imposible.
- Caminos rectos, curvas, cruces y terminaciones; segmentos separados.
- Ciudades separadas/compartidas, escudos y empates.
- Monasterios completos e incompletos.
- Seguidores: accidente libre/ocupado, mayoría y empate, devolución.
- Puntuación final completa, incluidos campos.
- Guardado/carga en cada fase con igualdad profunda de estado.

### Integración servidor/Socket.IO

- Dos a seis clientes reales, espectador y bot.
- Acción fuera de turno, fase incorrecta, evento duplicado y payload malformado.
- Suplantación, cambio de host, expulsión y entrada durante partida.
- Desconectar/reconectar, dos pestañas y reinicio del servidor.
- Autorización de Sandbox/guardados y rutas de traversal.
- Rate limits y mensajes/nombres en límites.

### E2E de navegador

- Crear/unirse/iniciar/colocar/rotar/seguidor/pasar/puntuar/terminar.
- Guardar, recargar página, reclamar asiento y continuar.
- Chrome, Firefox, Safari/WebKit; mouse, táctil y teclado.
- 360×640, 390×844, 768×1024, 1366×768 y 1440×1000.
- Lector de pantalla, zoom 200 %, alto contraste y navegación sólo por teclado.

### CI mínima

`npm ci` → lint → unitarias → integración → cobertura → build de imagen Docker → healthcheck → E2E smoke. Exigir aserciones, semilla fija y código distinto de cero ante fallo.

## 10. Priorización de correcciones

### Fase 0 — detener exposición pública

- Restringir el puerto a red confiable hasta tener autenticación/autorización.
- Bloquear traversal y eliminar mutaciones globales sin permisos.
- Validar payloads y contener excepciones.

### Fase 1 — integridad del turno y multijugador

- Máquina de estados estricta.
- Identidad/token de sesión seguro.
- Roles y permisos de host/Sandbox.
- Entrada como espectador, reconexión y múltiples pestañas.
- Corregir carga/guardado y `lastPlacedPos`.

### Fase 2 — motor reglamentario

- Fuente canónica de topologías por segmento.
- Legalidad de seguidores.
- Caminos, ciudades, monasterios, campos, empates y puntuación final.
- Río completo.
- Decidir si Posadas y Catedrales entra en alcance; si no, retirar/reetiquetar el PDF.

### Fase 3 — pruebas y operación

- Suite determinista con aserciones y CI.
- Persistencia asíncrona/versionada/atómica.
- Rate limiting, métricas, logs y healthcheck.
- Docker/CasaOS verificado de punta a punta.

### Fase 4 — experiencia de uso

- Chat móvil, panel no obstructivo y estados de error/carga.
- Accesibilidad de canvas y controles.
- Manual propio, tutorial de primer turno y explicación visual de reglas.

## 11. Criterios de aceptación para declarar una versión estable

- Ninguna acción fuera de fase o turno modifica estado.
- Ningún cliente puede hacerse pasar por otro ni ejecutar acciones de host.
- Toda colocación de seguidor es legal respecto al accidente conectado.
- Las 84 losetas tienen topología revisada y tests de snapshot.
- Puntuación durante y al final coincide con casos oficiales seleccionados.
- Río nunca forma U y respeta nacimiento/lago.
- Guardar/cargar desde cualquier fase preserva exactamente el estado o la UI sólo permite guardar en fases seguras.
- Reconexión recupera asiento de forma segura.
- Guardados no salen de su directorio, tienen propietario, versión y escritura atómica.
- Suite CI determinista en verde, incluyendo navegadores y build Docker.
- Documentación describe sólo funciones realmente disponibles.

## 12. Conclusión

La aplicación es un **buen prototipo visual y de sincronización básica**, pero no una implementación completa de Carcassonne todavía. La prioridad debe ser proteger la integridad del estado y rehacer el modelo de accidentes por segmentos; pulir UI antes de eso no solucionará los resultados de partida incorrectos. Una vez corregidos permisos, fases, topologías, seguidores y puntuación final, la base actual puede evolucionar razonablemente a un producto sólido.
