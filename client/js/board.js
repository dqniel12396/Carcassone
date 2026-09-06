// Interactive Board Renderer (HTML5 Canvas + Touch-First Gesture Engine + BGA In-Place Rotation + Mobile Action Bar Integration)

class BoardRenderer {
  constructor(canvas, { onSlotClick, onTileClick, onMeeplePointClick, onConfirmPendingTile, onCancelPlacement, onPassMeeple, onPendingStateChange }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSlotClick = onSlotClick;
    this.onTileClick = onTileClick;
    this.onMeeplePointClick = onMeeplePointClick;
    this.onConfirmPendingTile = onConfirmPendingTile;
    this.onCancelPlacement = onCancelPlacement;
    this.onPassMeeple = onPassMeeple;
    this.onPendingStateChange = onPendingStateChange;

    // Viewport transform
    this.tileSize = 100;
    const isMobile = window.innerWidth <= 1024;
    this.zoom = isMobile ? 0.60 : 0.80;
    this.minZoom = 0.20;
    this.maxZoom = 2.0;
    this.panX = 0;
    this.panY = 0;
    this.userHasZoomed = false;

    // Interaction state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hasMoved = false;

    // Touch gesture state (Pinch zoom)
    this.touchStartDist = 0;
    this.touchStartZoom = 1;
    this.touchStartCenter = { x: 0, y: 0 };

    // Hover state
    this.hoverGridX = null;
    this.hoverGridY = null;
    this.hoveredMeepleDot = null;
    this.hoveredInPlaceButton = null;

    // Pending In-Place Tile (BGA Style)
    this.pendingPos = null; // { x, y }
    this.pendingRotation = 0;
    this.isPendingValid = false;
    this.isSubmittingPlacement = false; // Anti-duplicate click lock

    // Game data references
    this.boardData = null;
    this.validPlacements = [];
    this.currentTile = null;
    this.currentRotation = 0;
    this.turnPhase = 'place_tile';
    this.lastPlacedPos = null;
    this.meepleSegments = [];
    this.activePlayerColor = 'red';
    this.isMyTurn = false;
    this.hasMeeples = true;

    // Image Caches
    this.tileImages = new Map();
    this.meepleImages = new Map();
    this.preloadMeeples();

    // Laser Pointer Interactive System
    this.lasers = new Map(); // playerId -> { id, name, color, x, y, time, trail: [] }
    this.laserMode = false;
    this.onLaserMove = null;
    this.onLaserLeave = null;

    this.initEvents();
    this.initResizeObserver();
  }

