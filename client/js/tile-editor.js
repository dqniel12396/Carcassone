// Carcassonne Tile Point & Boundary Visual Editor
// Full Visual Editor: Drag & Drop Points, Edit Terrain Limits, Add/Delete Segments

(function () {
  let tilesCatalog = {};
  let currentTileId = 'base_21_00';
  let currentRotation = 0; // 0, 90, 180, 270
  let activeSegmentIndex = -1;
  let isDragging = false;

  let canvas, ctx;
  let tileImageCache = new Map();

  const PERIMETER_POINTS = ['N_W', 'N_E', 'E_N', 'E_S', 'S_E', 'S_W', 'W_S', 'W_N'];
  const CARDINAL_EDGES = ['N', 'E', 'S', 'W'];

  function initTileEditor() {
    canvas = document.getElementById('tile-editor-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    bindEvents();
    loadCatalog();
  }

  function loadCatalog() {
    fetch('/api/tiles')
      .then(res => res.json())
      .then(data => {
        tilesCatalog = data;
        populateTileSelect();
        if (!tilesCatalog[currentTileId]) {
          currentTileId = Object.keys(tilesCatalog)[0] || 'base_21_00';
        }
        selectTile(currentTileId);
      })
      .catch(err => console.error('Error cargando catálogo de losetas:', err));
  }

  function populateTileSelect() {
    const select = document.getElementById('editor-tile-select');
    if (!select) return;
    select.innerHTML = '';

    const ids = Object.keys(tilesCatalog).sort();
    ids.forEach(id => {
      const tile = tilesCatalog[id];
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${id} - ${tile.name || id} [${tile.edges.join(',')}]`;
      select.appendChild(opt);
    });

    select.value = currentTileId;
  }

  function selectTile(tileId) {
    currentTileId = tileId;
    activeSegmentIndex = -1;
    const select = document.getElementById('editor-tile-select');
    if (select) select.value = tileId;

    preloadTileImage(tilesCatalog[tileId]?.image, () => {
      renderEditor();
      updateSegmentsList();
    });
  }

  function preloadTileImage(src, callback) {
    if (!src) return;
    if (tileImageCache.has(src)) {
      if (callback) callback();
      return;
    }
    const img = new Image();
    img.src = src;
    img.onload = () => {
      tileImageCache.set(src, img);
      if (callback) callback();
    };
  }

  function renderEditor() {
    if (!canvas || !ctx) return;
    const tile = tilesCatalog[currentTileId];
    if (!tile) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 1. Draw tile background rotated
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((currentRotation * Math.PI) / 180);

    const img = tileImageCache.get(tile.image);
    if (img && img.complete) {
      ctx.drawImage(img, -W / 2, -H / 2, W, H);
    } else {
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-W / 2, -H / 2, W, H);
    }

    // Grid guide lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-W / 2, -H / 2, W, H);

    ctx.restore();

    // 2. Draw Active Segment's Connected Edge Boundaries on Canvas
    if (activeSegmentIndex >= 0 && tile.segments && tile.segments[activeSegmentIndex]) {
      const activeSeg = tile.segments[activeSegmentIndex];
      drawActiveEdgeBoundaries(activeSeg, currentRotation, W, H);
    }

    // Subtle center crosshairs
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Points with high visibility
    const segments = tile.segments || [];
    segments.forEach((seg, idx) => {
      const pt = getScreenPos(seg.pos, currentRotation, W, H);
      const isSelected = activeSegmentIndex === idx;

      ctx.save();
      // Halo / Glow
      ctx.shadowColor = isSelected ? '#ffffff' : (seg.color || '#f1c40f');
      ctx.shadowBlur = isSelected ? 18 : 8;

      // Outer circle
      ctx.fillStyle = seg.color || '#f1c40f';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 15 : 12, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Label Tag
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      const labelText = seg.name ? seg.name.split(' ')[0] : seg.type;
      const textWidth = ctx.measureText(labelText).width;
      const tagW = Math.max(50, textWidth + 14);
      ctx.fillRect(pt.x - tagW / 2, pt.y - 32, tagW, 18);
      ctx.strokeStyle = seg.color || '#f1c40f';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(pt.x - tagW / 2, pt.y - 32, tagW, 18);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pt.x, pt.y - 23);

      ctx.restore();
    });
  }

  function drawActiveEdgeBoundaries(seg, rotDeg, W, H) {
    if (!seg.edges || seg.edges.length === 0) return;

    ctx.save();
    ctx.strokeStyle = seg.color || '#f1c40f';
    ctx.lineWidth = 6;
    ctx.shadowColor = seg.color || '#f1c40f';
    ctx.shadowBlur = 12;

    const rotatedEdges = getRotatedEdges(seg.edges, rotDeg);

    rotatedEdges.forEach(edge => {
      ctx.beginPath();
      switch (edge) {
        case 'N': ctx.moveTo(0, 3); ctx.lineTo(W, 3); break;
        case 'N_W': ctx.moveTo(0, 3); ctx.lineTo(W / 2, 3); break;
        case 'N_E': ctx.moveTo(W / 2, 3); ctx.lineTo(W, 3); break;

        case 'E': ctx.moveTo(W - 3, 0); ctx.lineTo(W - 3, H); break;
        case 'E_N': ctx.moveTo(W - 3, 0); ctx.lineTo(W - 3, H / 2); break;
        case 'E_S': ctx.moveTo(W - 3, H / 2); ctx.lineTo(W - 3, H); break;

        case 'S': ctx.moveTo(0, H - 3); ctx.lineTo(W, H - 3); break;
        case 'S_W': ctx.moveTo(0, H - 3); ctx.lineTo(W / 2, H - 3); break;
        case 'S_E': ctx.moveTo(W / 2, H - 3); ctx.lineTo(W, H - 3); break;

        case 'W': ctx.moveTo(3, 0); ctx.lineTo(3, H); break;
        case 'W_N': ctx.moveTo(3, 0); ctx.lineTo(3, H / 2); break;
        case 'W_S': ctx.moveTo(3, H / 2); ctx.lineTo(3, H); break;
      }
      ctx.stroke();
    });

    ctx.restore();
  }

  function getRotatedEdges(edges, rotDeg) {
    const steps = ((rotDeg / 90) % 4 + 4) % 4;
    return edges.map(edge => {
      const pIdx = PERIMETER_POINTS.indexOf(edge);
      if (pIdx !== -1) {
        return PERIMETER_POINTS[(pIdx + steps * 2) % 8];
      }
      const cIdx = CARDINAL_EDGES.indexOf(edge);
      if (cIdx !== -1) {
        return CARDINAL_EDGES[(cIdx + steps) % 4];
      }
      return edge;
    });
  }

  function getScreenPos(pos, rotDeg, W, H) {
    let px = (pos.x - 0.5);
    let py = (pos.y - 0.5);
    const rad = (rotDeg * Math.PI) / 180;
    const rx = px * Math.cos(rad) - py * Math.sin(rad);
    const ry = px * Math.sin(rad) + py * Math.cos(rad);
    return {
      x: (rx + 0.5) * W,
      y: (ry + 0.5) * H
    };
  }

  function getNormPosFromScreen(screenX, screenY, rotDeg, W, H) {
    let px = (screenX / W) - 0.5;
    let py = (screenY / H) - 0.5;
    const rad = (-rotDeg * Math.PI) / 180;
    const rx = px * Math.cos(rad) - py * Math.sin(rad);
    const ry = px * Math.sin(rad) + py * Math.cos(rad);
    return {
      x: Math.max(0.05, Math.min(0.95, Math.round((rx + 0.5) * 100) / 100)),
      y: Math.max(0.05, Math.min(0.95, Math.round((ry + 0.5) * 100) / 100))
    };
  }

  function addSegment(type) {
    const tile = tilesCatalog[currentTileId];
    if (!tile) return;
    if (!tile.segments) tile.segments = [];

    const typeConfigs = {
      city: { color: '#3498db', name: 'Ciudad (Caballero)', defaultPos: { x: 0.5, y: 0.2 }, defaultEdges: ['N'] },
      road: { color: '#f39c12', name: 'Camino (Bandido)', defaultPos: { x: 0.5, y: 0.5 }, defaultEdges: ['E', 'W'] },
      field: { color: '#27ae60', name: 'Campo (Granjero)', defaultPos: { x: 0.5, y: 0.8 }, defaultEdges: ['S_W', 'S_E'] },
      monastery: { color: '#e67e22', name: 'Monasterio (Monje)', defaultPos: { x: 0.5, y: 0.5 }, defaultEdges: [] }
    };

    const config = typeConfigs[type] || typeConfigs.field;
    const count = tile.segments.filter(s => s.type === type).length + 1;
    const uniqueId = `${type}_${count}_${Date.now().toString(36).substr(-3)}`;

    tile.segments.push({
      id: uniqueId,
      type: type,
      name: `${config.name.split(' ')[0]} ${count} (${config.name.split('(')[1] || ''}`,
      edges: [...config.defaultEdges],
      pos: { ...config.defaultPos },
      color: config.color
    });

    activeSegmentIndex = tile.segments.length - 1;
    renderEditor();
    updateSegmentsList();
  }

  function deleteSegment(index) {
    const tile = tilesCatalog[currentTileId];
    if (!tile || !tile.segments) return;

    tile.segments.splice(index, 1);
    activeSegmentIndex = -1;
    renderEditor();
    updateSegmentsList();
  }

  function toggleEdgeConnection(seg, edgeKey) {
    if (!seg.edges) seg.edges = [];
    const idx = seg.edges.indexOf(edgeKey);
    if (idx !== -1) {
      seg.edges.splice(idx, 1);
    } else {
      seg.edges.push(edgeKey);
    }
    renderEditor();
    updateSegmentsList();
  }

  function updateSegmentsList() {
    const listEl = document.getElementById('editor-segments-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const tile = tilesCatalog[currentTileId];
    if (!tile || !tile.segments || tile.segments.length === 0) {
      listEl.innerHTML = '<div class="empty-hint" style="padding:10px 0;">No hay puntos en esta loseta. ¡Agrega uno abajo!</div>';
      return;
    }

    tile.segments.forEach((seg, idx) => {
      const isSelected = activeSegmentIndex === idx;
      const item = document.createElement('div');
      item.className = `editor-seg-item ${isSelected ? 'active' : ''}`;
      item.style.borderLeftColor = seg.color || '#f1c40f';

      // Edge selector options (Friendly Spanish Names + Compass Layout)
      const isField = seg.type === 'field';
      let boundaryHtml = '';

      if (isField) {
        boundaryHtml = `
          <div class="seg-edges-wrapper">
            <span class="edges-header-label">🧭 Salidas / Conexiones de Pradera (Toca para activar/desactivar):</span>
            <div class="visual-boundary-frame">
              <div class="v-frame-row top">
                <button class="boundary-btn ${(seg.edges || []).includes('N_W') ? 'active' : ''}" data-edge="N_W" title="Norte Lado Izquierdo">⬆️ Norte (Izq)</button>
                <button class="boundary-btn ${(seg.edges || []).includes('N_E') ? 'active' : ''}" data-edge="N_E" title="Norte Lado Derecho">⬆️ Norte (Der)</button>
              </div>
              <div class="v-frame-row middle">
                <div class="v-frame-col left">
                  <button class="boundary-btn ${(seg.edges || []).includes('W_N') ? 'active' : ''}" data-edge="W_N" title="Oeste Parte Superior">⬅️ Oeste (Arr)</button>
                  <button class="boundary-btn ${(seg.edges || []).includes('W_S') ? 'active' : ''}" data-edge="W_S" title="Oeste Parte Inferior">⬅️ Oeste (Abj)</button>
                </div>
                <div class="v-frame-center">🌾 Campo</div>
                <div class="v-frame-col right">
                  <button class="boundary-btn ${(seg.edges || []).includes('E_N') ? 'active' : ''}" data-edge="E_N" title="Este Parte Superior">➡️ Este (Arr)</button>
                  <button class="boundary-btn ${(seg.edges || []).includes('E_S') ? 'active' : ''}" data-edge="E_S" title="Este Parte Inferior">➡️ Este (Abj)</button>
                </div>
              </div>
              <div class="v-frame-row bottom">
                <button class="boundary-btn ${(seg.edges || []).includes('S_W') ? 'active' : ''}" data-edge="S_W" title="Sur Lado Izquierdo">⬇️ Sur (Izq)</button>
                <button class="boundary-btn ${(seg.edges || []).includes('S_E') ? 'active' : ''}" data-edge="S_E" title="Sur Lado Derecho">⬇️ Sur (Der)</button>
              </div>
            </div>
          </div>
        `;
      } else {
        boundaryHtml = `
          <div class="seg-edges-wrapper">
            <span class="edges-header-label">🌐 Salidas de ${seg.type === 'city' ? 'Ciudad' : 'Camino'} (Toca para activar/desactivar):</span>
            <div class="cardinal-boundary-grid">
              <button class="boundary-btn ${(seg.edges || []).includes('N') ? 'active' : ''}" data-edge="N">⬆️ Todo el Norte</button>
              <button class="boundary-btn ${(seg.edges || []).includes('E') ? 'active' : ''}" data-edge="E">➡️ Todo el Este</button>
              <button class="boundary-btn ${(seg.edges || []).includes('S') ? 'active' : ''}" data-edge="S">⬇️ Todo el Sur</button>
              <button class="boundary-btn ${(seg.edges || []).includes('W') ? 'active' : ''}" data-edge="W">⬅️ Todo el Oeste</button>
            </div>
          </div>
        `;
      }

      item.innerHTML = `
        <div class="seg-item-header">
          <span class="seg-dot" style="background:${seg.color || '#f1c40f'};"></span>
          <input type="text" class="seg-name-input" value="${seg.name || seg.id}" title="Editar nombre">
          <button class="btn-del-seg" title="Eliminar punto">🗑️</button>
        </div>
        <div class="seg-coords">
          <span>X: <strong>${seg.pos.x.toFixed(2)}</strong></span>
          <span>Y: <strong>${seg.pos.y.toFixed(2)}</strong></span>
          <span class="seg-type-badge">${seg.type.toUpperCase()}</span>
        </div>
        ${isSelected ? boundaryHtml : ''}
      `;

      // Select point
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-del-seg') || e.target.classList.contains('seg-name-input') || e.target.classList.contains('boundary-btn')) return;
        activeSegmentIndex = idx;
        renderEditor();
        updateSegmentsList();
      });

      // Boundary buttons toggle
      if (isSelected) {
        const btns = item.querySelectorAll('.boundary-btn');
        btns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEdgeConnection(seg, btn.getAttribute('data-edge'));
          });
        });
      }

      // Name editing
      const input = item.querySelector('.seg-name-input');
      if (input) {
        input.addEventListener('change', (e) => {
          seg.name = e.target.value;
          renderEditor();
        });
        input.addEventListener('click', (e) => e.stopPropagation());
      }

      // Delete button
      const delBtn = item.querySelector('.btn-del-seg');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSegment(idx);
        });
      }

      listEl.appendChild(item);
    });
  }

  function saveCurrentTileSegments() {
    const tile = tilesCatalog[currentTileId];
    if (!tile) return;

    const saveBtn = document.getElementById('editor-save-btn');
    if (saveBtn) saveBtn.textContent = '⏳ Guardando...';

    fetch('/api/tiles/update-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tileId: currentTileId,
        segments: tile.segments
      })
    })
      .then(res => res.json())
      .then(res => {
        if (saveBtn) saveBtn.textContent = '💾 Guardar Cambios';
        if (window.showToast) {
          window.showToast(`✅ ¡Puntos y límites de ${currentTileId} guardados con éxito!`, 'success');
        } else {
          alert(`✅ ¡Puntos y límites de ${currentTileId} guardados con éxito!`);
        }
      })
      .catch(err => {
        if (saveBtn) saveBtn.textContent = '💾 Guardar Cambios';
        if (window.showToast) window.showToast('Error guardando puntos: ' + err.message, 'danger');
      });
  }

  function bindEvents() {
    const select = document.getElementById('editor-tile-select');
    const prevBtn = document.getElementById('editor-prev-tile-btn');
    const nextBtn = document.getElementById('editor-next-tile-btn');
    const rotateBtn = document.getElementById('editor-rotate-tile-btn');
    const saveBtn = document.getElementById('editor-save-btn');

    // Add point buttons
    const addCityBtn = document.getElementById('editor-add-city-btn');
    const addRoadBtn = document.getElementById('editor-add-road-btn');
    const addFieldBtn = document.getElementById('editor-add-field-btn');
    const addMonasteryBtn = document.getElementById('editor-add-monastery-btn');

    if (addCityBtn) addCityBtn.addEventListener('click', () => addSegment('city'));
    if (addRoadBtn) addRoadBtn.addEventListener('click', () => addSegment('road'));
    if (addFieldBtn) addFieldBtn.addEventListener('click', () => addSegment('field'));
    if (addMonasteryBtn) addMonasteryBtn.addEventListener('click', () => addSegment('monastery'));

    if (select) {
      select.addEventListener('change', (e) => selectTile(e.target.value));
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const ids = Object.keys(tilesCatalog).sort();
        const currIdx = ids.indexOf(currentTileId);
        const prevIdx = (currIdx - 1 + ids.length) % ids.length;
        selectTile(ids[prevIdx]);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const ids = Object.keys(tilesCatalog).sort();
        const currIdx = ids.indexOf(currentTileId);
        const nextIdx = (currIdx + 1) % ids.length;
        selectTile(ids[nextIdx]);
      });
    }

    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        renderEditor();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', saveCurrentTileSegments);
    }

    function openTileEditorDirectly() {
      const modal = document.getElementById('tile-editor-modal');
      if (modal) {
        modal.style.display = 'flex';
        loadCatalog();
      }
    }

    function openTileEditor() {
      // Check session authentication
      const isAuth = sessionStorage.getItem('carcassonne_editor_auth') === 'true';
      if (isAuth) {
        openTileEditorDirectly();
        return;
      }

      // Show Admin Authentication Modal
      const authModal = document.getElementById('editor-auth-modal');
      const authUser = document.getElementById('editor-auth-user');
      const authPass = document.getElementById('editor-auth-pass');
      const authError = document.getElementById('editor-auth-error');

      if (authModal) {
        if (authUser) authUser.value = '';
        if (authPass) authPass.value = '';
        if (authError) authError.style.display = 'none';
        authModal.style.display = 'flex';
        setTimeout(() => {
          if (authUser) authUser.focus();
        }, 100);
      }
    }

    function closeTileEditor() {
      const modal = document.getElementById('tile-editor-modal');
      if (modal) modal.style.display = 'none';
    }

    function closeAuthModal() {
      const authModal = document.getElementById('editor-auth-modal');
      if (authModal) authModal.style.display = 'none';
    }

    // Handle Admin Auth Form Submission
    const authForm = document.getElementById('editor-auth-form');
    const authSubmitBtn = document.getElementById('editor-auth-submit-btn');

    async function handleAuthSubmit() {
      const authUser = document.getElementById('editor-auth-user');
      const authPass = document.getElementById('editor-auth-pass');
      const authError = document.getElementById('editor-auth-error');

      const username = authUser ? authUser.value.trim() : '';
      const password = authPass ? authPass.value.trim() : '';

      if (!username || !password) {
        if (authError) {
          authError.innerText = '⚠️ Por favor ingresa usuario y contraseña.';
          authError.style.display = 'block';
        }
        return;
      }

      try {
        if (authSubmitBtn) {
          authSubmitBtn.disabled = true;
          authSubmitBtn.innerText = '⏳ Verificando...';
        }

        const res = await fetch('/api/editor-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          sessionStorage.setItem('carcassonne_editor_auth', 'true');
          closeAuthModal();
          openTileEditorDirectly();
        } else {
          if (authError) {
            authError.innerText = `⚠️ ${data.error || 'Usuario o clave incorrectos.'}`;
            authError.style.display = 'block';
          }
          if (authPass) {
            authPass.value = '';
            authPass.focus();
          }
        }
      } catch (err) {
        if (authError) {
          authError.innerText = '⚠️ Error de conexión con el servidor.';
          authError.style.display = 'block';
        }
      } finally {
        if (authSubmitBtn) {
          authSubmitBtn.disabled = false;
          authSubmitBtn.innerText = '🔓 Entrar al Editor';
        }
      }
    }

    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAuthSubmit();
      });
    }

    if (authSubmitBtn) {
      authSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAuthSubmit();
      });
    }

    window.openTileEditor = openTileEditor;
    window.closeTileEditor = closeTileEditor;

    document.addEventListener('click', (e) => {
      if (e.target && (e.target.id === 'lobby-editor-btn' || e.target.closest('#lobby-editor-btn'))) {
        e.preventDefault();
        openTileEditor();
      }
      if (e.target && (e.target.id === 'close-editor-auth-modal' || e.target.closest('#close-editor-auth-modal'))) {
        e.preventDefault();
        closeAuthModal();
      }
      if (e.target && (e.target.id === 'close-tile-editor-modal' || e.target.id === 'editor-close-btn')) {
        e.preventDefault();
        closeTileEditor();
      }
    });

    // Canvas Pointer / Touch Drag & Drop
    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    function onPointerDown(e) {
      const coords = getCanvasCoords(e);
      const tile = tilesCatalog[currentTileId];
      if (!tile || !tile.segments) return;

      const W = canvas.width, H = canvas.height;
      activeSegmentIndex = -1;

      tile.segments.forEach((seg, idx) => {
        const pt = getScreenPos(seg.pos, currentRotation, W, H);
        if (Math.hypot(coords.x - pt.x, coords.y - pt.y) <= 22) {
          activeSegmentIndex = idx;
          isDragging = true;
        }
      });

      renderEditor();
      updateSegmentsList();

      if (isDragging && e.cancelable) {
        e.preventDefault();
      }
    }

    function onPointerMove(e) {
      if (!isDragging || activeSegmentIndex === -1) return;
      if (e.cancelable) e.preventDefault();

      const coords = getCanvasCoords(e);
      const W = canvas.width, H = canvas.height;
      const tile = tilesCatalog[currentTileId];
      if (!tile || !tile.segments[activeSegmentIndex]) return;

      const norm = getNormPosFromScreen(coords.x, coords.y, currentRotation, W, H);
      tile.segments[activeSegmentIndex].pos = norm;

      renderEditor();
      updateSegmentsList();
    }

    function onPointerUp() {
      isDragging = false;
    }
  }

  window.initTileEditor = initTileEditor;
  document.addEventListener('DOMContentLoaded', initTileEditor);
})();