  preloadMeeples() {
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'pink'];
    colors.forEach(col => {
      const img = new Image();
      img.src = `assets/meeples/meeple_${col}.svg`;
      this.meepleImages.set(col, img);
    });
  }

  preloadTileDeck() {
    const tileList = [];
    // Base Set 1 (00 to 59)
    for (let i = 0; i <= 59; i++) {
      tileList.push(`assets/tiles/base_21_${String(i).padStart(2, '0')}.png`);
    }
    // Base Set 2 (00 to 11)
    for (let i = 0; i <= 11; i++) {
      tileList.push(`assets/tiles/base_22_${String(i).padStart(2, '0')}.png`);
    }
    // River Expansion (00 to 11)
    for (let i = 0; i <= 11; i++) {
      tileList.push(`assets/tiles/river_23_${String(i).padStart(2, '0')}.png`);
    }
    tileList.push('assets/tiles/tile_back.png');

    tileList.forEach(src => {
      const img = new Image();
      img.src = src;
      if (img.decode) {
        img.decode().then(() => {
          this.tileImages.set(src, img);
        }).catch(() => {
          this.tileImages.set(src, img);
        });
      } else {
        img.onload = () => this.tileImages.set(src, img);
        this.tileImages.set(src, img);
      }
    });
  }

  getTileImage(src) {
    if (!src) return null;
    if (!this.tileImages.has(src)) {
      const img = new Image();
      img.src = src;
      if (img.decode) {
        img.decode().then(() => {
          this.tileImages.set(src, img);
          this.draw();
        }).catch(() => {
          this.tileImages.set(src, img);
          this.draw();
        });
      } else {
        img.onload = () => {
          this.tileImages.set(src, img);
          this.draw();
        };
      }
      this.tileImages.set(src, img);
      return img;
    }
    return this.tileImages.get(src);
  }

  initResizeObserver() {
    const container = this.canvas.parentElement;
    if (window.ResizeObserver && container) {
      const ro = new ResizeObserver(() => {
        this.resize();
      });
      ro.observe(container);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: 800, height: 600 };
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    const oldW = this.width;
    const oldH = this.height;
    this.width = rect.width;
    this.height = rect.height;

    // If canvas was already initialized, keep existing zoom and pan without jumping
    if (oldW > 0 && oldH > 0) {
      this.panX += (this.width - oldW) / 2;
      this.panY += (this.height - oldH) / 2;
      this.draw();
    } else {
      this.centerView();
    }
  }

  getTilesList() {
    if (!this.boardData || !this.boardData.tiles) return [];
    if (Array.isArray(this.boardData.tiles)) return this.boardData.tiles;
    if (this.boardData.tiles instanceof Map) return Array.from(this.boardData.tiles.values());
    if (typeof this.boardData.tiles === 'object') return Object.values(this.boardData.tiles);
    return [];
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.zoom + this.panX,
      y: worldY * this.zoom + this.panY
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom
    };
  }

  scheduleLaserDraw() {
    if (this.laserAnimFrame) return;
    const loop = () => {
      if (this.lasers.size > 0 || this.laserMode) {
        this.draw();
        this.laserAnimFrame = requestAnimationFrame(loop);
      } else {
        this.laserAnimFrame = null;
        this.draw();
      }
    };
    this.laserAnimFrame = requestAnimationFrame(loop);
  }

  setLaser(playerId, data) {
    if (!data || !data.active) {
      this.lasers.delete(playerId);
    } else {
      const now = Date.now();
      const existing = this.lasers.get(playerId) || { trail: [] };
      const newTrail = existing.trail.filter(pt => now - pt.time < 1200);
      newTrail.push({ x: data.worldX, y: data.worldY, time: now });
      this.lasers.set(playerId, {
        id: playerId,
        name: data.playerName || 'Comandante',
        color: data.playerColor || 'red',
        x: data.worldX,
        y: data.worldY,
        time: now,
        trail: newTrail
      });
    }
    this.scheduleLaserDraw();
  }

  removeLaser(playerId) {
    if (this.lasers.has(playerId)) {
      this.lasers.delete(playerId);
      this.scheduleLaserDraw();
    }
  }

  centerView(forceFit = false) {
    const tiles = this.getTilesList();
    if (tiles.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const t of tiles) {
        if (!t || typeof t.x !== 'number') continue;
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.y > maxY) maxY = t.y;
      }
      if (this.validPlacements && this.validPlacements.length > 0) {
        for (const p of this.validPlacements) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      }

      if (minX !== Infinity) {
        const isMobile = window.innerWidth <= 1024;
        if (forceFit || !this.userHasZoomed) {
          const spanX = Math.max(4, (maxX - minX + 2.5));
          const spanY = Math.max(4, (maxY - minY + 2.5));
          const fitZoomX = this.width / (spanX * this.tileSize);
          const fitZoomY = this.height / (spanY * this.tileSize);
          const optimalZoom = Math.min(fitZoomX, fitZoomY);
          const maxDefaultCap = isMobile ? 0.65 : 0.85;
          this.zoom = Math.max(this.minZoom, Math.min(maxDefaultCap, optimalZoom));
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        this.panX = this.width / 2 - (centerX * this.tileSize * this.zoom);
        this.panY = this.height / 2 - (centerY * this.tileSize * this.zoom);
      }
    } else {
      this.panX = this.width / 2;
      this.panY = this.height / 2;
    }
    this.draw();
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.draw();
  }

  zoomBy(factor) {
    this.userHasZoomed = true;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    if (newZoom !== this.zoom) {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      this.panX = centerX - (centerX - this.panX) * (newZoom / this.zoom);
      this.panY = centerY - (centerY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.draw();
    }
  }

  resetZoom() {
    this.userHasZoomed = false;
    this.centerView(true);
  }

  initEvents() {
    // ==================== MOUSE EVENTS ====================
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.hasMoved = false;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = (e.clientX - this.dragStartX) - this.panX;
        const dy = (e.clientY - this.dragStartY) - this.panY;
        if (Math.hypot(dx, dy) > 8) {
          this.hasMoved = true;
          this.setHudDimmed(true);
        }

        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.draw();
      }

      if (mouseX >= 0 && mouseX <= this.width && mouseY >= 0 && mouseY <= this.height) {
        if (this.laserMode) {
          const worldX = (mouseX - this.panX) / this.zoom;
          const worldY = (mouseY - this.panY) / this.zoom;
          if (this.onLaserMove) this.onLaserMove(worldX, worldY);
        }

        const gridPos = this.screenToGrid(mouseX, mouseY);
        this.hoverGridX = gridPos.x;
        this.hoverGridY = gridPos.y;

        // Check meeple hover (only when not in laser mode)
        let foundDot = null;
        if (!this.laserMode && this.turnPhase === 'place_meeple' && this.lastPlacedPos && this.isMyTurn && this.hasMeeples) {
          const screen = this.gridToScreen(this.lastPlacedPos.x, this.lastPlacedPos.y);
          for (const seg of this.meepleSegments) {
            if (seg.noMeeple || seg.type === 'river') continue;
            const dotX = screen.x + seg.pos.x * screen.size;
            const dotY = screen.y + seg.pos.y * screen.size;
            const radius = Math.max(22, 18 * this.zoom);
            if (Math.hypot(mouseX - dotX, mouseY - dotY) <= radius) {
              foundDot = seg;
              break;
            }
          }
        }
        this.hoveredMeepleDot = foundDot;
        this.draw();
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.laserMode && this.onLaserLeave) {
        this.onLaserLeave();
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.setHudDimmed(false);
      if (!this.isDragging) return;
      this.isDragging = false;

      // Ignore synthetic mouse events emitted by mobile browsers after touch
      if (this.lastTouchTime && (Date.now() - this.lastTouchTime < 650)) {
        return;
      }

      // If in laser mode, do NOT trigger any board click action
      if (this.laserMode) {
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (!this.hasMoved && mouseX >= 0 && mouseX <= this.width && mouseY >= 0 && mouseY <= this.height) {
        this.handleCanvasClick(mouseX, mouseY);
      }
    });

    // Mouse Wheel Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

      if (newZoom !== this.zoom) {
        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
        this.draw();
      }
    }, { passive: false });

    // ==================== TOUCH & GESTURE EVENTS (MOBILE FIRST) ====================
    this.canvas.addEventListener('touchstart', (e) => {
      this.lastTouchTime = Date.now();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        
        if (this.laserMode) {
          // 1 Finger in laser mode: Draw laser trace without moving the map
          if (e.cancelable) e.preventDefault();
          this.isDragging = false;
          this.hasMoved = false;
          const tX = t.clientX - rect.left;
          const tY = t.clientY - rect.top;
          const worldX = (tX - this.panX) / this.zoom;
          const worldY = (tY - this.panY) / this.zoom;
          if (this.onLaserMove) this.onLaserMove(worldX, worldY);
        } else {
          this.isDragging = true;
          this.hasMoved = false;
          this.dragStartX = t.clientX - this.panX;
          this.dragStartY = t.clientY - this.panY;
        }
      } else if (e.touches.length === 2) {
        // 2 Fingers: Pinch to zoom and map panning (works in both normal and laser mode)
        this.isDragging = false;
        this.setHudDimmed(true);
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        this.touchStartZoom = this.zoom;
        this.touchStartCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      this.lastTouchTime = Date.now();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();

        if (this.laserMode) {
          // 1 Finger: Smooth laser tracing across screen (does NOT move the map)
          if (e.cancelable) e.preventDefault();
          this.isDragging = false;
          const tX = t.clientX - rect.left;
          const tY = t.clientY - rect.top;
          const worldX = (tX - this.panX) / this.zoom;
          const worldY = (tY - this.panY) / this.zoom;
          if (this.onLaserMove) this.onLaserMove(worldX, worldY);
        } else if (this.isDragging) {
          const dx = (t.clientX - this.dragStartX) - this.panX;
          const dy = (t.clientY - this.dragStartY) - this.panY;
          if (Math.hypot(dx, dy) > 10) {
            this.hasMoved = true;
            this.setHudDimmed(true);
          }

          this.panX = t.clientX - this.dragStartX;
          this.panY = t.clientY - this.dragStartY;
          this.draw();
        }
      } else if (e.touches.length === 2 && this.touchStartDist > 0) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = currentDist / this.touchStartDist;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.touchStartZoom * factor));

        if (newZoom !== this.zoom) {
          this.userHasZoomed = true;
          const centerX = this.touchStartCenter.x;
          const centerY = this.touchStartCenter.y;
          this.panX = centerX - (centerX - this.panX) * (newZoom / this.zoom);
          this.panY = centerY - (centerY - this.panY) * (newZoom / this.zoom);
          this.zoom = newZoom;
          this.draw();
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      this.lastTouchTime = Date.now();
      this.setHudDimmed(false);

      if (this.laserMode) {
        if (e.touches.length === 0 && this.onLaserLeave) {
          this.onLaserLeave();
        }
        this.isDragging = false;
        this.touchStartDist = 0;
        return; // Never trigger placement actions in laser mode
      }

      if (this.isDragging && !this.hasMoved && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = t.clientX - rect.left;
        const touchY = t.clientY - rect.top;
        this.handleCanvasClick(touchX, touchY);
      }
      this.isDragging = false;
      this.touchStartDist = 0;
    });

    this.canvas.addEventListener('touchcancel', () => {
      this.setHudDimmed(false);
      this.isDragging = false;
      this.touchStartDist = 0;
    });
  }

  setHudDimmed(dimmed) {
    const hud = document.getElementById('mobile-floating-tile-hud');
    if (hud) {
      if (dimmed) hud.classList.add('dimmed');
      else hud.classList.remove('dimmed');
    }
  }

  screenToGrid(screenX, screenY) {
    const worldX = (screenX - this.panX) / this.zoom;
    const worldY = (screenY - this.panY) / this.zoom;
    const size = this.tileSize;
    return {
      x: Math.floor((worldX + size / 2) / size),
      y: Math.floor((worldY + size / 2) / size)
    };
  }

  gridToScreen(gridX, gridY) {
    const size = this.tileSize;
    const worldX = gridX * size - size / 2;
    const worldY = gridY * size - size / 2;
    return {
      x: worldX * this.zoom + this.panX,
      y: worldY * this.zoom + this.panY,
      size: size * this.zoom
    };
  }

  handleCanvasClick(screenX, screenY) {
    // In laser mode, completely block all canvas tile placement, meeples, and rotation
    if (this.laserMode) return;

    if (window.closeAllMobileDrawers) window.closeAllMobileDrawers();
    if (this.isSubmittingPlacement) return; // Prevent duplicate rapid clicks

    // 1. If in meeple placement phase, check enlarged touch points or tile bounding box
    if (this.turnPhase === 'place_meeple' && this.lastPlacedPos && this.isMyTurn && this.hasMeeples) {
      const screen = this.gridToScreen(this.lastPlacedPos.x, this.lastPlacedPos.y);
      const validSegs = (this.meepleSegments || []).filter(s => !s.noMeeple && s.type !== 'river' && !s.isOccupied);

      let chosenSeg = null;
      let minDistance = Infinity;
      const touchRadius = Math.max(32, 26 * this.zoom); // Generous 64px diameter touch target

      // A. Check distance to each segment dot
      for (const seg of validSegs) {
        const dotX = screen.x + seg.pos.x * screen.size;
        const dotY = screen.y + seg.pos.y * screen.size;
        const dist = Math.hypot(screenX - dotX, screenY - dotY);
        if (dist <= touchRadius && dist < minDistance) {
          minDistance = dist;
          chosenSeg = seg;
        }
      }

      // B. If not directly on a dot, check if tapped anywhere on the newly placed tile
      if (!chosenSeg && validSegs.length > 0 &&
          screenX >= screen.x - 4 && screenX <= screen.x + screen.size + 4 &&
          screenY >= screen.y - 4 && screenY <= screen.y + screen.size + 4) {
        for (const seg of validSegs) {
          const dotX = screen.x + seg.pos.x * screen.size;
          const dotY = screen.y + seg.pos.y * screen.size;
          const dist = Math.hypot(screenX - dotX, screenY - dotY);
          if (dist < minDistance) {
            minDistance = dist;
            chosenSeg = seg;
          }
        }
      }

      if (chosenSeg) {
        if (this.onMeeplePointClick) {
          this.isSubmittingPlacement = true;
          setTimeout(() => { this.isSubmittingPlacement = false; }, 400); // Safety auto-reset
          this.onMeeplePointClick(chosenSeg.id, chosenSeg.pos);
        }
        return;
      }
    }

    // 2. If Pending Tile exists, check clicks on in-place Confirm (✓), Rotate (🔄) or the tile itself
    if (this.pendingPos && this.turnPhase === 'place_tile' && this.isMyTurn) {
      const screen = this.gridToScreen(this.pendingPos.x, this.pendingPos.y);

      // Check tap on confirm button at bottom-right corner
      if (this.isPendingValid) {
        const confirmRadius = Math.max(16, 20 * this.zoom);
        const confirmX = screen.x + screen.size - confirmRadius - 2;
        const confirmY = screen.y + screen.size - confirmRadius - 2;
        if (Math.hypot(screenX - confirmX, screenY - confirmY) <= confirmRadius + 10) {
          if (this.onConfirmPendingTile) {
            this.isSubmittingPlacement = true;
            this.onConfirmPendingTile(this.pendingPos.x, this.pendingPos.y, this.pendingRotation);
          }
          return;
        }
      }

      // Tap anywhere on the pending tile -> rotate it
      if (screenX >= screen.x && screenX <= screen.x + screen.size &&
          screenY >= screen.y && screenY <= screen.y + screen.size) {
        this.rotatePendingTile(1);
        return;
      }

      // Tap outside -> cancel or move pending tile
      const clickedGrid = this.screenToGrid(screenX, screenY);
      if (clickedGrid.x === this.pendingPos.x && clickedGrid.y === this.pendingPos.y) {
        return;
      }
      this.clearPendingTile();
      return;
    }

    // 3. Normal Tile Placement phase: tap on valid slot
    const grid = this.screenToGrid(screenX, screenY);
    if (this.turnPhase === 'place_tile' && this.isMyTurn) {
      const slot = this.validPlacements.find(p => p.x === grid.x && p.y === grid.y);
      if (slot) {
        this.setPendingTile(grid.x, grid.y, slot);
        return;
      }
    }

    // 4. Clicked on an existing tile
    if (this.boardData && this.boardData.tiles) {
      const tile = this.boardData.tiles.find(t => t.x === grid.x && t.y === grid.y);
      if (tile && this.onTileClick) {
        this.onTileClick(grid.x, grid.y, tile);
      }
    }
  }

  setPendingTile(x, y, slot) {
    this.pendingPos = { x, y };
    if (slot && slot.validRotations && slot.validRotations.length > 0) {
      if (slot.validRotations.includes(this.currentRotation)) {
        this.pendingRotation = this.currentRotation;
      } else {
        this.pendingRotation = slot.validRotations[0];
      }
      this.isPendingValid = true;
    } else {
      this.pendingRotation = this.currentRotation;
      this.isPendingValid = false;
    }
    audio.playTilePlace();
    this.notifyPendingState();
    this.draw();
  }

  rotatePendingTile(dir = 1) {
    if (!this.pendingPos) return;
    this.pendingRotation = (this.pendingRotation + dir * 90 + 360) % 360;
    this.currentRotation = this.pendingRotation;
    audio.playTileRotate();

    const slot = this.validPlacements.find(p => p.x === this.pendingPos.x && p.y === this.pendingPos.y);
    if (slot && slot.validRotations) {
      this.isPendingValid = slot.validRotations.includes(this.pendingRotation);
    } else {
      this.isPendingValid = false;
    }
    this.notifyPendingState();
    this.draw();
  }

  clearPendingTile() {
    this.pendingPos = null;
    this.notifyPendingState();
    this.draw();
  }

  notifyPendingState() {
    const floatingTileImg = document.getElementById('floating-tile-img');
    if (floatingTileImg) {
      const rot = this.pendingPos ? this.pendingRotation : this.currentRotation;
      floatingTileImg.style.transform = `rotate(${rot}deg)`;
    }
    if (this.onPendingStateChange) {
      this.onPendingStateChange({
        pendingPos: this.pendingPos,
        pendingRotation: this.pendingRotation,
        isValid: this.isPendingValid
      });
    }
  }

  updateState({ board, validPlacements, currentTile, currentRotation, turnPhase, lastPlacedPos, segments, activePlayerColor, isMyTurn, hasMeeples }) {
    this.isSubmittingPlacement = false;
    const isFirstLoad = !this.boardData;
    this.boardData = board;
    this.validPlacements = validPlacements || [];
    this.currentTile = currentTile;
    this.currentRotation = currentRotation || 0;
    this.turnPhase = turnPhase || 'place_tile';
    this.lastPlacedPos = lastPlacedPos;
    this.meepleSegments = (segments || []).filter(s => !s.noMeeple && s.type !== 'river');
    this.activePlayerColor = activePlayerColor || 'red';
    this.isMyTurn = !!isMyTurn;
    this.hasMeeples = hasMeeples !== false;

    if (this.turnPhase !== 'place_tile') {
      this.pendingPos = null;
      this.notifyPendingState();
    }

    if (isFirstLoad) {
      this.centerView();
    } else {
      this.draw();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Subtle Grid background
    this.drawBackgroundGrid();

    // 2. Draw Placed Tiles
    const tiles = this.getTilesList();
    for (const placed of tiles) {
      this.drawPlacedTile(placed);
    }

    // 3. Draw Valid Placement Slots
    if (this.turnPhase === 'place_tile' && this.isMyTurn && this.validPlacements.length > 0) {
      for (const slot of this.validPlacements) {
        if (!this.pendingPos || (this.pendingPos.x !== slot.x || this.pendingPos.y !== slot.y)) {
          this.drawPlacementSlot(slot);
        }
      }
    }

    // 4. Draw Pending In-Place Tile
    if (this.pendingPos && this.turnPhase === 'place_tile' && this.isMyTurn && this.currentTile) {
      this.drawPendingInPlaceTile();
    }

    // 5. Draw Meeple Placement Points (ONLY if has meeples)
    if (this.turnPhase === 'place_meeple' && this.lastPlacedPos && this.isMyTurn && this.hasMeeples) {
      this.drawMeeplePlacementPoints();
    }

    // 6. Draw Interactive Laser Pointers
    this.drawLasers();

    ctx.restore();

    // 7. Dynamically update floating action buttons position next to active tile
    this.updateFloatingControlsPosition();
  }

  drawLasers() {
    const now = Date.now();
    for (const [id, laser] of this.lasers.entries()) {
      if (now - laser.time > 2500) {
        this.lasers.delete(id);
        continue;
      }

      const screen = this.worldToScreen(laser.x, laser.y);
      const colorMap = {
        red: '#ef4444',
        blue: '#3b82f6',
        green: '#10b981',
        yellow: '#f59e0b',
        black: '#94a3b8',
        purple: '#a855f7'
      };
      const baseColor = colorMap[laser.color] || '#f43f5e';

      // 1. Draw trail
      if (laser.trail && laser.trail.length > 1) {
        this.ctx.beginPath();
        for (let i = 0; i < laser.trail.length; i++) {
          const pt = laser.trail[i];
          const sPt = this.worldToScreen(pt.x, pt.y);
          const alpha = Math.max(0, 1 - (now - pt.time) / 500) * 0.5;
          this.ctx.strokeStyle = baseColor;
          this.ctx.lineWidth = 3 * this.zoom;
          this.ctx.globalAlpha = alpha;
          if (i === 0) this.ctx.moveTo(sPt.x, sPt.y);
          else this.ctx.lineTo(sPt.x, sPt.y);
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
      }

      // 2. Draw outer glowing ripple
      const pulse = 1 + 0.25 * Math.sin(now / 100);
      const auraRad = 16 * pulse;
      const grad = this.ctx.createRadialGradient(screen.x, screen.y, 2, screen.x, screen.y, auraRad);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.4, baseColor + '88');
      grad.addColorStop(1, 'transparent');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, auraRad, 0, Math.PI * 2);
      this.ctx.fill();

      // 3. Draw bright center laser core
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = baseColor;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // 4. Draw player tag pill above laser
      this.ctx.font = 'bold 11px Inter, sans-serif';
      const text = `🔴 ${laser.name}`;
      const textMetrics = this.ctx.measureText(text);
      const tagW = textMetrics.width + 12;
      const tagH = 18;
      const tagX = screen.x - tagW / 2;
      const tagY = screen.y - 28;

      this.ctx.fillStyle = 'rgba(15, 12, 10, 0.88)';
      this.ctx.strokeStyle = baseColor;
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(tagX, tagY, tagW, tagH, 4);
      } else {
        this.ctx.rect(tagX, tagY, tagW, tagH);
      }
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.fillText(text, tagX + 6, tagY + 13);
    }
  }

  updateFloatingControlsPosition() {
    const boardRightActions = document.getElementById('board-right-actions');
    const boardRightConfirm = document.getElementById('board-right-confirm');
    const isMobile = window.innerWidth <= 1024;

    // 1. Meeple / Confirm Phase: Finalize (⚔️), Pass (⏩), Undo (↩️) buttons positioned dynamically near the placed tile on PC!
    if (boardRightActions && boardRightActions.style.display !== 'none') {
      if (!isMobile && (this.turnPhase === 'place_meeple' || this.turnPhase === 'confirm_turn') && this.lastPlacedPos) {
        const screen = this.gridToScreen(this.lastPlacedPos.x, this.lastPlacedPos.y);
        let posX = screen.x + screen.size + 14;
        let posY = screen.y + screen.size / 2 - 42;

        if (posX + 60 > this.width - 16) {
          posX = screen.x - 60;
        }
        posX = Math.max(16, Math.min(this.width - 70, posX));
        posY = Math.max(16, Math.min(this.height - 110, posY));

        boardRightActions.style.left = `${posX}px`;
        boardRightActions.style.top = `${posY}px`;
        boardRightActions.style.right = 'auto';
        boardRightActions.style.bottom = 'auto';
      } else if (isMobile) {
        boardRightActions.style.left = 'auto';
        boardRightActions.style.top = 'auto';
        boardRightActions.style.right = '14px';
        boardRightActions.style.bottom = 'calc(18px + env(safe-area-inset-bottom, 0px))';
      }
    }

    // 2. Tile Phase with Pending Tile: Confirm (✓) button positioned dynamically near the pending tile!
    if (boardRightConfirm && boardRightConfirm.style.display !== 'none') {
      if (!isMobile && this.pendingPos && this.turnPhase === 'place_tile') {
        const screen = this.gridToScreen(this.pendingPos.x, this.pendingPos.y);
        let posX = screen.x + screen.size + 14;
        let posY = screen.y + screen.size / 2 - 24;

        if (posX + 60 > this.width - 16) {
          posX = screen.x - 60;
        }
        posX = Math.max(16, Math.min(this.width - 70, posX));
        posY = Math.max(16, Math.min(this.height - 70, posY));

        boardRightConfirm.style.left = `${posX}px`;
        boardRightConfirm.style.top = `${posY}px`;
        boardRightConfirm.style.right = 'auto';
        boardRightConfirm.style.bottom = 'auto';
      } else if (isMobile) {
        boardRightConfirm.style.left = 'auto';
        boardRightConfirm.style.top = 'auto';
        boardRightConfirm.style.right = '14px';
        boardRightConfirm.style.bottom = 'calc(18px + env(safe-area-inset-bottom, 0px))';
      }
    }
  }

  drawBackgroundGrid() {
    const ctx = this.ctx;
    const size = this.tileSize * this.zoom;
    const startX = this.panX % size;
    const startY = this.panY % size;

    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(233, 193, 118, 0.07)';
    ctx.lineWidth = 1;

    for (let x = startX - size; x < this.width + size; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    for (let y = startY - size; y < this.height + size; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlacedTile(placed) {
    const ctx = this.ctx;
    const screen = this.gridToScreen(placed.x, placed.y);

    if (screen.x + screen.size < 0 || screen.x > this.width ||
        screen.y + screen.size < 0 || screen.y > this.height) {
      return;
    }

    const img = this.getTileImage(placed.tile.image);

    ctx.save();
    ctx.translate(screen.x + screen.size / 2, screen.y + screen.size / 2);
    ctx.rotate((placed.rotation * Math.PI) / 180);

    ctx.shadowColor = 'rgba(16, 14, 12, 0.85)';
    ctx.shadowBlur = 8 * this.zoom;
    ctx.shadowOffsetX = 3 * this.zoom;
    ctx.shadowOffsetY = 4 * this.zoom;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -screen.size / 2, -screen.size / 2, screen.size, screen.size);
    } else {
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-screen.size / 2, -screen.size / 2, screen.size, screen.size);
    }

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1 * this.zoom;
    ctx.strokeRect(-screen.size / 2, -screen.size / 2, screen.size, screen.size);

    ctx.restore();

    if (placed.meeple) {
      this.drawMeeple(placed.x, placed.y, placed.meeple);
    }
  }

  drawPlacementSlot(slot) {
    const ctx = this.ctx;
    const screen = this.gridToScreen(slot.x, slot.y);

    const isHovered = this.hoverGridX === slot.x && this.hoverGridY === slot.y;

    ctx.save();
    ctx.shadowColor = isHovered ? 'rgba(46, 204, 113, 0.8)' : 'rgba(241, 196, 15, 0.6)';
    ctx.shadowBlur = isHovered ? 14 * this.zoom : 8 * this.zoom;

    ctx.fillStyle = isHovered ? 'rgba(46, 204, 113, 0.25)' : 'rgba(241, 196, 15, 0.15)';
    ctx.fillRect(screen.x + 2, screen.y + 2, screen.size - 4, screen.size - 4);

    ctx.strokeStyle = isHovered ? '#2ecc71' : '#f1c40f';
    ctx.lineWidth = (isHovered ? 3 : 2) * this.zoom;
    ctx.setLineDash([6 * this.zoom, 4 * this.zoom]);
    ctx.strokeRect(screen.x + 2, screen.y + 2, screen.size - 4, screen.size - 4);

    ctx.setLineDash([]);
    ctx.fillStyle = isHovered ? '#2ecc71' : '#f1c40f';
    ctx.font = `bold ${Math.max(14, 20 * this.zoom)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', screen.x + screen.size / 2, screen.y + screen.size / 2);

    ctx.restore();
  }

  drawPendingInPlaceTile() {
    const ctx = this.ctx;
    const screen = this.gridToScreen(this.pendingPos.x, this.pendingPos.y);
    const img = this.getTileImage(this.currentTile.image);

    ctx.save();
    ctx.translate(screen.x + screen.size / 2, screen.y + screen.size / 2);
    ctx.rotate((this.pendingRotation * Math.PI) / 180);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -screen.size / 2, -screen.size / 2, screen.size, screen.size);
    }

    ctx.shadowColor = this.isPendingValid ? 'rgba(46, 204, 113, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    ctx.shadowBlur = 14 * this.zoom;
    ctx.strokeStyle = this.isPendingValid ? '#2ecc71' : '#ef4444';
    ctx.lineWidth = 3.5 * this.zoom;
    ctx.strokeRect(-screen.size / 2, -screen.size / 2, screen.size, screen.size);

    ctx.restore();

    // In-place rotate & confirm badges: only on desktop (mouse hover), hidden on mobile/tablet
    const isMobileOrTablet = window.innerWidth <= 1024 || ('ontouchstart' in window);
    if (!isMobileOrTablet) {
      // Center Rotate Badge inside the pending tile
      const centerRadius = Math.max(16, 20 * this.zoom);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(41, 128, 185, 0.9)';
      ctx.beginPath();
      ctx.arc(screen.x + screen.size / 2, screen.y + screen.size / 2, centerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, 15 * this.zoom)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔄', screen.x + screen.size / 2, screen.y + screen.size / 2);
      ctx.restore();

      // Confirm Button (✓) at bottom-right corner if valid
      if (this.isPendingValid) {
        const confirmRadius = Math.max(16, 20 * this.zoom);
        const confirmX = screen.x + screen.size - confirmRadius - 2;
        const confirmY = screen.y + screen.size - confirmRadius - 2;
        ctx.save();
        ctx.shadowColor = 'rgba(46, 204, 113, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(confirmX, confirmY, confirmRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(14, 18 * this.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', confirmX, confirmY);
        ctx.restore();
      }
    }
  }

  // Draw BGA-style interactive Meeple placement dots with enlarged touch target
  drawMeeplePlacementPoints() {
    if (!this.hasMeeples) return;

    const ctx = this.ctx;
    const screen = this.gridToScreen(this.lastPlacedPos.x, this.lastPlacedPos.y);

    ctx.save();
    ctx.shadowColor = 'rgba(59, 130, 246, 0.9)';
    ctx.shadowBlur = 15 * this.zoom;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3 * this.zoom;
    ctx.strokeRect(screen.x, screen.y, screen.size, screen.size);
    ctx.restore();

    for (const seg of this.meepleSegments) {
      if (seg.noMeeple || seg.type === 'river') continue;

      const dotX = screen.x + seg.pos.x * screen.size;
      const dotY = screen.y + seg.pos.y * screen.size;
      const isHovered = this.hoveredMeepleDot === seg;
      const isField = seg.type === 'field' || seg.id.startsWith('field');
      const isOccupied = !!seg.isOccupied;

      if (isOccupied) {
        // Subtle red/gray indicator for occupied structure
        const radius = Math.max(6, 6.5 * this.zoom);
        ctx.save();
        ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(8, 10 * this.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', dotX, dotY);
        ctx.restore();
        continue;
      }

      const radius = Math.max(7.5, (isHovered ? 10.5 : 8) * this.zoom);

      ctx.save();
      ctx.shadowColor = isHovered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = (isHovered ? 6 : 3) * this.zoom;

      ctx.fillStyle = isHovered ? '#ffffff' : (seg.color || '#f1c40f');
      ctx.beginPath();
      ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isHovered ? '#f59e0b' : '#ffffff';
      ctx.lineWidth = Math.max(1.5, 2 * this.zoom);
      ctx.stroke();

      if (isHovered) {
        const meepleImg = this.meepleImages.get(this.activePlayerColor);
        if (meepleImg && meepleImg.complete) {
          ctx.save();
          ctx.translate(dotX, dotY);
          if (isField) {
            ctx.rotate(Math.PI / 2);
          }
          const mSize = Math.max(16, 18 * this.zoom);
          ctx.drawImage(meepleImg, -mSize / 2, -mSize / 2, mSize, mSize);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(2, 2.5 * this.zoom), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Draw placed meeple (Farmers rendered Laying Down / Horizontal!)
  drawMeeple(gx, gy, meeple) {
    const ctx = this.ctx;
    const screen = this.gridToScreen(gx, gy);
    const pos = meeple.pos || { x: 0.5, y: 0.5 };

    const meepleX = screen.x + pos.x * screen.size;
    const meepleY = screen.y + pos.y * screen.size;
    const meepleSize = 25 * this.zoom;

    const isFarmer = meeple.segmentId && (meeple.segmentId.startsWith('field') || meeple.type === 'field');
    const colorKey = meeple.color || meeple.player || 'red';
    const img = this.meepleImages.get(colorKey) || this.meepleImages.get('red');

    ctx.save();
    ctx.translate(meepleX, meepleY);

    if (isFarmer) {
      ctx.rotate(Math.PI / 2);
    }

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -meepleSize / 2, -meepleSize / 2, meepleSize, meepleSize);
    } else {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(0, 0, meepleSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
