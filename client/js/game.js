// Carcassonne Game Client Controller (Touch-First & Mobile Contextual UI)

const socket = io();

// State
let myPlayerId = localStorage.getItem('carcassonne_player_id') || ('usr_' + Math.random().toString(36).substring(2, 9));
localStorage.setItem('carcassonne_player_id', myPlayerId);

let myPlayerName = localStorage.getItem('carcassonne_player_name') || 'Jugador ' + Math.floor(Math.random() * 900 + 100);
let currentRoom = null;
let boardRenderer = null;
let activeMeepleSegments = [];

let localPlayersConfig = [
  { name: 'Jugador 1', isBot: false, color: 'red' },
  { name: '🤖 Bot Carlomagno', isBot: true, difficulty: 'medium', color: 'blue' }
];

// DOM Elements
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const playerNameInput = document.getElementById('player-name-input');
const colorSelect = document.getElementById('preferred-color-select');
const roomsList = document.getElementById('rooms-list');
const savesList = document.getElementById('saves-list');

// In-Game UI
const roomTitle = document.getElementById('room-title');
const roomCodeBadge = document.getElementById('room-code-badge');
const playersListEl = document.getElementById('players-list');
const tilePreviewImg = document.getElementById('tile-preview-img');
const tileRemainingEl = document.getElementById('tiles-remaining');
const rotateBtn = document.getElementById('rotate-tile-btn');
const turnIndicator = document.getElementById('turn-indicator');
const meepleSelectionPanel = document.getElementById('meeple-selection-panel');
const meepleOptionsEl = document.getElementById('meeple-options');
const passMeepleBtn = document.getElementById('pass-meeple-btn');
const cancelTileBtn = document.getElementById('cancel-tile-btn');
const addBotBtn = document.getElementById('add-bot-btn');
const chatMessagesEl = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const logsListEl = document.getElementById('logs-list');

// War Room Pre-Game Briefing Elements
const warRoomView = document.getElementById('war-room-view');
const warRoomTitle = document.getElementById('war-room-title');
const warRoomSubtitle = document.getElementById('war-room-subtitle');
const warRoomCode = document.getElementById('war-room-code');
const warRoomPlayerCount = document.getElementById('war-room-player-count');
const warRoomPlayersList = document.getElementById('war-room-players-list');
const warRoomColorSelect = document.getElementById('war-room-color-select');
const warRoomChatMessages = document.getElementById('war-room-chat-messages');
const warRoomChatInput = document.getElementById('war-room-chat-input');
const warRoomSendChatBtn = document.getElementById('war-room-send-chat-btn');
const warRoomRiverBadge = document.getElementById('war-room-river-badge');
const warRoomSandboxBadge = document.getElementById('war-room-sandbox-badge');
const warRoomStartBtn = document.getElementById('war-room-start-btn');
const warRoomWaitingMsg = document.getElementById('war-room-waiting-msg');
const warRoomLeaveBtn = document.getElementById('war-room-leave-btn');
const warRoomAddBotBtn = document.getElementById('war-room-add-bot-btn');

// Mobile UI Elements
const sidePanel = document.getElementById('side-panel');
const chatDrawer = document.getElementById('chat-drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileChatToggle = document.getElementById('mobile-chat-toggle');
const mobileMoreBtn = document.getElementById('mobile-more-btn');
const mobileMoreDropdown = document.getElementById('mobile-more-dropdown');
const closeSidePanelBtn = document.getElementById('close-side-panel-btn');
const closeChatDrawerBtn = document.getElementById('close-chat-drawer-btn');
const mobileRotateBtn = document.getElementById('mobile-rotate-btn');
const mobileContextualBar = document.getElementById('mobile-contextual-bar');
const contextualPendingActions = document.getElementById('contextual-pending-actions');
const contextualMeepleActions = document.getElementById('contextual-meeple-actions');

// Mobile Dropdown Action Items
const mobileTileEditorBtn = document.getElementById('mobile-tile-editor-btn');
const mobileShortcutsBtn = document.getElementById('mobile-shortcuts-btn');
const mobileSandboxBtn = document.getElementById('mobile-sandbox-btn');
const mobileSaveBtn = document.getElementById('mobile-save-btn');
const mobileLeaveBtn = document.getElementById('mobile-leave-btn');

// Touch Action Buttons
const touchRotLeftBtn = document.getElementById('touch-rot-left-btn');
const touchRotRightBtn = document.getElementById('touch-rot-right-btn');
const touchConfirmBtn = document.getElementById('touch-confirm-btn');
const touchCancelPendingBtn = document.getElementById('touch-cancel-pending-btn');
const touchPassMeepleBtn = document.getElementById('touch-pass-meeple-btn');
const touchCancelTileBtn = document.getElementById('touch-cancel-tile-btn');
const boardRightActions = document.getElementById('board-right-actions');
const boardRightConfirm = document.getElementById('board-right-confirm');
const floatingPassCircleBtn = document.getElementById('floating-pass-circle-btn');
const floatingUndoBtn = document.getElementById('floating-undo-btn');
const floatingConfirmBtn = document.getElementById('floating-confirm-btn');

// Mobile Mini HUD
const mobileMiniHud = document.getElementById('mobile-mini-hud');
const mobileHudPlayer = document.getElementById('mobile-hud-player');
const mobileHudDeck = document.getElementById('mobile-hud-deck');

// Shortcuts modal
const shortcutsModal = document.getElementById('shortcuts-modal');
const shortcutsToggleBtn = document.getElementById('shortcuts-toggle-btn');
const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');

// Tiles Guide Modal & Zoom State
let tilesGuideZoom = 1;
let tilesGuidePanX = 0;
let tilesGuidePanY = 0;
let isPanningTilesGuide = false;
let tilesGuideStartX = 0;
let tilesGuideStartY = 0;

function updateTilesGuideTransform() {
  const img = document.getElementById('tiles-guide-img');
  const zoomLabel = document.getElementById('tiles-guide-zoom-level');
  if (img) {
    img.style.transform = `translate(${tilesGuidePanX}px, ${tilesGuidePanY}px) scale(${tilesGuideZoom})`;
  }
  if (zoomLabel) {
    zoomLabel.textContent = `${Math.round(tilesGuideZoom * 100)}%`;
  }
}

function resetTilesGuideView() {
  tilesGuideZoom = 1;
  tilesGuidePanX = 0;
  tilesGuidePanY = 0;
  updateTilesGuideTransform();
}

function openTilesGuideModal() {
  const modal = document.getElementById('tiles-guide-modal');
  if (modal) {
    modal.style.display = 'flex';
    resetTilesGuideView();
    if (window.audio) audio.playClick();
  }
}

function closeTilesGuideModal() {
  const modal = document.getElementById('tiles-guide-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function toggleTilesGuideModal() {
  const modal = document.getElementById('tiles-guide-modal');
  if (modal) {
    if (modal.style.display === 'flex') {
      closeTilesGuideModal();
    } else {
      openTilesGuideModal();
    }
  }
}

window.openTilesGuideModal = openTilesGuideModal;
window.closeTilesGuideModal = closeTilesGuideModal;
window.toggleTilesGuideModal = toggleTilesGuideModal;

// Laser Pointer Control
function toggleLaserPointer(forceState) {
  if (!boardRenderer) return;
  const newState = (forceState !== undefined) ? forceState : !boardRenderer.laserMode;
  boardRenderer.laserMode = newState;

  const canvas = document.getElementById('board-canvas');
  if (canvas) {
    canvas.classList.toggle('laser-mode-active', newState);
  }

  const toggleBtn = document.getElementById('laser-pointer-toggle-btn');
  const boardBtn = document.getElementById('board-laser-btn');
  const mobileBtn = document.getElementById('mobile-laser-btn');
  const mobileDropdownBtn = document.getElementById('mobile-laser-dropdown-btn');

  [toggleBtn, boardBtn, mobileBtn, mobileDropdownBtn].forEach(btn => {
    if (btn) {
      btn.classList.toggle('active', newState);
      if (btn === toggleBtn) {
        btn.innerText = newState ? '🔴 Láser: ON' : '🔴 Láser';
      }
      if (btn === mobileDropdownBtn) {
        btn.innerText = newState ? '🔴 Láser: ON' : '🔴 Puntero Láser';
      }
    }
  });

  if (newState) {
    const isMobile = window.innerWidth <= 1024;
    showToast(isMobile 
      ? '🔴 Modo Láser: Traza con 1 dedo para señalar (Usa 2 dedos para mover mapa)'
      : '🔴 Modo Láser: Mueve o arrastra el cursor para señalar (Acciones de loseta bloqueadas)', 
      'info'
    );
  } else {
    boardRenderer.removeLaser(myPlayerId);
    if (currentRoom) {
      socket.emit('laser_pointer_move', {
        roomId: currentRoom.id,
        playerId: myPlayerId,
        active: false
      });
    }
  }
}
window.toggleLaserPointer = toggleLaserPointer;

// Zoom & Map Controls
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const centerBoardBtn = document.getElementById('center-board-btn');

// Sandbox UI
const sandboxPanel = document.getElementById('sandbox-panel');
const sandboxToggleBtn = document.getElementById('sandbox-toggle-btn');
const autoRulesCheckbox = document.getElementById('sandbox-rules-toggle');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  playerNameInput.value = myPlayerName;
  
  const canvas = document.getElementById('board-canvas');
  boardRenderer = new BoardRenderer(canvas, {
    onSlotClick: (x, y, slot) => {},
    onTileClick: (x, y, tile) => onTileClicked(x, y, tile),
    onMeeplePointClick: (segmentId, pos) => onSelectMeepleSegment(segmentId, pos),
    onConfirmPendingTile: (x, y, rotation) => onConfirmTilePlacement(x, y, rotation),
    onCancelPlacement: () => cancelTilePlacement(),
    onPendingStateChange: (state) => updatePendingTileUI(state),
    onLaserMove: (worldX, worldY) => {
      const myColor = colorSelect?.value || window.profileManager?.profile?.color || 'yellow';
      const myName = getProfileName();
      boardRenderer.setLaser(myPlayerId, {
        playerName: myName,
        playerColor: myColor,
        worldX,
        worldY,
        active: true
      });
      if (currentRoom) {
        socket.emit('laser_pointer_move', {
          roomId: currentRoom.id,
          playerId: myPlayerId,
          playerName: myName,
          playerColor: myColor,
          worldX,
          worldY,
          active: true
        });
      }
    },
    onLaserLeave: () => {
      boardRenderer.removeLaser(myPlayerId);
      if (currentRoom) {
        socket.emit('laser_pointer_move', {
          roomId: currentRoom.id,
          playerId: myPlayerId,
          active: false
        });
      }
    }
  });

  initEventListeners();
  loadRooms();
  loadSaves();
});

// ==================== MEDIEVAL CUSTOM DIALOG SYSTEM (ZERO BROWSER IP ALERTS) ====================
let medievalDialogResolve = null;

function showMedievalConfirm({ title = '¿Confirmación?', message = '', icon = '🏰', confirmText = '✓ Confirmar', cancelText = '✖ Cancelar', confirmClass = 'btn-primary' } = {}) {
  return new Promise((resolve) => {
    medievalDialogResolve = resolve;
    const modal = document.getElementById('medieval-dialog-modal');
    const iconEl = document.getElementById('medieval-dialog-icon');
    const titleEl = document.getElementById('medieval-dialog-title');
    const msgEl = document.getElementById('medieval-dialog-message');
    const promptWrap = document.getElementById('medieval-dialog-prompt-wrap');
    const confirmBtn = document.getElementById('medieval-dialog-confirm-btn');
    const cancelBtn = document.getElementById('medieval-dialog-cancel-btn');

    if (iconEl) iconEl.innerText = icon;
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (promptWrap) promptWrap.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    if (confirmBtn) {
      confirmBtn.innerText = confirmText;
      confirmBtn.className = `btn ${confirmClass}`;
      confirmBtn.onclick = () => {
        if (modal) modal.style.display = 'none';
        if (medievalDialogResolve) {
          const cb = medievalDialogResolve;
          medievalDialogResolve = null;
          cb(true);
        }
      };
    }

    if (cancelBtn) {
      cancelBtn.innerText = cancelText;
      cancelBtn.onclick = () => {
        if (modal) modal.style.display = 'none';
        if (medievalDialogResolve) {
          const cb = medievalDialogResolve;
          medievalDialogResolve = null;
          cb(false);
        }
      };
    }

    if (modal) modal.style.display = 'flex';
  });
}
window.showMedievalConfirm = showMedievalConfirm;

function showMedievalPrompt({ title = 'Introduce un valor', message = '', defaultValue = '', placeholder = '', icon = '📜', confirmText = '✓ Guardar' } = {}) {
  return new Promise((resolve) => {
    medievalDialogResolve = resolve;
    const modal = document.getElementById('medieval-dialog-modal');
    const iconEl = document.getElementById('medieval-dialog-icon');
    const titleEl = document.getElementById('medieval-dialog-title');
    const msgEl = document.getElementById('medieval-dialog-message');
    const promptWrap = document.getElementById('medieval-dialog-prompt-wrap');
    const input = document.getElementById('medieval-dialog-input');
    const confirmBtn = document.getElementById('medieval-dialog-confirm-btn');
    const cancelBtn = document.getElementById('medieval-dialog-cancel-btn');

    if (iconEl) iconEl.innerText = icon;
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (promptWrap) promptWrap.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (input) {
      input.value = defaultValue;
      input.placeholder = placeholder;
      setTimeout(() => input.focus(), 50);
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          confirmBtn.click();
        }
      };
    }

    if (confirmBtn) {
      confirmBtn.innerText = confirmText;
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.onclick = () => {
        const val = input ? input.value.trim() : defaultValue;
        if (modal) modal.style.display = 'none';
        if (medievalDialogResolve) {
          const cb = medievalDialogResolve;
          medievalDialogResolve = null;
          cb(val);
        }
      };
    }

    if (cancelBtn) {
      cancelBtn.innerText = '✖ Cancelar';
      cancelBtn.onclick = () => {
        if (modal) modal.style.display = 'none';
        if (medievalDialogResolve) {
          const cb = medievalDialogResolve;
          medievalDialogResolve = null;
          cb(null);
        }
      };
    }

    if (modal) modal.style.display = 'flex';
  });
}
window.showMedievalPrompt = showMedievalPrompt;

function updateMobileContextualBar() {
  if (!mobileContextualBar) return;
  const isMobile = window.innerWidth <= 1024;
  if (!isMobile || !currentRoom || currentRoom.status !== 'playing') {
    mobileContextualBar.style.display = 'none';
    return;
  }

  const isMyTurn = isMyTurnNow(currentRoom);

  // 1. Pending Tile Placement Phase
  if (boardRenderer && boardRenderer.pendingPos && isMyTurn && currentRoom.turnPhase === 'place_tile') {
    mobileContextualBar.style.display = 'flex';
    if (contextualPendingActions) contextualPendingActions.style.display = 'flex';
    if (contextualMeepleActions) contextualMeepleActions.style.display = 'none';

    if (touchConfirmBtn) {
      touchConfirmBtn.disabled = !boardRenderer.isPendingValid;
      touchConfirmBtn.style.opacity = boardRenderer.isPendingValid ? '1' : '0.45';
      const textSpan = touchConfirmBtn.querySelector('.btn-touch-text');
      if (textSpan) textSpan.innerText = boardRenderer.isPendingValid ? 'Colocar' : 'Girar';
    }
    return;
  }

  // 2. Meeple Placement Phase
  if (currentRoom.turnPhase === 'place_meeple' && isMyTurn) {
    mobileContextualBar.style.display = 'flex';
    if (contextualPendingActions) contextualPendingActions.style.display = 'none';
    if (contextualMeepleActions) contextualMeepleActions.style.display = 'flex';
    return;
  }

  // Otherwise hide
  mobileContextualBar.style.display = 'none';
}

function updatePendingTileUI(state) {
  const confirmBtn = document.getElementById('confirm-tile-btn');
  const cancelBtn = document.getElementById('cancel-pending-btn');
  const rotateBtn = document.getElementById('rotate-tile-btn');

  if (state && state.pendingPos) {
    if (confirmBtn) {
      confirmBtn.style.display = 'block';
      confirmBtn.disabled = !state.isValid;
      confirmBtn.innerHTML = state.isValid ? '✓ Colocar Loseta' : '🚫 Giro No Válido';
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (rotateBtn) rotateBtn.innerHTML = '🔄 Rotar (R)';

    // Show floating confirm on right side for mobile/tablet
    if (boardRightConfirm) {
      const isMobile = window.innerWidth <= 1024 || ('ontouchstart' in window);
      boardRightConfirm.style.display = (isMobile && state.isValid) ? 'flex' : 'none';
    }
  } else {
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (rotateBtn) rotateBtn.innerHTML = '🔄 Rotar (R / Q)';

    // Hide floating confirm
    if (boardRightConfirm) boardRightConfirm.style.display = 'none';
  }
  updateMobileContextualBar();
}

function initEventListeners() {
  playerNameInput.addEventListener('change', (e) => {
    myPlayerName = e.target.value.trim() || 'Jugador';
    localStorage.setItem('carcassonne_player_name', myPlayerName);
  });

  document.getElementById('create-room-btn').addEventListener('click', createRoom);
  document.getElementById('refresh-rooms-btn').addEventListener('click', loadRooms);
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('leave-room-btn').addEventListener('click', leaveRoom);
  
  // Center & Zoom Buttons
  if (centerBoardBtn) centerBoardBtn.addEventListener('click', () => boardRenderer.centerView());
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => boardRenderer.zoomBy(1.2));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => boardRenderer.zoomBy(0.8));

  // Mobile Drawers & Backdrop Management
  function closeAllMobileDrawers() {
    if (sidePanel) sidePanel.classList.remove('open');
    if (chatDrawer && window.innerWidth <= 1024) chatDrawer.classList.remove('open');
    if (drawerBackdrop) drawerBackdrop.classList.remove('active');
    if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
  }
  window.closeAllMobileDrawers = closeAllMobileDrawers;

  function toggleSidePanel() {
    audio.playClick();
    const isOpen = sidePanel.classList.toggle('open');
    if (chatDrawer && window.innerWidth <= 1024) chatDrawer.classList.remove('open');
    if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
    if (drawerBackdrop) drawerBackdrop.classList.toggle('active', isOpen);
  }

  function toggleChatDrawer() {
    audio.playClick();
    if (window.innerWidth <= 1024) {
      const isOpen = chatDrawer.classList.toggle('open');
      if (sidePanel) sidePanel.classList.remove('open');
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      if (drawerBackdrop) drawerBackdrop.classList.toggle('active', isOpen);
    } else {
      toggleDesktopChat();
    }
  }

  if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', toggleSidePanel);
  if (mobileMiniHud) mobileMiniHud.addEventListener('click', toggleSidePanel);
  if (closeSidePanelBtn) closeSidePanelBtn.addEventListener('click', closeAllMobileDrawers);

  if (mobileChatToggle) mobileChatToggle.addEventListener('click', toggleChatDrawer);
  if (closeChatDrawerBtn) {
    closeChatDrawerBtn.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        closeAllMobileDrawers();
      } else {
        toggleDesktopChat();
      }
    });
  }

  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeAllMobileDrawers);
  }

  // Mobile More Options Dropdown
  if (mobileMoreBtn && mobileMoreDropdown) {
    mobileMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.playClick();
      const isVisible = mobileMoreDropdown.style.display === 'flex';
      mobileMoreDropdown.style.display = isVisible ? 'none' : 'flex';
    });

    document.addEventListener('click', (e) => {
      if (mobileMoreDropdown.style.display === 'flex' && !mobileMoreDropdown.contains(e.target) && e.target !== mobileMoreBtn) {
        mobileMoreDropdown.style.display = 'none';
      }
    });
  }

  if (mobileTileEditorBtn) {
    mobileTileEditorBtn.addEventListener('click', () => {
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      const tileEditorBtn = document.getElementById('tile-editor-btn');
      if (tileEditorBtn) tileEditorBtn.click();
    });
  }

  if (mobileShortcutsBtn) {
    mobileShortcutsBtn.addEventListener('click', () => {
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      if (shortcutsModal) shortcutsModal.style.display = 'flex';
    });
  }

  if (mobileSandboxBtn) {
    mobileSandboxBtn.addEventListener('click', () => {
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      const sandboxBtn = document.getElementById('sandbox-toggle-btn');
      if (sandboxBtn) sandboxBtn.click();
    });
  }

  if (mobileSaveBtn) {
    mobileSaveBtn.addEventListener('click', () => {
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      promptSaveGame();
    });
  }

  if (mobileLeaveBtn) {
    mobileLeaveBtn.addEventListener('click', () => {
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      leaveRoom();
    });
  }

  const surrenderBtn = document.getElementById('surrender-btn');
  const mobileSurrenderBtn = document.getElementById('mobile-surrender-btn');
  if (surrenderBtn) surrenderBtn.addEventListener('click', handleSurrender);
  if (mobileSurrenderBtn) {
    mobileSurrenderBtn.addEventListener('click', () => {
      if (mobileMoreDropdown) mobileMoreDropdown.style.display = 'none';
      handleSurrender();
    });
  }

  // Global Lobby Chat Listeners
  const sendLobbyChatBtn = document.getElementById('send-lobby-chat-btn');
  const lobbyChatInput = document.getElementById('lobby-chat-input');
  if (sendLobbyChatBtn) sendLobbyChatBtn.addEventListener('click', sendLobbyChat);
  if (lobbyChatInput) {
    lobbyChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendLobbyChat();
    });
  }

  // Desktop Chat Toggle
  const desktopChatToggle = document.getElementById('desktop-chat-toggle');
  const isChatCollapsed = localStorage.getItem('carcassonne_chat_collapsed') === '1';
  if (isChatCollapsed && window.innerWidth > 1024) {
    chatDrawer.classList.add('collapsed');
    if (desktopChatToggle) desktopChatToggle.classList.remove('active');
  } else if (desktopChatToggle) {
    desktopChatToggle.classList.add('active');
  }

  function toggleDesktopChat() {
    audio.playClick();
    chatDrawer.classList.toggle('collapsed');
    const isNowCollapsed = chatDrawer.classList.contains('collapsed');
    localStorage.setItem('carcassonne_chat_collapsed', isNowCollapsed ? '1' : '0');
    if (desktopChatToggle) desktopChatToggle.classList.toggle('active', !isNowCollapsed);
    requestAnimationFrame(() => {
      boardRenderer.resize();
    });
  }

  if (desktopChatToggle) {
    desktopChatToggle.addEventListener('click', toggleDesktopChat);
  }

  // Floating Mobile Rotate Button
  if (mobileRotateBtn) {
    mobileRotateBtn.addEventListener('click', () => {
      if (boardRenderer.pendingPos) {
        boardRenderer.rotatePendingTile(1);
      } else {
        audio.playTileRotate();
        socket.emit('rotate_tile', { direction: 1 });
      }
    });
  }

  // Mobile First Floating Active Tile HUD (Tap to rotate 90°)
  const mobileFloatingTileHud = document.getElementById('mobile-floating-tile-hud');
  if (mobileFloatingTileHud) {
    mobileFloatingTileHud.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!currentRoom || currentRoom.status !== 'playing') return;
      if (boardRenderer && boardRenderer.pendingPos) {
        boardRenderer.rotatePendingTile(1);
        const fImg = document.getElementById('floating-tile-img');
        if (fImg) fImg.style.transform = `rotate(${boardRenderer.pendingRotation}deg)`;
      } else if (isMyTurnNow(currentRoom) && currentRoom.turnPhase === 'place_tile') {
        audio.playTileRotate();
        socket.emit('rotate_tile', { direction: 1 });
      }
    });
  }

  // Contextual Touch Controls
  if (touchRotLeftBtn) {
    touchRotLeftBtn.addEventListener('click', () => boardRenderer.rotatePendingTile(-1));
  }
  if (touchRotRightBtn) {
    touchRotRightBtn.addEventListener('click', () => boardRenderer.rotatePendingTile(1));
  }
  if (touchConfirmBtn) {
    touchConfirmBtn.addEventListener('click', () => {
      if (boardRenderer.pendingPos && boardRenderer.isPendingValid) {
        onConfirmTilePlacement(boardRenderer.pendingPos.x, boardRenderer.pendingPos.y, boardRenderer.pendingRotation);
      }
    });
  }
  if (touchCancelPendingBtn) {
    touchCancelPendingBtn.addEventListener('click', () => boardRenderer.clearPendingTile());
  }
  if (touchPassMeepleBtn) {
    touchPassMeepleBtn.addEventListener('click', () => {
      if (!currentRoom || currentRoom.turnPhase !== 'place_meeple') return;
      audio.playClick();
      socket.emit('pass_meeple');
    });
  }
  const touchConfirmTurnBtn = document.getElementById('touch-confirm-turn-btn');
  if (touchConfirmTurnBtn) {
    touchConfirmTurnBtn.addEventListener('click', () => confirmFinalTurn());
  }
  if (floatingPassCircleBtn) {
    floatingPassCircleBtn.addEventListener('click', () => {
      if (!currentRoom || currentRoom.turnPhase !== 'place_meeple') return;
      audio.playClick();
      socket.emit('pass_meeple');
    });
  }
  const floatingConfirmTurnBtn = document.getElementById('floating-confirm-turn-btn');
  if (floatingConfirmTurnBtn) {
    floatingConfirmTurnBtn.addEventListener('click', () => confirmFinalTurn());
  }
  if (floatingUndoBtn) {
    floatingUndoBtn.addEventListener('click', () => {
      if (!currentRoom) return;
      if (currentRoom.turnPhase === 'confirm_turn') {
        removeMeeple();
      } else if (currentRoom.turnPhase === 'place_meeple') {
        cancelTilePlacement();
      }
    });
  }
  if (floatingConfirmBtn) {
    floatingConfirmBtn.addEventListener('click', () => {
      if (boardRenderer.pendingPos && boardRenderer.isPendingValid && currentRoom && currentRoom.turnPhase === 'place_tile') {
        onConfirmTilePlacement(boardRenderer.pendingPos.x, boardRenderer.pendingPos.y, boardRenderer.pendingRotation);
      }
    });
  }
  if (touchCancelTileBtn) {
    touchCancelTileBtn.addEventListener('click', () => {
      if (!currentRoom) return;
      if (currentRoom.turnPhase === 'confirm_turn') {
        removeMeeple();
      } else {
        cancelTilePlacement();
      }
    });
  }

  const confirmTileBtn = document.getElementById('confirm-tile-btn');
  if (confirmTileBtn) {
    confirmTileBtn.addEventListener('click', () => {
      if (boardRenderer.pendingPos && boardRenderer.isPendingValid && currentRoom && currentRoom.turnPhase === 'place_tile') {
        onConfirmTilePlacement(boardRenderer.pendingPos.x, boardRenderer.pendingPos.y, boardRenderer.pendingRotation);
      }
    });
  }

  const rotateTileBtn = document.getElementById('rotate-tile-btn');
  if (rotateTileBtn) {
    rotateTileBtn.addEventListener('click', () => {
      if (boardRenderer.pendingPos) {
        boardRenderer.rotatePendingTile(1);
      } else {
        audio.playTileRotate();
        socket.emit('rotate_tile', { direction: 1 });
      }
    });
  }

  const cancelPendingBtn = document.getElementById('cancel-pending-btn');
  if (cancelPendingBtn) {
    cancelPendingBtn.addEventListener('click', () => {
      boardRenderer.clearPendingTile();
    });
  }

  // Shortcuts Modal
  if (shortcutsToggleBtn) shortcutsToggleBtn.addEventListener('click', () => shortcutsModal.style.display = 'flex');
  if (closeShortcutsBtn) closeShortcutsBtn.addEventListener('click', () => shortcutsModal.style.display = 'none');
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) shortcutsModal.style.display = 'none';
  });

  // Tiles Guide Modal & Controls
  const tilesGuideModal = document.getElementById('tiles-guide-modal');
  const tilesGuideToggleBtn = document.getElementById('tiles-guide-toggle-btn');
  const mobileTilesGuideBtn = document.getElementById('mobile-tiles-guide-btn');
  const mobileTilesGuideDropdownBtn = document.getElementById('mobile-tiles-guide-dropdown-btn');
  const lobbyTilesGuideBtn = document.getElementById('lobby-tiles-guide-btn');
  const closeTilesGuideBtn = document.getElementById('close-tiles-guide-btn');
  const tilesGuideZoomIn = document.getElementById('tiles-guide-zoom-in');
  const tilesGuideZoomOut = document.getElementById('tiles-guide-zoom-out');
  const tilesGuideZoomReset = document.getElementById('tiles-guide-zoom-reset');
  const tilesGuideContainer = document.getElementById('tiles-guide-img-container');

  if (tilesGuideToggleBtn) tilesGuideToggleBtn.addEventListener('click', toggleTilesGuideModal);
  if (mobileTilesGuideBtn) mobileTilesGuideBtn.addEventListener('click', toggleTilesGuideModal);
  if (mobileTilesGuideDropdownBtn) mobileTilesGuideDropdownBtn.addEventListener('click', () => {
    const dropdown = document.getElementById('mobile-more-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    openTilesGuideModal();
  });
  if (lobbyTilesGuideBtn) lobbyTilesGuideBtn.addEventListener('click', openTilesGuideModal);
  if (closeTilesGuideBtn) closeTilesGuideBtn.addEventListener('click', closeTilesGuideModal);
  if (tilesGuideModal) {
    tilesGuideModal.addEventListener('click', (e) => {
      if (e.target === tilesGuideModal) closeTilesGuideModal();
    });
  }

  if (tilesGuideZoomIn) {
    tilesGuideZoomIn.addEventListener('click', () => {
      tilesGuideZoom = Math.min(3.5, tilesGuideZoom + 0.25);
      updateTilesGuideTransform();
    });
  }
  if (tilesGuideZoomOut) {
    tilesGuideZoomOut.addEventListener('click', () => {
      tilesGuideZoom = Math.max(0.6, tilesGuideZoom - 0.25);
      updateTilesGuideTransform();
    });
  }
  if (tilesGuideZoomReset) {
    tilesGuideZoomReset.addEventListener('click', resetTilesGuideView);
  }

  if (tilesGuideContainer) {
    tilesGuideContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      tilesGuideZoom = Math.max(0.6, Math.min(3.5, tilesGuideZoom + delta));
      updateTilesGuideTransform();
    }, { passive: false });

    tilesGuideContainer.addEventListener('mousedown', (e) => {
      isPanningTilesGuide = true;
      tilesGuideStartX = e.clientX - tilesGuidePanX;
      tilesGuideStartY = e.clientY - tilesGuidePanY;
      tilesGuideContainer.classList.add('grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanningTilesGuide) return;
      tilesGuidePanX = e.clientX - tilesGuideStartX;
      tilesGuidePanY = e.clientY - tilesGuideStartY;
      updateTilesGuideTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isPanningTilesGuide) {
        isPanningTilesGuide = false;
        if (tilesGuideContainer) tilesGuideContainer.classList.remove('grabbing');
      }
    });

    // Touch events for mobile/tablets
    let initialTouchDist = null;
    tilesGuideContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isPanningTilesGuide = true;
        tilesGuideStartX = e.touches[0].clientX - tilesGuidePanX;
        tilesGuideStartY = e.touches[0].clientY - tilesGuidePanY;
      } else if (e.touches.length === 2) {
        isPanningTilesGuide = false;
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    tilesGuideContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isPanningTilesGuide) {
        tilesGuidePanX = e.touches[0].clientX - tilesGuideStartX;
        tilesGuidePanY = e.touches[0].clientY - tilesGuideStartY;
        updateTilesGuideTransform();
      } else if (e.touches.length === 2 && initialTouchDist) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / initialTouchDist;
        tilesGuideZoom = Math.max(0.6, Math.min(3.5, tilesGuideZoom * factor));
        initialTouchDist = dist;
        updateTilesGuideTransform();
      }
    }, { passive: true });

    tilesGuideContainer.addEventListener('touchend', () => {
      isPanningTilesGuide = false;
      initialTouchDist = null;
    });
  }

  document.getElementById('save-game-btn').addEventListener('click', promptSaveGame);
  window.addEventListener('focus', stopTitleFlashing);

  // War Room Pre-Game Briefing Event Listeners
  const warRoomReadyBtn = document.getElementById('war-room-ready-btn');
  const warRoomDeleteBtn = document.getElementById('war-room-delete-btn');
  const warRoomSoundSelect = document.getElementById('war-room-sound-select');
  const warRoomTestSoundBtn = document.getElementById('war-room-test-sound-btn');

  if (warRoomStartBtn) warRoomStartBtn.addEventListener('click', startGame);
  if (warRoomLeaveBtn) warRoomLeaveBtn.addEventListener('click', leaveRoom);
  if (warRoomAddBotBtn) {
    warRoomAddBotBtn.addEventListener('click', () => {
      audio.playClick();
      if (addBotModal) addBotModal.style.display = 'flex';
    });
  }
  if (warRoomReadyBtn) {
    warRoomReadyBtn.addEventListener('click', () => {
      audio.playClick();
      socket.emit('toggle_ready');
    });
  }
  if (warRoomDeleteBtn) {
    warRoomDeleteBtn.addEventListener('click', async () => {
      const ok = await showMedievalConfirm({
        title: '¿Eliminar Sala de Batalla?',
        message: '¿Estás seguro de que deseas eliminar esta sala? Todos los comandantes serán devueltos a la taberna.',
        icon: '🗑️',
        confirmText: '🗑️ Eliminar Sala',
        confirmClass: 'btn-danger'
      });
      if (ok) {
        audio.playClick();
        const myProfileName = window.profileManager ? window.profileManager.getName() : (playerNameInput ? playerNameInput.value.trim() : null);
        socket.emit('delete_room', { playerName: myProfileName });
      }
    });
  }
  if (warRoomSoundSelect) {
    warRoomSoundSelect.value = audio.getTurnSound();
    warRoomSoundSelect.addEventListener('change', (e) => {
      audio.setTurnSound(e.target.value);
      audio.playTurnSound(e.target.value);
      if (currentRoom && currentRoom.status === 'lobby') {
        socket.emit('change_turn_sound', { newSound: e.target.value });
      }
    });
  }
  if (warRoomTestSoundBtn) {
    warRoomTestSoundBtn.addEventListener('click', () => {
      const selected = warRoomSoundSelect ? warRoomSoundSelect.value : audio.getTurnSound();
      audio.playTurnSound(selected);
    });
  }
  if (warRoomColorSelect) {
    warRoomColorSelect.addEventListener('change', (e) => {
      audio.playClick();
      socket.emit('change_color', { newColor: e.target.value });
    });
  }
  if (warRoomSendChatBtn) {
    warRoomSendChatBtn.addEventListener('click', sendWarRoomChat);
  }
  if (warRoomChatInput) {
    warRoomChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendWarRoomChat();
    });
  }

  // Lobby Tabs Navigation (Online vs Local vs Replays vs Leaderboard vs Bot Training)
  const tabBtnOnline = document.getElementById('tab-btn-online');
  const tabBtnLocal = document.getElementById('tab-btn-local');
  const tabBtnReplays = document.getElementById('tab-btn-replays');
  const tabBtnLeaderboard = document.getElementById('tab-btn-leaderboard');
  const tabBtnBotTraining = document.getElementById('tab-btn-bot-training');
  const lobbyOnlineContent = document.getElementById('lobby-online-content');
  const lobbyLocalContent = document.getElementById('lobby-local-content');
  const lobbyReplaysContent = document.getElementById('lobby-replays-content');
  const lobbyLeaderboardContent = document.getElementById('lobby-leaderboard-content');
  const lobbyBotTrainingContent = document.getElementById('lobby-bot-training-content');

  function switchLobbyTab(tab) {
    [tabBtnOnline, tabBtnLocal, tabBtnReplays, tabBtnLeaderboard, tabBtnBotTraining].forEach(btn => btn && btn.classList.remove('active'));
    [lobbyOnlineContent, lobbyLocalContent, lobbyReplaysContent, lobbyLeaderboardContent, lobbyBotTrainingContent].forEach(pane => pane && (pane.style.display = 'none'));

    if (tab === 'online' && tabBtnOnline && lobbyOnlineContent) {
      tabBtnOnline.classList.add('active');
      lobbyOnlineContent.style.display = 'block';
    } else if (tab === 'local' && tabBtnLocal && lobbyLocalContent) {
      tabBtnLocal.classList.add('active');
      lobbyLocalContent.style.display = 'block';
      renderLocalPlayersBuilder();
    } else if (tab === 'replays' && tabBtnReplays && lobbyReplaysContent) {
      tabBtnReplays.classList.add('active');
      lobbyReplaysContent.style.display = 'block';
      loadReplays();
    } else if (tab === 'leaderboard' && tabBtnLeaderboard && lobbyLeaderboardContent) {
      tabBtnLeaderboard.classList.add('active');
      lobbyLeaderboardContent.style.display = 'block';
      loadLeaderboard();
    } else if (tab === 'bot-training' && tabBtnBotTraining && lobbyBotTrainingContent) {
      tabBtnBotTraining.classList.add('active');
      lobbyBotTrainingContent.style.display = 'block';
      loadBotWeights();
    }
  }

  if (tabBtnOnline) tabBtnOnline.addEventListener('click', () => switchLobbyTab('online'));
  if (tabBtnLocal) tabBtnLocal.addEventListener('click', () => switchLobbyTab('local'));
  if (tabBtnReplays) tabBtnReplays.addEventListener('click', () => switchLobbyTab('replays'));
  if (tabBtnLeaderboard) tabBtnLeaderboard.addEventListener('click', () => switchLobbyTab('leaderboard'));
  if (tabBtnBotTraining) tabBtnBotTraining.addEventListener('click', () => switchLobbyTab('bot-training'));
  const refreshReplaysBtn = document.getElementById('refresh-replays-btn');
  if (refreshReplaysBtn) refreshReplaysBtn.addEventListener('click', () => loadReplays());
  const refreshLeaderboardBtn = document.getElementById('refresh-leaderboard-btn');
  if (refreshLeaderboardBtn) refreshLeaderboardBtn.addEventListener('click', () => loadLeaderboard());

  // ==================== BOT TRAINING PANEL ====================
  function addTrainingLog(msg, type = 'info') {
    const log = document.getElementById('bot-training-log');
    if (!log) return;
    log.style.display = 'block';
    const colors = { info: 'var(--secondary)', success: '#82e0aa', error: '#f1948a', warn: 'var(--primary)' };
    const line = document.createElement('div');
    line.style.color = colors[type] || colors.info;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${time}] ${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  async function loadBotWeights() {
    try {
      const res = await fetch('/api/bot/weights');
      const data = await res.json();
      if (!data.success) return;
      const grid = document.getElementById('bot-weights-grid');
      const sessions = document.getElementById('bot-training-sessions');
      if (sessions) {
        sessions.textContent = `Sesiones de entrenamiento: ${data.trainingSessions || 0}` +
          (data.lastTrainedAt ? ` • Último: ${new Date(data.lastTrainedAt).toLocaleDateString()}` : '') +
          (data.lastTrainingMethod ? ` (${data.lastTrainingMethod.replace(/_/g, ' ')})` : '');
      }
      if (grid && data.weights) {
        const weightLabels = {
          cityValue: '🏰 Ciudad', roadValue: '🛣️ Camino', monasteryValue: '⛪ Monasterio',
          fieldValue: '🌾 Campo', fieldLateGameValue: '🌾 Campo Final', completionBonus: '✅ Completar',
          completionMeepleRecoveryBonus: '⬆️ Recuperar Meeple', monasteryNeighborBonus: '📍 Vecino Monasterio',
          blockingPenalty: '🚫 Bloqueo', centerBoardBonus: '🎯 Centro'
        };
        grid.innerHTML = Object.entries(data.weights)
          .filter(([k]) => weightLabels[k])
          .map(([k, v]) => `
            <div style="background:var(--surface-container-highest); border:1px solid var(--border-iron); border-radius:4px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--on-surface-variant);">${weightLabels[k] || k}</span>
              <strong style="color:var(--primary); font-size:1rem;">${typeof v === 'number' ? v.toFixed(1) : v}</strong>
            </div>`)
          .join('');
      }
    } catch (e) {
      addTrainingLog('Error cargando pesos: ' + e.message, 'error');
    }
  }

  // Training Method 1: Imitation Learning
  const btnTrainReplays = document.getElementById('btn-train-replays');
  if (btnTrainReplays) {
    btnTrainReplays.addEventListener('click', async () => {
      btnTrainReplays.disabled = true;
      btnTrainReplays.textContent = '⏳ Analizando replays...';
      const resultDiv = document.getElementById('train-replays-result');
      addTrainingLog('Iniciando aprendizaje por imitación...', 'info');
      try {
        const res = await fetch('/api/bot/train-replays', { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
          addTrainingLog('❌ ' + data.error, 'error');
          if (resultDiv) { resultDiv.style.display = 'block'; resultDiv.style.color = '#f1948a'; resultDiv.textContent = '❌ ' + data.error; }
        } else {
          const changes = Object.keys(data.weightChanges || {}).length;
          addTrainingLog(`✅ Aprendizaje completado. ${data.replaysAnalyzed} replays analizados. ${changes} pesos actualizados.`, 'success');
          if (data.patterns) {
            addTrainingLog(`📊 Tasa de victoria del bot: ${data.patterns.botWinRate}`, 'warn');
          }
          if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#82e0aa';
            resultDiv.textContent = `✅ ${data.replaysAnalyzed} replays analizados • ${changes} pesos actualizados`;
          }
          loadBotWeights();
        }
      } catch (e) {
        addTrainingLog('❌ Error: ' + e.message, 'error');
      } finally {
        btnTrainReplays.disabled = false;
        btnTrainReplays.textContent = '📚 Entrenar desde Replays';
      }
    });
  }

  // Training Method 2: Gemini Optimization
  const btnTrainGemini = document.getElementById('btn-train-gemini');
  if (btnTrainGemini) {
    btnTrainGemini.addEventListener('click', async () => {
      btnTrainGemini.disabled = true;
      btnTrainGemini.textContent = '⏳ Consultando al Sabio...';
      const resultDiv = document.getElementById('train-gemini-result');
      addTrainingLog('Consultando a Gemini para optimización de pesos...', 'info');
      try {
        const res = await fetch('/api/bot/train-gemini', { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
          addTrainingLog('❌ ' + data.error, 'error');
          if (resultDiv) { resultDiv.style.display = 'block'; resultDiv.style.color = '#f1948a'; resultDiv.textContent = '❌ ' + data.error; }
        } else {
          addTrainingLog(`🧙‍♂️ Gemini dice: "${data.reasoning || 'Optimización aplicada'}"`, 'warn');
          addTrainingLog(`✅ ${Object.keys(data.weightChanges || {}).length} pesos optimizados por IA.`, 'success');
          if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#85c1e9';
            resultDiv.textContent = `🧙‍♂️ "${data.reasoning || 'Optimización aplicada'}"`;
          }
          loadBotWeights();
        }
      } catch (e) {
        addTrainingLog('❌ Error: ' + e.message, 'error');
      } finally {
        btnTrainGemini.disabled = false;
        btnTrainGemini.textContent = '🧙‍♂️ Optimizar con IA Gemini';
      }
    });
  }

  // Training Method 3: Self-Play
  const btnTrainSelfplay = document.getElementById('btn-train-selfplay');
  let selfPlayPollInterval = null;
  if (btnTrainSelfplay) {
    btnTrainSelfplay.addEventListener('click', async () => {
      const games = parseInt(document.getElementById('selfplay-games-input')?.value || '150');
      const iterations = parseInt(document.getElementById('selfplay-iters-input')?.value || '4');
      btnTrainSelfplay.disabled = true;
      btnTrainSelfplay.textContent = '⏳ Iniciando...';
      const resultDiv = document.getElementById('train-selfplay-result');
      const progressDiv = document.getElementById('selfplay-progress');
      const progressBar = document.getElementById('selfplay-progress-bar');
      const progressText = document.getElementById('selfplay-progress-text');
      addTrainingLog(`Iniciando Self-Play: ${games} partidas × ${iterations} iteraciones...`, 'info');
      try {
        const res = await fetch('/api/bot/train-selfplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ games, iterations })
        });
        const data = await res.json();
        if (!data.success) {
          addTrainingLog('❌ ' + data.error, 'error');
          if (resultDiv) { resultDiv.style.display = 'block'; resultDiv.style.color = '#f1948a'; resultDiv.textContent = '❌ ' + data.error; }
          btnTrainSelfplay.disabled = false;
          btnTrainSelfplay.textContent = '⚔️ Iniciar Self-Play';
          return;
        }
        if (progressDiv) progressDiv.style.display = 'block';
        if (resultDiv) { resultDiv.style.display = 'block'; resultDiv.style.color = '#f1948a'; resultDiv.textContent = '⏳ Entrenando en background...'; }
        // Poll progress
        let itersDone = 0;
        if (selfPlayPollInterval) clearInterval(selfPlayPollInterval);
        selfPlayPollInterval = setInterval(async () => {
          try {
            const progRes = await fetch('/api/bot/train-selfplay/progress');
            const progData = await progRes.json();
            const newIters = progData.progress.filter(p => !p.done);
            if (newIters.length > itersDone) {
              const latest = newIters[newIters.length - 1];
              itersDone = newIters.length;
              const pct = Math.round((itersDone / iterations) * 100);
              if (progressBar) progressBar.style.width = pct + '%';
              if (progressText) progressText.textContent = `Iteración ${latest.iteration}/${iterations} • Retador: ${latest.winRate} • ${latest.avgPointsChallenger} vs ${latest.avgPointsChampion} pts`;
              const promoText = latest.promoted ? ' 👑 [¡Mejora promovida a nuevo Campeón!]' : '';
              addTrainingLog(`⚔️ Iter ${latest.iteration}/${iterations}: Retador ${latest.winRate} vs Campeón (${latest.avgPointsChallenger} vs ${latest.avgPointsChampion} pts)${promoText}`, latest.promoted ? 'warn' : 'info');
            }
            const doneEntry = progData.progress.find(p => p.done);
            if (doneEntry || !progData.running) {
              clearInterval(selfPlayPollInterval);
              selfPlayPollInterval = null;
              if (progressBar) progressBar.style.width = '100%';
              if (progressText) progressText.textContent = '✅ Torneo Completado';
              const bestRate = doneEntry?.summary?.bestWinRate ? doneEntry.summary.bestWinRate + '%' : '100%';
              const promos = doneEntry?.summary?.promotions || 0;
              if (resultDiv) {
                resultDiv.style.color = '#82e0aa';
                resultDiv.textContent = `✅ Torneo completado • ${promos} mutaciones ganadoras adoptadas`;
              }
              addTrainingLog(`✅ Torneo evolutivo finalizado con éxito (${promos} promociones de genoma).`, 'success');
              loadBotWeights();
              btnTrainSelfplay.disabled = false;
              btnTrainSelfplay.textContent = '⚔️ Iniciar Self-Play';
            }
          } catch (_) {}
        }, 3000);
      } catch (e) {
        addTrainingLog('❌ Error: ' + e.message, 'error');
        btnTrainSelfplay.disabled = false;
        btnTrainSelfplay.textContent = '⚔️ Iniciar Self-Play';
      }
    });
  }

  const refreshBotWeightsBtn = document.getElementById('refresh-bot-weights-btn');
  if (refreshBotWeightsBtn) refreshBotWeightsBtn.addEventListener('click', loadBotWeights);
  // ==================== END BOT TRAINING PANEL ====================



  // Local Players Builder
  const addLocalHumanBtn = document.getElementById('add-local-human-btn');
  const addLocalBotBtn = document.getElementById('add-local-bot-btn');
  const startLocalGameBtn = document.getElementById('start-local-game-btn');

  if (addLocalHumanBtn) {
    addLocalHumanBtn.addEventListener('click', () => {
      if (localPlayersConfig.length >= 6) return showToast('Máximo 6 jugadores', 'warning');
      const freeColor = getFirstFreeLocalColor();
      const freeSound = getFirstFreeLocalSound();
      localPlayersConfig.push({
        name: `Jugador ${localPlayersConfig.length + 1}`,
        isBot: false,
        color: freeColor,
        sound: freeSound
      });
      renderLocalPlayersBuilder();
    });
  }

  if (addLocalBotBtn) {
    addLocalBotBtn.addEventListener('click', () => {
      if (localPlayersConfig.length >= 6) return showToast('Máximo 6 jugadores', 'warning');
      const freeColor = getFirstFreeLocalColor();
      const freeSound = getFirstFreeLocalSound();
      localPlayersConfig.push({
        name: `🤖 Bot ${localPlayersConfig.filter(p => p.isBot).length + 1}`,
        isBot: true,
        difficulty: 'medium',
        color: freeColor,
        sound: freeSound
      });
      renderLocalPlayersBuilder();
    });
  }

  if (startLocalGameBtn) {
    startLocalGameBtn.addEventListener('click', startLocalGame);
  }

  // Color change in Lobby
  colorSelect.addEventListener('change', (e) => {
    const newColor = e.target.value;
    if (currentRoom && currentRoom.status === 'lobby') {
      socket.emit('change_color', { newColor });
    }
  });

  // Add Bot Modal
  const addBotModal = document.getElementById('add-bot-modal');
  const closeAddBotBtn = document.getElementById('close-add-bot-btn');
  const confirmAddBotBtn = document.getElementById('confirm-add-bot-btn');
  const botDifficultySelect = document.getElementById('bot-difficulty-select');

  if (addBotBtn) {
    addBotBtn.addEventListener('click', () => {
      audio.playClick();
      if (addBotModal) addBotModal.style.display = 'flex';
      else socket.emit('add_bot', { difficulty: 'medium' });
    });
  }
  if (closeAddBotBtn) closeAddBotBtn.addEventListener('click', () => addBotModal.style.display = 'none');
  if (confirmAddBotBtn) {
    confirmAddBotBtn.addEventListener('click', () => {
      audio.playClick();
      const difficulty = botDifficultySelect ? botDifficultySelect.value : 'medium';
      socket.emit('add_bot', { difficulty });
      if (addBotModal) addBotModal.style.display = 'none';
    });
  }

  // Victory Modal Actions
  const victoryModal = document.getElementById('victory-modal');
  const closeVictoryBtn = document.getElementById('close-victory-btn');
  const rematchBtn = document.getElementById('rematch-btn');
  const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

  if (closeVictoryBtn) {
    closeVictoryBtn.addEventListener('click', () => {
      victoryModal.style.display = 'none';
      if (victoryModal) victoryModal.dataset.manuallyClosed = currentRoom?.id || 'true';
    });
  }

  if (rematchBtn) {
    rematchBtn.addEventListener('click', () => {
      if (victoryModal) {
        victoryModal.style.display = 'none';
        delete victoryModal.dataset.shownForRoom;
        delete victoryModal.dataset.manuallyClosed;
      }
      if (currentRoom && currentRoom.isLocal) {
        startLocalGame();
      } else if (currentRoom) {
        audio.playClick();
        showToast('Solicitud de revancha enviada a los contrincantes...', 'info');
        socket.emit('request_rematch', {
          roomId: currentRoom.id,
          playerId: myPlayerId,
          playerName: getProfileName()
        });
      }
    });
  }

  // Rematch Invitation Popup Buttons
  const acceptRematchBtn = document.getElementById('accept-rematch-btn');
  const declineRematchBtn = document.getElementById('decline-rematch-btn');
  if (acceptRematchBtn) {
    acceptRematchBtn.addEventListener('click', () => {
      audio.playClick();
      const modal = document.getElementById('rematch-request-modal');
      if (modal) modal.style.display = 'none';
      if (currentRoom) {
        socket.emit('accept_rematch', {
          roomId: currentRoom.id,
          playerId: myPlayerId,
          playerName: getProfileName()
        });
      }
    });
  }
  if (declineRematchBtn) {
    declineRematchBtn.addEventListener('click', () => {
      audio.playClick();
      const modal = document.getElementById('rematch-request-modal');
      if (modal) modal.style.display = 'none';
      if (currentRoom) {
        socket.emit('decline_rematch', {
          roomId: currentRoom.id,
          playerId: myPlayerId,
          playerName: getProfileName()
        });
      }
    });
  }

  // Laser Pointer Toggle Buttons (Desktop, Board Overlay & Mobile)
  const laserPointerToggleBtn = document.getElementById('laser-pointer-toggle-btn');
  const boardLaserBtn = document.getElementById('board-laser-btn');
  const mobileLaserBtn = document.getElementById('mobile-laser-btn');
  const mobileLaserDropdownBtn = document.getElementById('mobile-laser-dropdown-btn');

  if (laserPointerToggleBtn) laserPointerToggleBtn.addEventListener('click', () => toggleLaserPointer());
  if (boardLaserBtn) boardLaserBtn.addEventListener('click', () => toggleLaserPointer());
  if (mobileLaserBtn) mobileLaserBtn.addEventListener('click', () => toggleLaserPointer());
  if (mobileLaserDropdownBtn) {
    mobileLaserDropdownBtn.addEventListener('click', () => {
      const dropdown = document.getElementById('mobile-more-dropdown');
      if (dropdown) dropdown.style.display = 'none';
      toggleLaserPointer();
    });
  }

  const boardTilesGuideBtn = document.getElementById('board-tiles-guide-btn');
  if (boardTilesGuideBtn) boardTilesGuideBtn.addEventListener('click', toggleTilesGuideModal);

  if (backToLobbyBtn) {
    backToLobbyBtn.addEventListener('click', () => {
      sessionStorage.removeItem('carcassonne_active_room_id');
      currentRoom = null;
      if (victoryModal) {
        victoryModal.style.display = 'none';
        delete victoryModal.dataset.shownForRoom;
        delete victoryModal.dataset.manuallyClosed;
      }
      window.location.reload();
    });
  }

  const inspectFinalBoardBtn = document.getElementById('inspect-final-board-btn');
  const reopenPodiumBtn = document.getElementById('reopen-podium-btn');
  const exitInspectionBtn = document.getElementById('exit-inspection-btn');
  const confirmFinalTurnBtn = document.getElementById('confirm-final-turn-btn');

  if (inspectFinalBoardBtn) inspectFinalBoardBtn.addEventListener('click', inspectFinalBoard);
  if (reopenPodiumBtn) reopenPodiumBtn.addEventListener('click', reopenVictoryPodium);
  if (exitInspectionBtn) exitInspectionBtn.addEventListener('click', leaveRoom);
  if (confirmFinalTurnBtn) confirmFinalTurnBtn.addEventListener('click', confirmFinalTurn);

  rotateBtn.addEventListener('click', () => {
    if (boardRenderer.pendingPos) {
      boardRenderer.rotatePendingTile(1);
    } else {
      audio.playTileRotate();
      socket.emit('rotate_tile', { direction: 1 });
    }
  });

  passMeepleBtn.addEventListener('click', () => {
    if (!currentRoom || currentRoom.turnPhase !== 'place_meeple') return;
    audio.playClick();
    socket.emit('pass_meeple');
  });

  if (cancelTileBtn) {
    cancelTileBtn.addEventListener('click', () => {
      audio.playClick();
      socket.emit('cancel_tile_placement');
    });
  }

  // Drawer Tabs (Chat vs Logs)
  document.querySelectorAll('.drawer-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('chat-tab-content').style.display = tab === 'chat' ? 'flex' : 'none';
      document.getElementById('logs-tab-content').style.display = tab === 'logs' ? 'flex' : 'none';
    });
  });

  // Tabletop Simulator & BGA Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === playerNameInput) return;

    if (e.key === 'r' || e.key === 'R' || e.key === 'e' || e.key === 'E') {
      if (boardRenderer.pendingPos) {
        boardRenderer.rotatePendingTile(1);
      } else {
        audio.playTileRotate();
        socket.emit('rotate_tile', { direction: 1 });
      }
    } else if (e.key === 'q' || e.key === 'Q') {
      if (boardRenderer.pendingPos) {
        boardRenderer.rotatePendingTile(-1);
      } else {
        audio.playTileRotate();
        socket.emit('rotate_tile', { direction: -1 });
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (boardRenderer.pendingPos && boardRenderer.isPendingValid && currentRoom && currentRoom.turnPhase === 'place_tile') {
        onConfirmTilePlacement(boardRenderer.pendingPos.x, boardRenderer.pendingPos.y, boardRenderer.pendingRotation);
      } else if (currentRoom && currentRoom.turnPhase === 'confirm_turn') {
        confirmFinalTurn();
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (currentRoom && currentRoom.turnPhase === 'place_meeple') {
        audio.playClick();
        socket.emit('pass_meeple');
      }
    } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
      if (currentRoom && currentRoom.turnPhase === 'confirm_turn') {
        removeMeeple();
      } else if (currentRoom && currentRoom.turnPhase === 'place_meeple') {
        cancelTilePlacement();
      }
    } else if (e.key === 'f' || e.key === 'F' || e.key === 'c' || e.key === 'C') {
      boardRenderer.centerView();
    } else if (e.key === '+' || e.key === '=') {
      boardRenderer.zoomBy(1.2);
    } else if (e.key === '-' || e.key === '_') {
      boardRenderer.zoomBy(0.8);
    } else if (e.key === '0') {
      boardRenderer.resetZoom();
    } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
      boardRenderer.panBy(0, 40);
    } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
      boardRenderer.panBy(0, -40);
    } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      boardRenderer.panBy(40, 0);
    } else if (e.key === 'g' || e.key === 'G') {
      toggleTilesGuideModal();
    } else if (e.key === 'l' || e.key === 'L') {
      toggleLaserPointer();
    } else if (e.key === 'Alt') {
      toggleLaserPointer(true);
    } else if (e.key === 'Escape') {
      closeTilesGuideModal();
      if (shortcutsModal) shortcutsModal.style.display = 'none';
      toggleLaserPointer(false);
    } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
      boardRenderer.panBy(-40, 0);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
      toggleLaserPointer(false);
    }
  });

  // Chat
  sendChatBtn.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // Sandbox toggles
  sandboxToggleBtn.addEventListener('click', () => {
    if (!currentRoom) return;
    const newState = !currentRoom.sandboxMode;
    socket.emit('sandbox_set_mode', { sandboxMode: newState });
  });

  autoRulesCheckbox.addEventListener('change', (e) => {
    if (!currentRoom) return;
    socket.emit('sandbox_set_mode', { autoRules: e.target.checked });
  });
}

// Update Mobile Contextual Bottom Action Bar
function updateMobileContextualBar(state) {
  if (!currentRoom || currentRoom.status !== 'playing') {
    if (mobileContextualBar) mobileContextualBar.style.display = 'none';
    return;
  }

  const isMyTurn = isMyTurnNow(currentRoom);
  if (!isMyTurn && !currentRoom.sandboxMode) {
    if (mobileContextualBar) mobileContextualBar.style.display = 'none';
    return;
  }

  const pendingState = state || (boardRenderer ? { pendingPos: boardRenderer.pendingPos, isValid: boardRenderer.isPendingValid } : null);

  if (currentRoom.turnPhase === 'place_tile') {
    if (pendingState && pendingState.pendingPos) {
      if (mobileContextualBar) mobileContextualBar.style.display = 'block';
      if (contextualPendingActions) contextualPendingActions.style.display = 'flex';
      if (contextualMeepleActions) contextualMeepleActions.style.display = 'none';
      if (touchConfirmBtn) {
        touchConfirmBtn.style.opacity = pendingState.isValid ? '1' : '0.4';
        touchConfirmBtn.disabled = !pendingState.isValid;
      }
    } else {
      if (mobileContextualBar) mobileContextualBar.style.display = 'none';
    }
  } else if (currentRoom.turnPhase === 'place_meeple') {
    if (mobileContextualBar) mobileContextualBar.style.display = 'block';
    if (contextualPendingActions) contextualPendingActions.style.display = 'none';
    if (contextualMeepleActions) contextualMeepleActions.style.display = 'flex';
    const touchConfirmTurnBtn = document.getElementById('touch-confirm-turn-btn');
    const touchPassMeepleBtn = document.getElementById('touch-pass-meeple-btn');
    if (touchConfirmTurnBtn) touchConfirmTurnBtn.style.display = 'none';
    if (touchPassMeepleBtn) touchPassMeepleBtn.style.display = 'flex';
  } else if (currentRoom.turnPhase === 'confirm_turn') {
    if (mobileContextualBar) mobileContextualBar.style.display = 'block';
    if (contextualPendingActions) contextualPendingActions.style.display = 'none';
    if (contextualMeepleActions) contextualMeepleActions.style.display = 'flex';
    const touchConfirmTurnBtn = document.getElementById('touch-confirm-turn-btn');
    const touchPassMeepleBtn = document.getElementById('touch-pass-meeple-btn');
    if (touchConfirmTurnBtn) touchConfirmTurnBtn.style.display = 'flex';
    if (touchPassMeepleBtn) touchPassMeepleBtn.style.display = 'none';
  } else {
    if (mobileContextualBar) mobileContextualBar.style.display = 'none';
  }
}

// Toast Notifications
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  toast.innerText = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// API Calls
async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    renderRoomsList(rooms);
  } catch (err) {
    console.error('Error cargando salas:', err);
  }
}

async function loadSaves() {
  try {
    const res = await fetch('/api/saves');
    const saves = await res.json();
    renderSavesList(saves);
  } catch (err) {
    console.error('Error cargando partidas:', err);
  }
}

// Helpers & Profile Utilities
function getProfileName() {
  if (window.profileManager && typeof window.profileManager.getName === 'function') {
    return window.profileManager.getName();
  }
  if (window.profileManager && window.profileManager.profile && window.profileManager.profile.name) {
    return window.profileManager.profile.name;
  }
  return (playerNameInput ? playerNameInput.value.trim() : null) || localStorage.getItem('carcassonne_player_name') || myPlayerName || 'Comandante';
}

async function kickPlayer(targetPlayerId) {
  const ok = await showMedievalConfirm({
    title: '¿Expulsar Participante?',
    message: '¿Estás seguro de que deseas expulsar a este participante o bot de la sala de guerra?',
    icon: '⚔️',
    confirmText: '❌ Expulsar',
    confirmClass: 'btn-danger'
  });
  if (ok) {
    audio.playClick();
    socket.emit('remove_player', {
      roomId: currentRoom ? currentRoom.id : sessionStorage.getItem('carcassonne_active_room_id'),
      playerId: myPlayerId,
      targetPlayerId
    });
  }
}
window.kickPlayer = kickPlayer;

// ==================== WEB NOTIFICATIONS & TAB TITLE FLASHING ====================
let titleFlashInterval = null;
const originalTitle = document.title || 'Carcassonne';

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission();
    } catch (_) {}
  }
}
window.requestNotificationPermission = requestNotificationPermission;

function notifyMyTurn(playerName, playerSound) {
  // 1. Play custom turn sound
  audio.playTurnSound(playerSound);

  // 2. Web browser notification if user is in another tab
  if (document.hidden) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🏰 ¡Es tu turno en Carcassonne!', {
          body: `Comandante ${playerName || 'Noble'}, te toca colocar loseta en el reino.`,
          icon: 'assets/tiles/tile_back.png'
        });
      } catch (_) {}
    }

    // 3. Flash document title
    if (titleFlashInterval) clearInterval(titleFlashInterval);
    let isAlert = true;
    titleFlashInterval = setInterval(() => {
      document.title = isAlert ? '🔔 [¡TU TURNO!] Carcassonne' : originalTitle;
      isAlert = !isAlert;
    }, 900);
  }
}
window.notifyMyTurn = notifyMyTurn;

function stopTitleFlashing() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  document.title = originalTitle;
}
window.stopTitleFlashing = stopTitleFlashing;

function renderRoomsList(rooms) {
  roomsList.innerHTML = '';
  if (!rooms || rooms.length === 0) {
    roomsList.innerHTML = '<div class="empty-hint">No hay salas activas. ¡Crea una para comenzar!</div>';
    return;
  }

  // Deduplicate by ID
  const uniqueRooms = [];
  const seenIds = new Set();
  for (const r of rooms) {
    if (r && r.id && !seenIds.has(r.id)) {
      seenIds.add(r.id);
      uniqueRooms.push(r);
    }
  }

  const activeProfileName = getProfileName() || '';
  const myNormName = activeProfileName.trim().toLowerCase();

  uniqueRooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-card';

    const hostAvatarObj = window.profileManager ? window.profileManager.getAvatar(r.hostAvatar) : { icon: '👑', name: 'Noble' };
    const playersHtml = (r.players || []).map(p => {
      const pAv = window.profileManager ? window.profileManager.getAvatar(p.avatar) : { icon: '👤' };
      const isOnline = p.connected !== false;
      return `<span class="room-player-pill" title="${escapeHtml(p.name)} (${p.color}) - ${isOnline ? 'En línea' : 'Desconectado'}"><span class="online-status-dot ${isOnline ? 'online' : 'offline'}"></span>${pAv.icon} ${escapeHtml(p.name)}</span>`;
    }).join('');

    const norm = s => String(s || '').trim().toLowerCase();
    const isMyRoom = myNormName && (
      norm(r.hostName) === myNormName ||
      (r.players && r.players.some(p => norm(p.name) === myNormName && p.isHost)) ||
      (r.players && r.players[0] && norm(r.players[0].name) === myNormName)
    );

    div.innerHTML = `
      <div class="room-info">
        <div class="room-host-row">
          <span class="room-host-avatar" title="Comandante: ${escapeHtml(r.hostName)}">${hostAvatarObj.icon}</span>
          <div>
            <h4 style="margin:0; font-size:1.05rem;">${escapeHtml(r.name)}</h4>
            <span class="room-host-subtitle">👑 Creada por <strong>${escapeHtml(r.hostName)}</strong></span>
          </div>
        </div>
        ${playersHtml ? `<div class="room-players-preview">${playersHtml}</div>` : ''}
        <span class="room-meta">${r.playerCount}/6 Jugadores • ${r.status === 'playing' ? '⚔️ En partida' : '⏳ En espera'} ${r.includeRiver ? '• 🌊 Con Río' : ''}</span>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button class="btn btn-sm btn-primary" onclick="joinRoom('${r.id}')">Unirse</button>
        ${isMyRoom ? `<button class="btn btn-sm btn-danger" onclick="deleteRoomDirect('${r.id}')" title="Eliminar sala">🗑️</button>` : ''}
      </div>
    `;
    roomsList.appendChild(div);
  });
}

async function deleteRoomDirect(roomId) {
  const ok = await showMedievalConfirm({
    title: '¿Eliminar Sala?',
    message: '¿Estás seguro de que deseas eliminar permanentemente esta sala de la lista?',
    icon: '🗑️',
    confirmText: '🗑️ Eliminar',
    confirmClass: 'btn-danger'
  });
  if (ok) {
    audio.playClick();
    const myProfileName = (window.profileManager ? window.profileManager.getName() : (playerNameInput ? playerNameInput.value.trim() : null)) || myPlayerName;
    socket.emit('delete_room_by_id', { 
      roomId, 
      playerId: myPlayerId, 
      playerName: myProfileName 
    });
    setTimeout(() => loadRooms(), 250);
  }
}

function renderSavesList(saves) {
  savesList.innerHTML = '';
  if (!saves || saves.length === 0) {
    savesList.innerHTML = '<div class="empty-hint">No hay partidas guardadas aún.</div>';
    return;
  }

  saves.forEach(s => {
    const div = document.createElement('div');
    div.className = 'save-card';
    div.innerHTML = `
      <div class="save-info">
        <strong>${escapeHtml(s.name.replace('.json', ''))}</strong>
        <span class="save-meta">${new Date(s.updatedAt).toLocaleString()}</span>
      </div>
      <div class="save-actions">
        <button class="btn btn-sm btn-secondary" onclick="loadSavedGame('${s.name}')">Cargar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSavedGame('${s.name}')" title="Eliminar partida">🗑️</button>
      </div>
    `;
    savesList.appendChild(div);
  });
}

function getFirstFreeLocalColor(excludeIndex = -1) {
  const used = localPlayersConfig.filter((p, i) => i !== excludeIndex).map(p => p.color);
  const colors = ['red', 'blue', 'green', 'yellow', 'black', 'pink'];
  return colors.find(c => !used.includes(c)) || 'red';
}

function getFirstFreeLocalSound(excludeIndex = -1) {
  const used = localPlayersConfig.filter((p, i) => i !== excludeIndex).map(p => p.sound);
  const sounds = ['horn', 'bell', 'drum', 'harp', 'chant', 'trumpet'];
  return sounds.find(s => !used.includes(s)) || 'horn';
}

function renderLocalPlayersBuilder() {
  const container = document.getElementById('local-players-list');
  const countEl = document.getElementById('local-players-count');
  if (!container) return;

  if (countEl) countEl.innerText = localPlayersConfig.length;
  container.innerHTML = '';

  const colorsList = [
    { id: 'red', name: '🔴 Rojo' },
    { id: 'blue', name: '🔵 Azul' },
    { id: 'green', name: '🟢 Verde' },
    { id: 'yellow', name: '🟡 Amarillo' },
    { id: 'black', name: '⚫ Negro' },
    { id: 'pink', name: '🌸 Rosa' }
  ];

  const soundsList = [
    { id: 'horn', name: '📯 Cuerno' },
    { id: 'bell', name: '🔔 Campana' },
    { id: 'drum', name: '🥁 Tambor' },
    { id: 'harp', name: '🎵 Arpa' },
    { id: 'chant', name: '✨ Canto' },
    { id: 'trumpet', name: '🎺 Trompeta' }
  ];

  localPlayersConfig.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'local-player-row';

    const usedColorsOther = localPlayersConfig.filter((_, i) => i !== idx).map(x => x.color);
    const colorOptionsHtml = colorsList.map(c => {
      const isTaken = usedColorsOther.includes(c.id);
      const isSelected = p.color === c.id;
      return `<option value="${c.id}" ${isSelected ? 'selected' : ''} ${isTaken && !isSelected ? 'disabled' : ''}>${c.name} ${isTaken && !isSelected ? '(Ocupado)' : ''}</option>`;
    }).join('');

    const usedSoundsOther = localPlayersConfig.filter((_, i) => i !== idx).map(x => x.sound);
    if (!p.sound) {
      p.sound = soundsList.find(s => !usedSoundsOther.includes(s.id))?.id || soundsList[idx % soundsList.length].id;
    }
    const soundOptionsHtml = soundsList.map(s => {
      const isTaken = usedSoundsOther.includes(s.id);
      const isSelected = p.sound === s.id;
      return `<option value="${s.id}" ${isSelected ? 'selected' : ''} ${isTaken && !isSelected ? 'disabled' : ''}>${s.name} ${isTaken && !isSelected ? '(Ocupado)' : ''}</option>`;
    }).join('');

    row.innerHTML = `
      <span class="player-type-badge ${p.isBot ? 'badge-bot' : 'badge-human'}">${p.isBot ? '🤖 Bot' : '👤 Humano'}</span>
      <input type="text" class="form-control local-name-input" value="${escapeHtml(p.name)}" placeholder="Nombre" onchange="updateLocalPlayerName(${idx}, this.value)" />
      
      <select class="form-control local-color-select" onchange="updateLocalPlayerColor(${idx}, this.value)">
        ${colorOptionsHtml}
      </select>

      <div style="display:flex; align-items:center; gap:4px;">
        <select class="form-control local-sound-select" onchange="updateLocalPlayerSound(${idx}, this.value)" title="Sonido personalizado de turno">
          ${soundOptionsHtml}
        </select>
        <button class="btn btn-xs btn-secondary" onclick="audio.playTurnSound('${p.sound}')" title="Probar sonido" type="button">🔊</button>
      </div>

      ${p.isBot ? `
        <select class="form-control local-diff-select" onchange="updateLocalPlayerDifficulty(${idx}, this.value)">
          <option value="easy" ${p.difficulty === 'easy' ? 'selected' : ''}>Fácil</option>
          <option value="medium" ${p.difficulty === 'medium' ? 'selected' : ''}>Normal</option>
          <option value="hard" ${p.difficulty === 'hard' ? 'selected' : ''}>Difícil</option>
        </select>
      ` : ''}

      ${localPlayersConfig.length > 2 ? `
        <button class="btn btn-xs btn-danger btn-del-player" onclick="removeLocalPlayer(${idx})" title="Eliminar">🗑️</button>
      ` : ''}
    `;

    container.appendChild(row);
  });
}

function updateLocalPlayerName(idx, val) {
  if (localPlayersConfig[idx]) localPlayersConfig[idx].name = val.trim() || `Jugador ${idx + 1}`;
}

function updateLocalPlayerColor(idx, val) {
  if (localPlayersConfig[idx]) {
    localPlayersConfig[idx].color = val;
    renderLocalPlayersBuilder();
  }
}

function updateLocalPlayerSound(idx, val) {
  if (localPlayersConfig[idx]) {
    localPlayersConfig[idx].sound = val;
    audio.playTurnSound(val);
    renderLocalPlayersBuilder();
  }
}

function updateLocalPlayerDifficulty(idx, val) {
  if (localPlayersConfig[idx]) localPlayersConfig[idx].difficulty = val;
}

function removeLocalPlayer(idx) {
  if (localPlayersConfig.length > 2) {
    localPlayersConfig.splice(idx, 1);
    renderLocalPlayersBuilder();
  }
}

function startLocalGame() {
  audio.playClick();
  const includeRiver = document.getElementById('local-river-checkbox') ? document.getElementById('local-river-checkbox').checked : true;
  const sandboxMode = document.getElementById('local-sandbox-checkbox') ? document.getElementById('local-sandbox-checkbox').checked : false;

  console.log('[Game] Starting local game with config:', localPlayersConfig);
  socket.emit('create_local_game', {
    name: 'Partida Local (Pass & Play)',
    players: localPlayersConfig,
    options: { includeRiver, sandboxMode }
  });
}

window.updateLocalPlayerName = updateLocalPlayerName;
window.updateLocalPlayerColor = updateLocalPlayerColor;
window.updateLocalPlayerSound = updateLocalPlayerSound;
window.updateLocalPlayerDifficulty = updateLocalPlayerDifficulty;
window.removeLocalPlayer = removeLocalPlayer;
window.startLocalGame = startLocalGame;

function createRoom() {
  audio.playClick();
  const currentAvatar = window.profileManager?.profile?.avatar || 'king';
  const currentName = window.profileManager?.profile?.name || myPlayerName;
  const roomName = document.getElementById('room-name-input').value.trim() || `Reino de ${currentName}`;
  const includeRiver = document.getElementById('include-river-checkbox') ? document.getElementById('include-river-checkbox').checked : false;
  const sandboxMode = document.getElementById('sandbox-mode-checkbox') ? document.getElementById('sandbox-mode-checkbox').checked : false;

  fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: roomName,
      hostName: currentName,
      options: { includeRiver, sandboxMode, avatar: currentAvatar }
    })
  })
  .then(res => res.json())
  .then(room => {
    if (room && room.id) {
      joinRoom(room.id);
    }
  })
  .catch(err => {
    console.error('Error creando sala:', err);
    showToast('Error creando la sala', 'danger');
  });
}

function joinRoom(roomId) {
  audio.playClick();
  const currentAvatar = window.profileManager?.profile?.avatar || 'king';
  const currentName = window.profileManager?.profile?.name || myPlayerName;
  const preferredColor = colorSelect.value || window.profileManager?.profile?.color || 'red';
  socket.emit('join_room', {
    roomId,
    playerId: myPlayerId,
    playerName: currentName,
    preferredColor,
    avatar: currentAvatar
  });
}

function loadSavedGame(saveName) {
  audio.playClick();
  socket.emit('load_game', { saveName });
}

async function deleteSavedGame(saveName) {
  const ok = await showMedievalConfirm({
    title: '¿Eliminar Partida?',
    message: `¿Estás seguro de que deseas eliminar permanentemente la partida "${saveName}"?`,
    icon: '🗑️',
    confirmText: '🗑️ Eliminar',
    confirmClass: 'btn-danger'
  });
  if (ok) {
    fetch(`/api/saves/${encodeURIComponent(saveName)}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        showToast(`Partida "${saveName}" eliminada.`, 'info');
        loadSaves();
      })
      .catch(err => {
        showToast('Error al eliminar partida', 'warning');
      });
  }
}

async function promptSaveGame() {
  const defaultName = currentRoom?.saveFileName || 
                      (currentRoom?.name ? currentRoom.name.replace(/[^a-zA-Z0-9_-]/g, '_') : '') || 
                      `partida_${currentRoom?.id || 'reino'}`;
  const name = await showMedievalPrompt({
    title: 'Guardar Partida en el Reino',
    message: 'Introduce un nombre para registrar tu partida (si ya existe, se actualizará esta misma partida para evitar duplicados):',
    defaultValue: defaultName,
    placeholder: 'Nombre de la partida',
    icon: '💾',
    confirmText: '💾 Guardar'
  });
  if (name) {
    socket.emit('save_game', { saveName: name });
  }
}

function startGame() {
  audio.playClick();
  socket.emit('start_game');
}

async function leaveRoom() {
  const ok = await showMedievalConfirm({
    title: '¿Abandonar la Batalla?',
    message: '¿Deseas salir de la sala actual y regresar al menú principal de la taberna?',
    icon: '🚪',
    confirmText: '🚪 Salir de la Sala',
    cancelText: 'Permanecer',
    confirmClass: 'btn-danger'
  });
  if (ok) {
    sessionStorage.removeItem('carcassonne_active_room_id');
    currentRoom = null;
    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal) {
      victoryModal.style.display = 'none';
      delete victoryModal.dataset.shownForRoom;
      delete victoryModal.dataset.manuallyClosed;
    }
    window.location.reload();
  }
}

function sendChat() {
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('send_chat', { text });
    chatInput.value = '';
  }
}

function isMyTurnNow(room) {
  if (!room || room.status !== 'playing' || !room.activePlayer) return false;
  if (room.sandboxMode) return true;
  if (room.isLocal) {
    return !room.activePlayer.isBot;
  }
  return room.activePlayer.id === myPlayerId;
}

// Confirm placement of pending tile
function onConfirmTilePlacement(x, y, rotation) {
  if (!currentRoom || currentRoom.turnPhase !== 'place_tile') return;
  const isMyTurn = isMyTurnNow(currentRoom);
  if (!isMyTurn) return;

  console.log(`[Carcassonne:Sync] Emitting place_tile in room ${currentRoom.id} at (${x},${y}) rot:${rotation}`);
  audio.playTilePlace();
  boardRenderer.clearPendingTile();
  socket.emit('place_tile', { 
    roomId: currentRoom.id, 
    playerId: myPlayerId, 
    x, 
    y, 
    rotation 
  });
}

function cancelTilePlacement() {
  if (!currentRoom) return;
  console.log(`[Carcassonne:Sync] Emitting cancel_tile_placement in room ${currentRoom.id}`);
  audio.playClick();
  socket.emit('cancel_tile_placement', {
    roomId: currentRoom.id,
    playerId: myPlayerId
  });
}

function onSelectMeepleSegment(segmentId, pos) {
  if (!currentRoom || (currentRoom.turnPhase !== 'place_meeple' && currentRoom.turnPhase !== 'confirm_turn')) return;
  const isMyTurn = isMyTurnNow(currentRoom);
  if (!isMyTurn && !currentRoom.sandboxMode) return;

  console.log(`[Carcassonne:Sync] Emitting place_meeple in room ${currentRoom.id} segment:${segmentId}`);
  audio.playMeeplePlace();
  socket.emit('place_meeple', { 
    roomId: currentRoom.id, 
    playerId: myPlayerId, 
    segmentId, 
    pos 
  });
  if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
}

function confirmFinalTurn() {
  if (!currentRoom) return;
  const isMyTurn = isMyTurnNow(currentRoom);
  if (!isMyTurn && !currentRoom.sandboxMode) return;

  console.log(`[Carcassonne:Sync] Emitting confirm_turn in room ${currentRoom.id}`);
  audio.playClick();
  socket.emit('confirm_turn', {
    roomId: currentRoom.id,
    playerId: myPlayerId
  });
  if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
}

function removeMeeple() {
  if (!currentRoom) return;
  const isMyTurn = isMyTurnNow(currentRoom);
  if (!isMyTurn && !currentRoom.sandboxMode) return;

  console.log(`[Carcassonne:Sync] Emitting remove_meeple in room ${currentRoom.id}`);
  audio.playClick();
  socket.emit('remove_meeple', {
    roomId: currentRoom.id,
    playerId: myPlayerId
  });
}

function inspectFinalBoard() {
  const victoryModal = document.getElementById('victory-modal');
  const banner = document.getElementById('final-map-inspection-banner');
  if (victoryModal) {
    victoryModal.style.display = 'none';
    victoryModal.dataset.manuallyClosed = currentRoom?.id || 'true';
  }
  if (banner) banner.style.display = 'flex';
  if (boardRenderer) {
    boardRenderer.centerView();
  }
}

function reopenVictoryPodium() {
  const victoryModal = document.getElementById('victory-modal');
  const banner = document.getElementById('final-map-inspection-banner');
  if (banner) banner.style.display = 'none';
  if (victoryModal) {
    delete victoryModal.dataset.manuallyClosed;
    victoryModal.style.display = 'flex';
  }
}

function passMeeple() {
  if (!currentRoom || currentRoom.turnPhase !== 'place_meeple') return;
  const isMyTurn = isMyTurnNow(currentRoom);
  if (!isMyTurn && !currentRoom.sandboxMode) return;

  console.log(`[Carcassonne:Sync] Emitting pass_meeple in room ${currentRoom.id}`);
  audio.playClick();
  socket.emit('pass_meeple', {
    roomId: currentRoom.id,
    playerId: myPlayerId
  });
  if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
}

function onTileClicked(x, y, tile) {
  if (currentRoom && currentRoom.sandboxMode) {
    console.log('Clicked tile at', x, y, tile);
  }
}

function sendWarRoomChat() {
  if (!warRoomChatInput) return;
  const text = warRoomChatInput.value.trim();
  if (text) {
    socket.emit('send_chat', { text });
    warRoomChatInput.value = '';
  }
}

function renderWarRoom(room) {
  if (!room) return;
  if (warRoomTitle) warRoomTitle.innerText = room.name || 'Siege of Carcassonne';
  if (warRoomCode) warRoomCode.innerText = room.id || '';
  if (warRoomPlayerCount) warRoomPlayerCount.innerText = room.players ? room.players.length : 1;

  if (warRoomRiverBadge) {
    warRoomRiverBadge.innerText = room.includeRiver ? '🌊 Río: Sí' : '🌊 Río: No';
  }
  if (warRoomSandboxBadge) {
    warRoomSandboxBadge.innerText = room.sandboxMode ? '🛠️ Sandbox: ON' : '🛡️ Reglas Oficiales';
  }

  const isHost = room.players && room.players[0] && room.players[0].id === myPlayerId;
  const allReady = (room.players || []).every(p => p.isBot || p.isReady);

  const warRoomReadyBtn = document.getElementById('war-room-ready-btn');
  const warRoomDeleteBtn = document.getElementById('war-room-delete-btn');

  if (warRoomStartBtn) {
    warRoomStartBtn.style.display = isHost ? 'block' : 'none';
    warRoomStartBtn.disabled = !allReady && (room.players || []).length > 1;
    warRoomStartBtn.style.opacity = (!allReady && (room.players || []).length > 1) ? '0.6' : '1';
  }
  if (warRoomDeleteBtn) {
    warRoomDeleteBtn.style.display = isHost ? 'block' : 'none';
  }
  if (warRoomWaitingMsg) {
    if (isHost) {
      warRoomWaitingMsg.style.display = allReady ? 'none' : 'block';
      warRoomWaitingMsg.innerHTML = '⏳ Esperando a que todos los comandantes marquen <strong>¡Estoy Listo!</strong>...';
    } else {
      warRoomWaitingMsg.style.display = 'block';
      warRoomWaitingMsg.innerHTML = allReady
        ? '✅ ¡Todos listos! Esperando a que el comandante anfitrión inicie la batalla...'
        : '⏳ Esperando a que todos los comandantes estén listos...';
    }
  }
  if (warRoomAddBotBtn) warRoomAddBotBtn.style.display = isHost ? 'inline-flex' : 'none';

  // Render players in War Room
  if (warRoomPlayersList && room.players) {
    warRoomPlayersList.innerHTML = '';
    room.players.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'war-room-player-item';
      const isMe = p.id === myPlayerId;
      const isPPlayerHost = idx === 0;
      const pAvatar = window.profileManager ? window.profileManager.getAvatar(p.avatar) : { icon: '👤', title: 'Noble' };

      let botBadge = '';
      if (p.isBot) {
        const diffLabels = { easy: '🌱 Fácil', medium: '⚔️ Normal', hard: '🧠 Difícil' };
        botBadge = `<span class="badge badge-bot" style="font-size:0.75rem; margin-left:6px;">${diffLabels[p.difficulty] || '🤖 Bot'}</span>`;
      }

      const readyBadge = (p.isBot || p.isReady)
        ? '<span class="badge badge-success" style="font-size:0.75rem; margin-left:6px;">✅ Listo</span>'
        : '<span class="badge badge-warning" style="font-size:0.75rem; margin-left:6px;">⏳ Preparando</span>';

      const isOnline = p.isBot || p.connected !== false;
      item.innerHTML = `
        <div class="war-room-player-left">
          <span class="online-status-dot ${isOnline ? 'online' : 'offline'}" title="${isOnline ? 'Conectado en la sala' : 'Desconectado'}"></span>
          <span class="player-avatar-icon-mini" title="${pAvatar.title}">${p.isBot ? '🤖' : pAvatar.icon}</span>
          <div style="width:18px; height:18px; border-radius:50%; background-color:var(--color-${p.color}); border:2px solid var(--border-iron); box-shadow:0 0 6px var(--color-${p.color});"></div>
          <span style="font-family:var(--font-heading); font-weight:700; font-size:1.05rem; color:var(--on-surface);">
            ${escapeHtml(p.name)} ${isMe ? '<small style="color:var(--primary); font-weight:600;">(Tú)</small>' : ''} ${isPPlayerHost ? '👑' : ''}
          </span>
          ${botBadge}
          ${readyBadge}
        </div>
        <div class="war-room-player-right">
          ${isHost && !isPPlayerHost ? `<button class="btn btn-xs btn-danger" onclick="kickPlayer('${p.id}')" title="Expulsar">❌</button>` : ''}
        </div>
      `;
      warRoomPlayersList.appendChild(item);
    });
  }

  // Update My Ready button text and color
  const myPlayer = room.players ? room.players.find(p => p.id === myPlayerId) : null;
  if (warRoomReadyBtn && myPlayer) {
    if (myPlayer.isReady) {
      warRoomReadyBtn.innerHTML = '✅ ¡Listo para la Batalla! (Toca para cancelar)';
      warRoomReadyBtn.style.background = 'linear-gradient(135deg, #27ae60, #1e8449)';
      warRoomReadyBtn.style.borderColor = '#2ecc71';
    } else {
      warRoomReadyBtn.innerHTML = '⚔️ ¡Estoy Listo!';
      warRoomReadyBtn.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
      warRoomReadyBtn.style.borderColor = '#f39c12';
    }
  }

  // Synchronize color selection in War Room
  if (room.playerColors && warRoomColorSelect) {
    Array.from(warRoomColorSelect.options).forEach(opt => {
      const colorInfo = room.playerColors.find(c => c.id === opt.value);
      if (colorInfo) {
        const isMine = myPlayer && myPlayer.color === opt.value;
        opt.disabled = colorInfo.isTaken && !isMine;
        opt.text = `${colorInfo.name} ${colorInfo.isTaken && !isMine ? '(Ocupado)' : ''}`;
      }
    });
    if (myPlayer && myPlayer.color) {
      warRoomColorSelect.value = myPlayer.color;
    }
  }

  // Synchronize turn sound selection in War Room
  const warRoomSoundSelect = document.getElementById('war-room-sound-select');
  if (room.playerSounds && warRoomSoundSelect) {
    Array.from(warRoomSoundSelect.options).forEach(opt => {
      const soundInfo = room.playerSounds.find(s => s.id === opt.value);
      if (soundInfo) {
        const isMine = myPlayer && myPlayer.sound === opt.value;
        opt.disabled = soundInfo.isTaken && !isMine;
        opt.text = `${soundInfo.name} ${soundInfo.isTaken && !isMine ? '(Ocupado)' : ''}`;
      }
    });
    if (myPlayer && myPlayer.sound) {
      warRoomSoundSelect.value = myPlayer.sound;
      audio.setTurnSound(myPlayer.sound);
    }
  }
}

// Socket Events
socket.on('connect', () => {
  console.log(`[Carcassonne:Socket] Connected with ID: ${socket.id}`);
  const targetRoomId = (currentRoom && currentRoom.id) || sessionStorage.getItem('carcassonne_active_room_id');
  if (targetRoomId) {
    console.log(`[Carcassonne:Socket] Re-joining active room unconditionally on connect: ${targetRoomId}`);
    joinRoom(targetRoomId);
  }
  socket.emit('get_lobby_chat_history');
});

socket.on('lobby_chat_history', (msgs) => {
  renderLobbyChat(msgs);
});

socket.on('new_lobby_chat', (msg) => {
  appendLobbyChat(msg);
});

socket.on('room_joined', ({ room, player }) => {
  console.log(`[Carcassonne:Sync] Successfully joined room: ${room.id} (Status: ${room.status}, TurnIndex: ${room.turnIndex})`);
  currentRoom = room;
  sessionStorage.setItem('carcassonne_active_room_id', room.id);
  requestNotificationPermission();
  updateUI(room);
});

socket.on('room_deleted', ({ reason }) => {
  sessionStorage.removeItem('carcassonne_active_room_id');
  currentRoom = null;
  showToast(reason || 'La sala ha sido eliminada por el anfitrión.', 'warning');
  if (gameView) gameView.style.display = 'none';
  if (warRoomView) warRoomView.style.display = 'none';
  if (lobbyView) lobbyView.style.display = 'flex';
  loadRooms();
});

socket.on('room_updated', (room) => {
  console.log(`[Carcassonne:Sync] Received room_updated for ${room.id}. Turn: ${room.turnNumber}, Active: ${room.activePlayer?.name} (${room.turnPhase})`);
  currentRoom = room;
  updateUI(room);
});

socket.on('tile_placed', ({ placed, turnPhase, hasMeeples, segments, room }) => {
  console.log(`[Carcassonne:Sync] Received tile_placed for ${room.id}. TurnPhase: ${turnPhase}, Active: ${room.activePlayer?.name}`);
  currentRoom = room;
  activeMeepleSegments = segments || [];
  audio.playTilePlace();
  updateUI(room);

  const isMyTurn = isMyTurnNow(room);
  if (isMyTurn && turnPhase === 'place_meeple' && hasMeeples) {
    showMeeplePlacementOptions(segments);
  } else {
    meepleSelectionPanel.style.display = 'none';
  }
  updateMobileContextualBar();
});

// Auto-sync state on tab focus / visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const activeId = (currentRoom && currentRoom.id) || sessionStorage.getItem('carcassonne_active_room_id');
    if (activeId) {
      console.log(`[Carcassonne:Sync] Tab visible, refreshing state for room ${activeId}`);
      socket.emit('get_room_state', { roomId: activeId, playerId: myPlayerId });
    }
  }
});

socket.on('new_chat', (msg) => {
  const timeFormatted = msg.timestamp 
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const div = document.createElement('div');
  div.className = 'chat-bubble';
  div.innerHTML = `<strong style="color:var(--color-${msg.color})">${escapeHtml(msg.author)} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${escapeHtml(timeFormatted)})</span>:</strong> ${escapeHtml(msg.text)}`;
  
  if (chatMessagesEl) {
    chatMessagesEl.appendChild(div.cloneNode(true));
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
  if (warRoomChatMessages) {
    warRoomChatMessages.appendChild(div);
    warRoomChatMessages.scrollTop = warRoomChatMessages.scrollHeight;
  }
});

socket.on('game_saved', ({ fileName }) => {
  showToast(`¡Partida guardada exitosamente como ${fileName}!`, 'success');
  loadSaves();
});

socket.on('error_msg', (msg) => {
  if (boardRenderer) boardRenderer.isSubmittingPlacement = false;
  if (typeof msg === 'string' && (msg.includes('Sala no encontrada') || msg.includes('no activa'))) {
    sessionStorage.removeItem('carcassonne_active_room_id');
  }
  // Suppress transient race-condition errors (phase mismatch after structure scoring)
  if (typeof msg === 'string' && msg.startsWith('Fase incorrecta')) return;
  showToast(msg, 'warning');
});

// Laser Pointer Real-time Sync
socket.on('laser_pointer_updated', (data) => {
  if (boardRenderer && data) {
    boardRenderer.setLaser(data.playerId, data);
  }
});

// Rematch Socket Handlers
socket.on('rematch_requested', ({ requesterName }) => {
  audio.playScore();
  const modal = document.getElementById('rematch-request-modal');
  const requesterEl = document.getElementById('rematch-requester-name');
  if (requesterEl) requesterEl.innerText = requesterName || 'Tu oponente';
  if (modal) modal.style.display = 'flex';
  showToast(`⚔️ ¡${requesterName || 'Tu oponente'} te ha desafiado a una revancha!`, 'warning');
});

socket.on('rematch_declined', ({ declinerName }) => {
  const modal = document.getElementById('rematch-request-modal');
  if (modal) modal.style.display = 'none';
  showToast(`El comandante ${declinerName || 'El oponente'} ha declinado la revancha.`, 'info');
});

socket.on('rematch_started', ({ room }) => {
  const rematchReqModal = document.getElementById('rematch-request-modal');
  const victoryModal = document.getElementById('victory-modal');
  const banner = document.getElementById('final-map-inspection-banner');
  if (rematchReqModal) rematchReqModal.style.display = 'none';
  if (victoryModal) {
    victoryModal.style.display = 'none';
    delete victoryModal.dataset.shownForRoom;
    delete victoryModal.dataset.manuallyClosed;
  }
  if (banner) banner.style.display = 'none';
  showToast('⚔️ ¡Comenzando duelo de revancha!', 'success');
  currentRoom = room;
  updateUI(room);
});

function updateUI(room) {
  if (!room) return;

  // Auto-clean End-Game Modals and Final Inspection Banner when a game or lobby is active
  if (room.status === 'playing' || room.status === 'lobby') {
    const banner = document.getElementById('final-map-inspection-banner');
    if (banner) banner.style.display = 'none';

    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal && victoryModal.dataset.shownForRoom !== room.id) {
      victoryModal.style.display = 'none';
      delete victoryModal.dataset.shownForRoom;
      delete victoryModal.dataset.manuallyClosed;
      delete victoryModal.dataset.recorded;
    }

    const rematchReqModal = document.getElementById('rematch-request-modal');
    if (rematchReqModal) rematchReqModal.style.display = 'none';
  }

  // View Switching: War Room (Pre-Game Lobby) vs In-Game Table
  if (room.status === 'lobby') {
    if (lobbyView) lobbyView.style.display = 'none';
    if (warRoomView) warRoomView.style.display = 'flex';
    if (gameView) gameView.style.display = 'none';
    renderWarRoom(room);
    return;
  } else {
    const isFirstGameViewShow = gameView && gameView.style.display !== 'flex';
    if (lobbyView) lobbyView.style.display = 'none';
    if (warRoomView) warRoomView.style.display = 'none';
    if (gameView) gameView.style.display = 'flex';
    if (isFirstGameViewShow && boardRenderer) {
      requestAnimationFrame(() => {
        boardRenderer.resize();
      });
    }
  }

  if (roomTitle) roomTitle.innerText = room.name || 'Carcassonne';
  if (roomCodeBadge) roomCodeBadge.innerText = room.id || '';
  if (tileRemainingEl) tileRemainingEl.innerText = room.remainingTiles !== undefined ? room.remainingTiles : 0;

  // Trigger Medieval Roulette of Destiny on game start
  if (room.status === 'playing' && room.turnNumber === 1 && (!room.board || !room.board.tiles || room.board.tiles.length <= 1)) {
    if (window._lastRouletteRoomId !== room.id) {
      window._lastRouletteRoomId = room.id;
      showStartingPlayerRoulette(room);
    }
  }

  // Mobile Mini HUD update with Avatar, Points, and Meeples
  if (mobileHudDeck) mobileHudDeck.innerHTML = `🎴 <strong>${room.remainingTiles !== undefined ? room.remainingTiles : 0}</strong>`;
  if (mobileHudPlayer && room.activePlayer) {
    const isMe = isMyTurnNow(room);
    const pAvatar = window.profileManager ? window.profileManager.getAvatar(room.activePlayer.avatar) : { icon: '👤' };
    const pMeeples = room.activePlayer.meeples !== undefined ? room.activePlayer.meeples : 7;
    const pScore = room.activePlayer.score || 0;
    mobileHudPlayer.innerHTML = `
      <span>${room.activePlayer.isBot ? '🤖' : pAvatar.icon}</span>
      <span style="color:var(--color-${room.activePlayer.color}); font-weight:800;">${escapeHtml(room.activePlayer.name)}</span>
      <span style="color:var(--primary); font-size:0.75rem;">⭐${pScore}</span>
      <span style="color:var(--secondary); font-size:0.75rem;">👤x${pMeeples}</span>
      ${isMe ? '<span style="color:#2ecc71; font-size:0.72rem; font-weight:800;">(TÚ)</span>' : ''}
    `;
  }

  // Sandbox controls visibility
  if (sandboxPanel) sandboxPanel.style.display = room.sandboxMode ? 'block' : 'none';
  if (sandboxToggleBtn) {
    sandboxToggleBtn.classList.toggle('active', room.sandboxMode);
    sandboxToggleBtn.innerText = room.sandboxMode ? '🛠️ Sandbox: ON' : '🛠️ Sandbox: OFF';
  }
  if (autoRulesCheckbox) autoRulesCheckbox.checked = !!room.autoRules;

  // Lobby start button & Bot button (for host)
  const isHost = room.players && room.players[0] && room.players[0].id === myPlayerId;
  const startBtn = document.getElementById('start-game-btn');
  if (room.status === 'lobby') {
    if (startBtn) startBtn.style.display = isHost ? 'block' : 'none';
    if (addBotBtn) addBotBtn.style.display = isHost ? 'block' : 'none';
    if (turnIndicator) turnIndicator.innerText = 'Esperando a que el anfitrión inicie la partida...';
  } else {
    if (startBtn) startBtn.style.display = 'none';
    if (addBotBtn) addBotBtn.style.display = 'none';
  }

  // Color selection synchronization in Lobby
  const myPlayer = room.players ? room.players.find(p => p.id === myPlayerId) : null;
  if (room.playerColors && colorSelect) {
    Array.from(colorSelect.options).forEach(opt => {
      const colorInfo = room.playerColors.find(c => c.id === opt.value);
      if (colorInfo) {
        const isMine = myPlayer && myPlayer.color === opt.value;
        opt.disabled = colorInfo.isTaken && !isMine;
        opt.text = `${colorInfo.name} ${colorInfo.isTaken && !isMine ? '(Ocupado)' : ''}`;
      }
    });
    if (myPlayer && myPlayer.color) {
      colorSelect.value = myPlayer.color;
    }
  }

  // Active player turn indicator (handles Local and Online games)
  const activePlayer = room.activePlayer;
  const isMyTurn = isMyTurnNow(room);
  const currentActiveUser = room.isLocal ? activePlayer : (room.players ? room.players.find(p => p.id === myPlayerId) : null);
  const hasMeeples = currentActiveUser ? currentActiveUser.meeples > 0 : true;

  // Turn Change Notification & Sound Trigger
  if (room.status === 'playing' && activePlayer) {
    const currentTurnKey = `${room.id}:${room.turnNumber}:${activePlayer.id}:${room.turnPhase}`;
    if (window._lastTurnKey !== currentTurnKey) {
      const isNewPlayerTurn = !window._lastTurnKey || !window._lastTurnKey.includes(`:${activePlayer.id}:`);
      window._lastTurnKey = currentTurnKey;
      if (isMyTurn && !activePlayer.isBot && isNewPlayerTurn) {
        notifyMyTurn(activePlayer.name, activePlayer.sound);
      }
    }
  }

  if (room.status === 'playing') {
    if (isMyTurn) {
      const activeName = activePlayer ? activePlayer.name : 'Jugador';
      const prefix = room.isLocal ? `¡Turno de <strong>${escapeHtml(activeName)}</strong>!` : '¡Es tu turno!';
      if (room.turnPhase === 'place_tile') {
        if (turnIndicator) turnIndicator.innerHTML = `<span class="badge badge-success">${prefix}</span> Toca una casilla (+) para ubicar la loseta`;
        if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
      } else if (room.turnPhase === 'confirm_turn') {
        if (turnIndicator) turnIndicator.innerHTML = `<span class="badge badge-success">¡Seguidor Ubicado (${escapeHtml(activeName)})!</span> Pulsa ⚔️ Finalizar Jugada o Deshazla`;
      } else if (hasMeeples) {
        if (turnIndicator) turnIndicator.innerHTML = `<span class="badge badge-warning">¡Coloca Seguidor (${escapeHtml(activeName)})!</span> Toca los puntos o pasa`;
      } else {
        if (turnIndicator) turnIndicator.innerHTML = `<span class="badge badge-warning">¡Sin Meeples (${escapeHtml(activeName)})!</span> Pasa de turno (P)`;
        if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
      }
    } else {
      const activeName = room.activePlayer ? room.activePlayer.name : 'Jugador';
      const isBotThinking = room.activePlayer && room.activePlayer.isBot;
      const isPlayerIdle = room.activePlayer && !room.activePlayer.connected && !room.activePlayer.isBot;
      if (turnIndicator) {
        if (isPlayerIdle) {
          turnIndicator.innerHTML = `<span class="badge badge-warning">💤 ${escapeHtml(activeName)} en reposo</span> Esperando reconexión para continuar...`;
        } else {
          const phaseText = room.turnPhase === 'place_tile' ? 'colocando loseta' : (room.turnPhase === 'confirm_turn' ? 'confirmando jugada' : 'colocando seguidor');
          turnIndicator.innerHTML = `Turno de <strong>${escapeHtml(activeName)}</strong> ${isBotThinking ? '(IA pensando...)' : `(${phaseText})`}`;
        }
      }
      if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
    }
  } else if (room.status === 'ended') {
    if (turnIndicator) turnIndicator.innerHTML = `<span class="badge badge-warning">🏆 ¡Fin de la partida!</span>`;
    if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
    if (room.rankings && room.rankings.length > 0) {
      renderVictoryPodium(room.rankings);
    }
  }

  // Render Players & Scores
  renderPlayers(room);

  // Render Current Tile in hand & Mobile Floating HUD
  const floatingTileHud = document.getElementById('mobile-floating-tile-hud');
  const floatingTileImg = document.getElementById('floating-tile-img');
  const floatingTilesCount = document.getElementById('floating-tiles-count');

  if (tilePreviewImg) {
    if (room.currentTile && room.status === 'playing') {
      tilePreviewImg.src = room.currentTile.image;
      tilePreviewImg.style.transform = `rotate(${room.currentRotation}deg)`;
      if (rotateBtn) rotateBtn.disabled = room.turnPhase !== 'place_tile' && !room.sandboxMode && !isMyTurn;
    } else {
      tilePreviewImg.src = 'assets/tiles/tile_back.png';
      if (rotateBtn) rotateBtn.disabled = true;
    }
  }

  if (floatingTileHud) {
    if (room.currentTile && room.status === 'playing') {
      floatingTileHud.style.display = 'flex';
      floatingTileHud.classList.toggle('my-turn', isMyTurn && room.turnPhase === 'place_tile');
      if (floatingTileImg) {
        floatingTileImg.src = room.currentTile.image;
        const currentRot = (boardRenderer && boardRenderer.pendingPos) ? boardRenderer.pendingRotation : room.currentRotation;
        floatingTileImg.style.transform = `rotate(${currentRot || 0}deg)`;
      }
      if (floatingTilesCount) {
        floatingTilesCount.innerText = room.remainingTiles !== undefined ? room.remainingTiles : 0;
      }
    } else {
      floatingTileHud.style.display = 'none';
    }
  }

  // In local mode, default to logs and hide chat
  const chatTabBtn = document.querySelector('.drawer-tabs .tab-btn[data-tab="chat"]');
  const logsTabBtn = document.querySelector('.drawer-tabs .tab-btn[data-tab="logs"]');
  if (chatTabBtn && logsTabBtn) {
    if (room.isLocal) {
      chatTabBtn.style.display = 'none';
      if (!logsTabBtn.classList.contains('active')) logsTabBtn.click();
    } else {
      chatTabBtn.style.display = '';
    }
  }

  // Logs
  renderLogs(room.logs);

  // Update Board Renderer
  const currentSegments = (room.availableSegments && room.availableSegments.length > 0)
    ? room.availableSegments
    : (activeMeepleSegments.length > 0 ? activeMeepleSegments : []);

  if (room.availableSegments && room.availableSegments.length > 0) {
    activeMeepleSegments = room.availableSegments;
  }

  const confirmFinalTurnBtn = document.getElementById('confirm-final-turn-btn');
  const meeplePanelTitle = document.getElementById('meeple-panel-title');
  const meeplePanelDesc = document.getElementById('meeple-panel-desc');

  if (isMyTurn && room.turnPhase === 'place_meeple' && hasMeeples) {
    if (confirmFinalTurnBtn) confirmFinalTurnBtn.style.display = 'none';
    if (meeplePanelTitle) meeplePanelTitle.innerText = '📍 Colocar Seguidor o Finalizar';
    if (meeplePanelDesc) meeplePanelDesc.innerText = 'Toca los puntos del tablero o elige aquí:';
    if (passMeepleBtn) passMeepleBtn.style.display = 'block';
    if (cancelTileBtn) cancelTileBtn.innerText = '↩️ Deshacer Loseta (Z)';
    showMeeplePlacementOptions(currentSegments);
  } else if (isMyTurn && room.turnPhase === 'confirm_turn') {
    if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'block';
    if (confirmFinalTurnBtn) confirmFinalTurnBtn.style.display = 'block';
    if (meeplePanelTitle) meeplePanelTitle.innerText = '⚔️ ¡Seguidor Ubicado!';
    if (meeplePanelDesc) meeplePanelDesc.innerText = 'Confirma tu jugada para finalizar turno:';
    if (meepleOptionsEl) meepleOptionsEl.innerHTML = '<div style="color:var(--accent-gold); font-size:0.85rem; font-weight:600; padding:6px 0; text-align:center;">✓ Seguidor posicionado</div>';
    if (passMeepleBtn) passMeepleBtn.style.display = 'none';
    if (cancelTileBtn) cancelTileBtn.innerText = '↩️ Deshacer (Z)';
  } else {
    if (meepleSelectionPanel) meepleSelectionPanel.style.display = 'none';
  }

  // Floating right action buttons (Pass, Confirm & Undo) - visible during active turn
  if (boardRightActions) {
    const isMeepleOrConfirm = room.turnPhase === 'place_meeple' || room.turnPhase === 'confirm_turn';
    const shouldShow = (room.status === 'playing' && isMeepleOrConfirm && (isMyTurn || room.sandboxMode));
    boardRightActions.style.display = shouldShow ? 'flex' : 'none';

    const floatingConfirmTurn = document.getElementById('floating-confirm-turn-btn');
    const floatingPassCircle = document.getElementById('floating-pass-circle-btn');
    const floatingUndo = document.getElementById('floating-undo-btn');

    if (floatingConfirmTurn) floatingConfirmTurn.style.display = (room.turnPhase === 'confirm_turn') ? 'flex' : 'none';
    if (floatingPassCircle) floatingPassCircle.style.display = (room.turnPhase === 'place_meeple') ? 'flex' : 'none';
    if (floatingUndo) {
      floatingUndo.style.display = 'flex';
      floatingUndo.title = (room.turnPhase === 'confirm_turn') ? 'Deshacer seguidor (Z)' : 'Deshacer loseta (Z)';
    }
  }

  boardRenderer.updateState({
    board: room.board,
    validPlacements: room.validPlacements,
    currentTile: room.currentTile,
    currentRotation: room.currentRotation,
    turnPhase: room.turnPhase,
    lastPlacedPos: room.lastPlacedPos,
    segments: currentSegments,
    activePlayerColor: (room.isLocal && activePlayer) ? activePlayer.color : (myPlayer ? myPlayer.color : 'red'),
    isMyTurn: isMyTurn || room.sandboxMode,
    hasMeeples: hasMeeples
  });

  updateMobileContextualBar();
}

function renderPlayers(room) {
  playersListEl.innerHTML = '';
  if (!room.players) return;

  room.players.forEach((p, idx) => {
    const isActive = room.status === 'playing' && room.turnIndex === idx;
    const isMe = room.isLocal ? (isActive && !p.isBot) : (p.id === myPlayerId);
    const isIdle = !room.isLocal && !p.isBot && p.connected === false;
    const pAvatar = window.profileManager ? window.profileManager.getAvatar(p.avatar) : { icon: '👤', title: 'Noble' };

    const isOnline = room.isLocal || p.isBot || p.connected !== false;
    const div = document.createElement('div');
    div.className = `player-card ${isActive ? 'active-turn' : ''} ${isIdle ? 'player-idle' : ''}`;
    div.innerHTML = `
      <div class="player-avatar-wrap">
        <span class="online-status-dot ${isOnline ? 'online' : 'offline'}" title="${isOnline ? 'En línea en la partida' : 'Desconectado'}"></span>
        <span class="player-card-avatar" title="${pAvatar.title}">${p.isBot ? '🤖' : pAvatar.icon}</span>
        <img src="assets/meeples/meeple_${p.color}.svg" class="player-meeple-icon" />
        <span class="player-name">${escapeHtml(p.name)} ${isMe ? (room.isLocal ? '(Turno)' : '(Tú)') : ''}</span>
        ${isIdle ? '<span class="player-idle-badge" title="Jugador en reposo (desconectado). Puede reconectarse en cualquier momento.">💤 En reposo</span>' : ''}
      </div>
      <div class="player-stats">
        <div class="stat-badge score-badge">⭐ ${p.score} pts</div>
        <div class="stat-badge meeple-badge">👤 x${p.meeples}</div>
        ${room.sandboxMode ? `
          <div class="sandbox-player-actions">
            <button class="btn btn-xs" onclick="adjustPlayerScore('${p.id}', 1)">+1</button>
            <button class="btn btn-xs" onclick="adjustPlayerScore('${p.id}', -1)">-1</button>
          </div>
        ` : ''}
      </div>
    `;
    playersListEl.appendChild(div);
  });
}

function adjustPlayerScore(playerId, delta) {
  socket.emit('sandbox_adjust_score', { playerId, delta });
}

function showMeeplePlacementOptions(segments) {
  meepleOptionsEl.innerHTML = '';
  meepleSelectionPanel.style.display = 'block';

  if (!segments || segments.length === 0) {
    return;
  }

  segments.forEach(seg => {
    const btn = document.createElement('button');
    const isFarmer = seg.type === 'field' || seg.id.startsWith('field');
    const isOccupied = !!seg.isOccupied;

    btn.className = `btn btn-sm meeple-seg-btn ${isOccupied ? 'disabled' : 'btn-secondary'}`;
    if (isOccupied) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = seg.occupiedError || 'Estructura ya ocupada por otro seguidor';
      btn.disabled = true;
    }

    btn.innerHTML = `
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isOccupied ? '#64748b' : (seg.color || '#f1c40f')};margin-right:6px;"></span>
      <span>${escapeHtml(seg.name || seg.id)}${isFarmer && !seg.name?.includes('Acostado') ? ' (Acostado)' : ''}</span>
      ${isOccupied ? '<span class="badge badge-warning" style="font-size:0.65rem;margin-left:auto;padding:2px 5px;">🚫 Ocupado</span>' : ''}
    `;

    if (!isOccupied) {
      btn.onclick = () => onSelectMeepleSegment(seg.id, seg.pos);
    }
    meepleOptionsEl.appendChild(btn);
  });
}

function renderLogs(logs) {
  if (!logs) return;
  logsListEl.innerHTML = '';
  logs.slice().reverse().forEach(log => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="log-time">[${log.time}]</span> ${escapeHtml(log.text)}`;
    logsListEl.appendChild(li);
  });
}

function renderVictoryPodium(rankings) {
  const modal = document.getElementById('victory-modal');
  const container = document.getElementById('victory-podium');
  if (!modal || !container) return;

  // Don't re-open if the user already dismissed this modal for this room
  if (modal.dataset.manuallyClosed === (currentRoom?.id || 'true')) {
    return;
  }
  modal.dataset.shownForRoom = currentRoom?.id || '';

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
  container.innerHTML = '';

  rankings.forEach((p, idx) => {
    const pAvatar = window.profileManager ? window.profileManager.getAvatar(p.avatar) : { icon: '👤', title: 'Noble' };
    const card = document.createElement('div');
    card.className = `rank-card rank-${idx + 1}`;
    card.innerHTML = `
      <span class="rank-badge">${medals[idx] || '🎖️'}</span>
      <div class="rank-player-info">
        <span style="font-size:1.5rem;" title="${pAvatar.title}">${p.isBot ? '🤖' : pAvatar.icon}</span>
        <img src="assets/meeples/meeple_${p.color}.svg" style="width:28px;height:28px;" />
        <span class="rank-player-name">${escapeHtml(p.name)}</span>
      </div>
      <span class="rank-score">${p.score} pts</span>
    `;
    container.appendChild(card);
  });

  // Reset AI Match Analysis UI in Victory Podium
  const aiBtn = document.getElementById('request-ai-analysis-btn');
  const aiContent = document.getElementById('ai-analysis-content');
  const aiLoading = document.getElementById('ai-analysis-loading');
  const aiResult = document.getElementById('ai-analysis-result');

  if (aiBtn) {
    aiBtn.style.display = 'flex';
    aiBtn.disabled = false;
    aiBtn.innerHTML = '<span class="ai-btn-icon">🧙‍♂️</span><span class="ai-btn-text">Consultar al Sabio de la Torre (Análisis Táctico IA)</span>';
  }
  if (aiContent) aiContent.style.display = 'none';
  if (aiResult) aiResult.innerHTML = '';

  // Record Career Stats for Local Player
  const myPlayer = rankings.find(p => p.id === myPlayerId);
  if (myPlayer && window.profileManager && !modal.dataset.recorded) {
    modal.dataset.recorded = 'true';
    const isWinner = rankings[0] && rankings[0].id === myPlayerId;
    window.profileManager.recordGameFinished(myPlayer.score, isWinner);
  }

  audio.playScore();
  modal.style.display = 'flex';
}

// AI Match Analysis in Victory Modal
const requestAiAnalysisBtn = document.getElementById('request-ai-analysis-btn');
if (requestAiAnalysisBtn) {
  requestAiAnalysisBtn.addEventListener('click', () => {
    const replayId = currentRoom?.lastReplayId;
    const aiContent = document.getElementById('ai-analysis-content');
    const aiLoading = document.getElementById('ai-analysis-loading');
    const aiResult = document.getElementById('ai-analysis-result');

    if (!replayId) {
      showToast('No se encontró el identificador de la partida.', 'warning');
      return;
    }

    requestAiAnalysisBtn.disabled = true;
    if (aiContent) aiContent.style.display = 'block';
    if (aiLoading) aiLoading.style.display = 'block';
    if (aiResult) aiResult.innerHTML = '';

    fetch(`/api/ai/analyze-replay/${replayId}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (aiLoading) aiLoading.style.display = 'none';
        if (data.success && data.analysis) {
          if (aiResult) aiResult.innerHTML = renderMarkdown(data.analysis);
          requestAiAnalysisBtn.style.display = 'none';
        } else {
          if (aiResult) aiResult.innerHTML = `<p style="color:#ef4444;">⚠️ ${data.error || 'Error generando el análisis táctico'}</p>`;
          requestAiAnalysisBtn.disabled = false;
        }
      })
      .catch(err => {
        if (aiLoading) aiLoading.style.display = 'none';
        if (aiResult) aiResult.innerHTML = '<p style="color:#ef4444;">⚠️ Error de conexión con la IA Gemini.</p>';
        requestAiAnalysisBtn.disabled = false;
      });
  });
}

// Markdown parser helper for AI analysis reports
function renderMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);
  
  // Headers
  html = html.replace(/^#### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');
  
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
  
  // Line breaks
  html = html.replace(/\n\n/g, '<p></p>');
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Load and Render Replays
function loadReplays() {
  const listEl = document.getElementById('replays-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="empty-hint">Cargando crónicas del reino...</div>';

  fetch('/api/replays')
    .then(res => res.json())
    .then(replays => {
      renderReplaysList(replays);
    })
    .catch(err => {
      console.error('Error cargando replays:', err);
      listEl.innerHTML = '<div class="empty-hint text-danger">Error al cargar el historial de partidas.</div>';
    });
}

function renderReplaysList(replays) {
  const listEl = document.getElementById('replays-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!replays || replays.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">Aún no hay crónicas registradas. ¡Juega una partida para registrarla!</div>';
    return;
  }

  replays.forEach(r => {
    const card = document.createElement('div');
    card.className = 'replay-card';

    const playerPills = (r.players || []).map(p => `
      <span class="replay-player-pill ${p.isWinner ? 'winner' : ''}">
        ${p.isWinner ? '👑 ' : ''}${escapeHtml(p.name)}: <strong>${p.score} pts</strong>
      </span>
    `).join('');

    const formattedDate = r.startedAt 
      ? new Date(r.startedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : 'Fecha desconocida';

    card.innerHTML = `
      <div class="replay-info-left">
        <h4>⚔️ ${escapeHtml(r.name)}</h4>
        <div class="replay-meta-tags">
          <span>📅 ${formattedDate}</span>
          <span>⏱️ ${r.durationMinutes || 1} min</span>
          <span>🔄 ${r.totalTurns || 0} turnos</span>
          ${r.hasAnalysis ? '<span class="badge" style="background:#6c5ce7;color:#fff;font-size:0.75rem;padding:2px 6px;border-radius:4px;">🧙‍♂️ Analizada</span>' : ''}
        </div>
        <div class="replay-player-badges">${playerPills}</div>
      </div>
      <div class="replay-actions" style="display:flex; gap:6px; align-items:center;">
        <button class="btn btn-sm btn-warning" onclick="openReplayMovie('${r.id}')" style="background:linear-gradient(135deg, #f39c12, #d35400); color:#fff; font-weight:700;">
          🎬 Película
        </button>
        <button class="btn btn-sm btn-primary" onclick="openReplayModal('${r.id}')">
          📜 Crónica IA
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteReplay('${r.id}', '${escapeHtml(r.name).replace(/'/g, "\\'")}')" title="Eliminar crónica de batalla">
          🗑️
        </button>
      </div>
    `;
    listEl.appendChild(card);
  });
}

async function deleteReplay(replayId, name) {
  const ok = await showMedievalConfirm({
    title: '¿Eliminar Crónica?',
    message: `¿Estás seguro de que deseas eliminar la grabación de "${name || 'esta partida'}"? Esta acción no se puede deshacer.`,
    icon: '🗑️',
    confirmText: '🗑️ Eliminar Crónica',
    confirmClass: 'btn-danger'
  });
  if (!ok) return;
  try {
    const res = await fetch(`/api/replays/${replayId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Crónica eliminada correctamente.', 'info');
      loadReplays();
    } else {
      showToast(data.error || 'No se pudo eliminar la crónica', 'danger');
    }
  } catch (err) {
    showToast('Error de conexión al eliminar la crónica', 'danger');
  }
}

// Global Lobby Chat Functions
function sendLobbyChat() {
  const input = document.getElementById('lobby-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  audio.playClick();
  const currentAvatar = window.profileManager?.profile?.avatar || 'king';
  const currentName = getProfileName();
  const currentColor = colorSelect?.value || window.profileManager?.profile?.color || 'yellow';
  socket.emit('send_lobby_chat', { text, senderName: currentName, avatar: currentAvatar, color: currentColor });
  input.value = '';
}

function renderLobbyChat(messages) {
  const container = document.getElementById('lobby-chat-messages');
  if (!container) return;
  container.innerHTML = '';
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="empty-hint">Bienvenido a la Taberna del Reino. Escribe el primer mensaje...</div>';
    return;
  }
  messages.forEach(msg => appendLobbyChat(msg, false));
  container.scrollTop = container.scrollHeight;
}

function appendLobbyChat(msg, scroll = true) {
  const container = document.getElementById('lobby-chat-messages');
  if (!container) return;
  const emptyHint = container.querySelector('.empty-hint');
  if (emptyHint) emptyHint.remove();

  const pAvatar = window.profileManager ? window.profileManager.getAvatar(msg.avatar) : { icon: '👑' };
  const timeFormatted = msg.timestamp 
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : (msg.time || '');

  const div = document.createElement('div');
  div.className = 'lobby-chat-bubble';
  div.innerHTML = `
    <div class="bubble-header">
      <span>${pAvatar.icon}</span>
      <strong style="color:var(--color-${msg.color || 'yellow'})">${escapeHtml(msg.sender)}</strong>
      <span class="bubble-time">${escapeHtml(timeFormatted)}</span>
    </div>
    <div class="bubble-text">${escapeHtml(msg.text)}</div>
  `;
  container.appendChild(div);
  if (scroll) container.scrollTop = container.scrollHeight;
}

// Surrender Handler
async function handleSurrender() {
  if (!currentRoom || currentRoom.status !== 'playing') return;
  const ok = await showMedievalConfirm({
    title: '¿Rendirse en la Batalla?',
    message: '¿Estás seguro de que deseas izar la bandera blanca? La partida se dará por finalizada y se computará la victoria a tus rivales.',
    icon: '🏳️',
    confirmText: '🏳️ Rendirse',
    cancelText: 'Seguir Luchando',
    confirmClass: 'btn-danger'
  });
  if (ok) {
    audio.playClick();
    socket.emit('surrender', {
      roomId: currentRoom.id,
      playerId: myPlayerId
    });
  }
}

// Leaderboard Functions
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-table-container');
  if (!container) return;
  container.innerHTML = '<div class="empty-hint">Consultando los anales del reino...</div>';
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    if (data.success && data.leaderboard) {
      renderLeaderboard(data.leaderboard);
    } else {
      container.innerHTML = '<div class="empty-hint text-danger">No se pudo cargar la clasificación.</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-hint text-danger">Error de conexión al cargar clasificación.</div>';
  }
}

function renderLeaderboard(list) {
  const container = document.getElementById('leaderboard-table-container');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="empty-hint">Aún no hay comandantes registrados en la clasificación. ¡Juega partidas para escalar posiciones!</div>';
    return;
  }

  const rowsHtml = list.map((p, idx) => {
    const pAvatar = window.profileManager ? window.profileManager.getAvatar(p.avatar) : { icon: '👑' };
    const rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : ''));
    return `
      <tr>
        <td><span class="rank-pill ${rankClass}">${idx + 1}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">${p.isBot ? '🤖' : pAvatar.icon}</span>
            <strong style="color:var(--on-surface);">${escapeHtml(p.name)}</strong>
            ${p.isBot ? '<span class="badge badge-bot" style="font-size:0.7rem; margin-left:4px;">Bot</span>' : ''}
          </div>
        </td>
        <td style="color:var(--accent-gold); font-weight:800;">${p.wins}</td>
        <td>${p.games}</td>
        <td><span class="badge badge-success">${p.winRate}%</span></td>
        <td style="font-weight:700; color:var(--primary);">${p.highScore} pts</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th style="width:50px;">#</th>
          <th>Comandante</th>
          <th>👑 Victorias</th>
          <th>⚔️ Partidas</th>
          <th>📊 Tasa</th>
          <th>⭐ Récord</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

// ==================== INTERACTIVE REPLAY MOVIE PLAYER ====================
let replayMovieState = {
  replay: null,
  actions: [],
  currentStep: 0,
  isPlaying: false,
  speed: 1,
  timer: null,
  renderer: null
};

function openReplayMovie(replayId) {
  const modal = document.getElementById('replay-movie-modal');
  const titleEl = document.getElementById('replay-movie-title');
  const subtitleEl = document.getElementById('replay-movie-subtitle');
  if (!modal) return;

  modal.style.display = 'flex';
  if (titleEl) titleEl.innerText = '🎬 Película de la Partida';
  if (subtitleEl) subtitleEl.innerText = 'Cargando crónicas del reino...';

  fetch(`/api/replays/${replayId}`)
    .then(res => res.json())
    .then(replay => {
      if (!replay) return showToast('Error cargando replay', 'warning');

      const canvas = document.getElementById('replay-board-canvas');
      if (!replayMovieState.renderer) {
        replayMovieState.renderer = new BoardRenderer(canvas, {
          onSlotClick: () => {},
          onTileClick: () => {},
          onMeeplePointClick: () => {},
          onConfirmPendingTile: () => {},
          onCancelPlacement: () => {},
          onPendingStateChange: () => {}
        });
      }

      // Filter valid replay step actions
      const actions = (replay.actions || []).filter(a => a && (a.type === 'start_tile' || a.type === 'place_tile' || a.type === 'place_meeple' || a.type === 'remove_meeple' || a.type === 'pass_meeple' || a.type === 'feature_scored'));

      replayMovieState.replay = replay;
      replayMovieState.actions = actions;
      replayMovieState.currentStep = 0;
      replayMovieState.isPlaying = false;
      replayMovieState.speed = 1;
      if (replayMovieState.timer) clearInterval(replayMovieState.timer);

      if (titleEl) titleEl.innerText = `🎬 ${replay.name || 'Crónica de Batalla'}`;
      if (subtitleEl) {
        const playersText = (replay.players || []).map(p => `${p.name} (${p.score} pts)`).join(' vs ');
        subtitleEl.innerText = `${new Date(replay.startedAt).toLocaleDateString()} • ${playersText} • ${actions.length} jugadas`;
      }

      const slider = document.getElementById('replay-timeline-slider');
      const totalLabel = document.getElementById('replay-total-turns-label');
      if (slider) {
        slider.min = 0;
        slider.max = Math.max(0, actions.length - 1);
        slider.value = 0;
      }
      if (totalLabel) totalLabel.innerText = `Jugada ${actions.length}`;

      initReplayMovieListeners();
      renderReplayMovieStep(0);
      setTimeout(() => {
        if (replayMovieState.renderer) {
          replayMovieState.renderer.resize();
          replayMovieState.renderer.centerView(true);
        }
      }, 60);
    })
    .catch(err => {
      showToast('Error cargando replay: ' + err.message, 'warning');
    });
}
window.openReplayMovie = openReplayMovie;

function initReplayMovieListeners() {
  const closeBtn = document.getElementById('close-replay-movie-btn');
  const playBtn = document.getElementById('replay-play-pause-btn');
  const stepBackBtn = document.getElementById('replay-step-back-btn');
  const stepFwdBtn = document.getElementById('replay-step-fwd-btn');
  const stepStartBtn = document.getElementById('replay-step-start-btn');
  const stepEndBtn = document.getElementById('replay-step-end-btn');
  const speedBtn = document.getElementById('replay-speed-btn');
  const slider = document.getElementById('replay-timeline-slider');

  if (closeBtn) {
    closeBtn.onclick = () => {
      pauseReplayMovie();
      const modal = document.getElementById('replay-movie-modal');
      if (modal) modal.style.display = 'none';
    };
  }

  if (playBtn) playBtn.onclick = toggleReplayPlayPause;
  if (stepBackBtn) stepBackBtn.onclick = () => { pauseReplayMovie(); stepReplayMovie(-1); };
  if (stepFwdBtn) stepFwdBtn.onclick = () => { pauseReplayMovie(); stepReplayMovie(1); };
  if (stepStartBtn) stepStartBtn.onclick = () => { pauseReplayMovie(); renderReplayMovieStep(0); };
  if (stepEndBtn) stepEndBtn.onclick = () => { pauseReplayMovie(); renderReplayMovieStep(replayMovieState.actions.length - 1); };

  if (speedBtn) {
    speedBtn.onclick = () => {
      const speeds = [0.5, 1, 2, 4];
      const nextIdx = (speeds.indexOf(replayMovieState.speed) + 1) % speeds.length;
      replayMovieState.speed = speeds[nextIdx];
      speedBtn.innerText = `⚡ ${replayMovieState.speed}x`;
      if (replayMovieState.isPlaying) {
        startReplayMovieTimer();
      }
    };
  }

  if (slider) {
    slider.oninput = (e) => {
      pauseReplayMovie();
      renderReplayMovieStep(parseInt(e.target.value));
    };
  }
}

function toggleReplayPlayPause() {
  if (replayMovieState.isPlaying) {
    pauseReplayMovie();
  } else {
    if (replayMovieState.currentStep >= replayMovieState.actions.length - 1) {
      replayMovieState.currentStep = 0;
    }
    playReplayMovie();
  }
}

function playReplayMovie() {
  replayMovieState.isPlaying = true;
  const playBtn = document.getElementById('replay-play-pause-btn');
  if (playBtn) {
    playBtn.innerText = '⏸️ Pausar';
    playBtn.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
  }
  startReplayMovieTimer();
}

function pauseReplayMovie() {
  replayMovieState.isPlaying = false;
  if (replayMovieState.timer) {
    clearInterval(replayMovieState.timer);
    replayMovieState.timer = null;
  }
  const playBtn = document.getElementById('replay-play-pause-btn');
  if (playBtn) {
    playBtn.innerText = '▶️ Reproducir';
    playBtn.style.background = '';
  }
}

function startReplayMovieTimer() {
  if (replayMovieState.timer) clearInterval(replayMovieState.timer);
  const baseInterval = 1200;
  const interval = baseInterval / replayMovieState.speed;
  replayMovieState.timer = setInterval(() => {
    if (replayMovieState.currentStep < replayMovieState.actions.length - 1) {
      stepReplayMovie(1);
    } else {
      pauseReplayMovie();
    }
  }, interval);
}

function stepReplayMovie(delta) {
  const nextStep = Math.max(0, Math.min(replayMovieState.actions.length - 1, replayMovieState.currentStep + delta));
  renderReplayMovieStep(nextStep);
}

function renderReplayMovieStep(stepIndex) {
  if (!replayMovieState.replay || !replayMovieState.renderer) return;
  replayMovieState.currentStep = stepIndex;

  const actions = replayMovieState.actions;
  const currentAction = actions[stepIndex];
  const tilesMap = new Map();

  // Reconstruct board up to stepIndex
  for (let i = 0; i <= stepIndex; i++) {
    const act = actions[i];
    if (!act || !act.details) continue;

    if (act.type === 'start_tile' || act.type === 'place_tile') {
      const key = `${act.details.x},${act.details.y}`;
      const tileImage = act.details.tileImage || (act.details.tile ? act.details.tile.image : `assets/tiles/${act.details.tileId || 'base_21_00'}.png`);
      tilesMap.set(key, {
        x: act.details.x,
        y: act.details.y,
        rotation: act.details.rotation || 0,
        tile: act.details.tile || { id: act.details.tileId, image: tileImage },
        placedBy: act.playerId,
        meeple: null
      });
    } else if (act.type === 'place_meeple') {
      const key = `${act.details.x},${act.details.y}`;
      const placed = tilesMap.get(key);
      if (placed) {
        placed.meeple = {
          player: act.playerId,
          color: act.details.color || act.playerColor || 'red',
          segmentId: act.details.segmentId,
          pos: act.details.segmentPos || { x: 0.5, y: 0.5 }
        };
      }
    } else if (act.type === 'remove_meeple') {
      const key = `${act.details.x},${act.details.y}`;
      const placed = tilesMap.get(key);
      if (placed) {
        placed.meeple = null;
      }
    }
  }

  const board = {
    tiles: Array.from(tilesMap.values())
  };

  replayMovieState.renderer.updateState({
    board,
    validPlacements: [],
    currentTile: null,
    currentRotation: 0,
    turnPhase: 'ended',
    lastPlacedPos: currentAction?.details ? { x: currentAction.details.x, y: currentAction.details.y } : null,
    segments: [],
    isMyTurn: false
  });

  // Update UI controls
  const slider = document.getElementById('replay-timeline-slider');
  const currentLabel = document.getElementById('replay-current-turn-label');
  const badge = document.getElementById('replay-turn-badge');
  const desc = document.getElementById('replay-action-desc');

  if (slider) slider.value = stepIndex;
  if (currentLabel) currentLabel.innerText = `Jugada ${stepIndex + 1}`;
  if (badge) badge.innerText = `Turno ${currentAction?.turn || stepIndex + 1} / ${replayMovieState.replay.totalTurns || actions.length}`;

  if (desc) {
    if (!currentAction) {
      desc.innerHTML = 'Inicio de la crónica.';
    } else {
      const pColor = currentAction.playerColor ? `var(--color-${currentAction.playerColor}, var(--accent-gold))` : 'var(--accent-gold)';
      let text = '';
      if (currentAction.type === 'start_tile') text = `Loseta de inicio colocada en (0, 0)`;
      else if (currentAction.type === 'place_tile') text = `Colocó loseta en (${currentAction.details.x}, ${currentAction.details.y}) a ${currentAction.details.rotation}°`;
      else if (currentAction.type === 'place_meeple') text = `Ubicó un seguidor (${currentAction.details.segmentType || 'Estructura'})`;
      else if (currentAction.type === 'remove_meeple') text = `Deshizo la colocación de seguidor`;
      else if (currentAction.type === 'pass_meeple') text = `Pasó turno sin colocar seguidor`;
      else if (currentAction.type === 'feature_scored') text = `¡Estructura completada! Puntos otorgados.`;
      else text = currentAction.type;

      // Build score info
      let scoresHtml = '';
      const replay = replayMovieState.replay;
      if (currentAction.scoresBefore && replay.players) {
        const scoreEntries = replay.players.map(p => {
          const pts = currentAction.scoresBefore[p.id] || 0;
          const delta = (currentAction.scoresAfter && currentAction.scoresAfter[p.id] !== undefined)
            ? (currentAction.scoresAfter[p.id] - pts) : 0;
          const meeples = currentAction.meeplesState ? (currentAction.meeplesState[p.id] ?? '?') : '?';
          return `<span style="margin-right:10px; font-size:0.8rem;">
            <span style="color:var(--color-${p.color},#aaa);">●</span>
            ${escapeHtml(p.name.split(' ')[0])}: <strong>${pts}</strong>${delta > 0 ? ` <span style="color:#22c55e;">+${delta}</span>` : ''}
            <span style="color:#94a3b8;">(🪆${meeples})</span>
          </span>`;
        }).join('');
        scoresHtml = `<div style="margin-top:6px; display:flex; flex-wrap:wrap;">${scoreEntries}</div>`;
      }

      // Deck remaining
      let deckHtml = '';
      if (currentAction.deckRemaining !== null && currentAction.deckRemaining !== undefined) {
        deckHtml = `<span style="font-size:0.78rem; color:#64748b; margin-left:6px;">🃏 ${currentAction.deckRemaining} losetas restantes</span>`;
      }

      // Legal placements count
      let legalHtml = '';
      if (currentAction.legalPlacements && currentAction.legalPlacements.length > 0) {
        legalHtml = `<span style="font-size:0.78rem; color:#64748b; margin-left:6px;">📍 ${currentAction.legalPlacements.length} posiciones legales</span>`;
      }

      // Bot reasoning
      let reasoningHtml = '';
      if (currentAction.reasoning && currentAction.isBot) {
        const r = currentAction.reasoning;
        const topCandidates = (r.topCandidates || []).slice(0, 3);
        const candidatesHtml = topCandidates.map((c, i) =>
          `<div style="font-size:0.75rem; color:${i === 0 ? '#22c55e' : '#94a3b8'}; padding:1px 4px;">
            ${i + 1}. (${c.x},${c.y}) rot ${c.rotation} — ${typeof c.score === 'number' ? c.score.toFixed(1) : '?'} pts
          </div>`
        ).join('');
        reasoningHtml = `
          <div style="margin-top:8px; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.3); border-radius:6px; padding:6px 10px;">
            <div style="font-size:0.75rem; color:#a78bfa; font-weight:600; margin-bottom:4px;">🤖 Razonamiento: ${escapeHtml(r.decision || '')}</div>
            ${candidatesHtml}
          </div>`;
      }

      desc.innerHTML = `
        <strong style="color:${pColor}; font-size:0.95rem;">${escapeHtml(currentAction.playerName || 'Sistema')}:</strong>
        <span style="margin-left:6px;">${escapeHtml(text)}</span>
        ${deckHtml}${legalHtml}
        ${scoresHtml}
        ${reasoningHtml}
      `;
    }
  }
}

// Open Replay & AI Chronicle Modal
function openReplayModal(replayId) {
  const modal = document.getElementById('replay-modal');
  const metaEl = document.getElementById('replay-modal-meta');
  const loadingEl = document.getElementById('replay-analysis-loading');
  const textEl = document.getElementById('replay-analysis-text');
  if (!modal) return;

  modal.style.display = 'flex';
  if (loadingEl) loadingEl.style.display = 'block';
  if (textEl) {
    textEl.style.display = 'none';
    textEl.innerHTML = '';
  }

  fetch(`/api/replays/${replayId}`)
    .then(res => res.json())
    .then(replay => {
      if (metaEl) {
        metaEl.innerHTML = `
          <div style="background:var(--surface); border:1px solid var(--border-iron); border-radius:6px; padding:10px 14px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; align-items:center;">
              <strong style="color:var(--primary); font-size:1.05rem;">${escapeHtml(replay.name)}</strong>
              <span style="font-size:0.85rem; color:var(--text-muted);">${new Date(replay.startedAt).toLocaleString()} • ${replay.durationMinutes} min • ${replay.totalTurns} turnos</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
              ${(replay.players || []).map(p => `
                <span class="replay-player-pill ${p.isWinner ? 'winner' : ''}">
                  ${p.isWinner ? '👑 ' : ''}${escapeHtml(p.name)} (${p.score} pts)
                </span>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (replay.analysis) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (textEl) {
          textEl.style.display = 'block';
          textEl.innerHTML = renderMarkdown(replay.analysis);
        }
      } else {
        // Trigger AI analysis on demand
        fetch(`/api/ai/analyze-replay/${replayId}`, { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (textEl) {
              textEl.style.display = 'block';
              if (data.success && data.analysis) {
                textEl.innerHTML = renderMarkdown(data.analysis);
              } else {
                textEl.innerHTML = `<p style="color:#ef4444;">⚠️ No se pudo generar el análisis: ${data.error || 'Error de conexión'}</p>`;
              }
            }
          })
          .catch(err => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (textEl) {
              textEl.style.display = 'block';
              textEl.innerHTML = '<p style="color:#ef4444;">⚠️ Error de comunicación con la IA Gemini.</p>';
            }
          });
      }
    })
    .catch(err => {
      if (loadingEl) loadingEl.style.display = 'none';
      if (textEl) {
        textEl.style.display = 'block';
        textEl.innerHTML = '<p style="color:#ef4444;">⚠️ Error cargando los datos de la partida.</p>';
      }
    });
}
window.openReplayModal = openReplayModal;

const closeReplayModalBtn = document.getElementById('close-replay-modal-btn');
if (closeReplayModalBtn) {
  closeReplayModalBtn.addEventListener('click', () => {
    const modal = document.getElementById('replay-modal');
    if (modal) modal.style.display = 'none';
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================================================
// MEDIEVAL ROULETTE OF DESTINY (STARTING PLAYER SELECTION)
// ==========================================================================
let isRouletteSpinning = false;

function showStartingPlayerRoulette(room, onComplete) {
  const modal = document.getElementById('starter-roulette-modal');
  const canvas = document.getElementById('roulette-wheel-canvas');
  const winnerBox = document.getElementById('roulette-winner-box');
  const winnerNameEl = document.getElementById('roulette-winner-name');
  const winnerDescEl = document.getElementById('roulette-winner-desc');

  if (!modal || !canvas || !room || !room.players || room.players.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  isRouletteSpinning = true;
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  if (winnerBox) winnerBox.style.display = 'none';

  const ctx = canvas.getContext('2d');
  const numPlayers = room.players.length;
  const targetIndex = (room.turnIndex !== undefined && room.turnIndex >= 0) ? room.turnIndex : 0;
  const winnerPlayer = room.players[targetIndex] || room.players[0];

  const colorHexMap = {
    red: '#c0392b',
    blue: '#2980b9',
    green: '#27ae60',
    yellow: '#d4ac0d',
    black: '#2c3e50',
    pink: '#d81b60'
  };

  const sliceAngle = (2 * Math.PI) / numPlayers;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 14;

  const fullRotations = 5;
  const finalAngleOffset = fullRotations * 2 * Math.PI - (Math.PI / 2) - ((targetIndex + 0.5) * sliceAngle);

  const startTime = performance.now();
  const duration = 2800;
  let lastSoundSlice = -1;

  function drawWheel(currentAngle) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer Wooden / Gold Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#4a3520';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    // Slices
    for (let i = 0; i < numPlayers; i++) {
      const p = room.players[i];
      const startA = currentAngle + i * sliceAngle;
      const endA = startA + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startA, endA);
      ctx.closePath();

      const baseCol = colorHexMap[p.color] || '#7f8c8d';
      ctx.fillStyle = baseCol;
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#d4af37';
      ctx.stroke();

      // Text and Icon
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startA + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Cinzel", "Cinzel Decorative", Georgia, serif';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;

      const pAvatar = window.profileManager ? window.profileManager.getAvatar(p.avatar) : { icon: '👤' };
      const displayName = `${p.isBot ? '🤖' : pAvatar.icon} ${p.name.length > 9 ? p.name.substring(0, 8) + '…' : p.name}`;
      ctx.fillText(displayName, radius - 16, 5);
      ctx.restore();
    }

    // Outer Gold Studs
    const totalStuds = Math.max(12, numPlayers * 3);
    for (let i = 0; i < totalStuds; i++) {
      const studA = currentAngle + (i * 2 * Math.PI) / totalStuds;
      const sx = cx + (radius + 4) * Math.cos(studA);
      const sy = cy + (radius + 4) * Math.sin(studA);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#f1c40f';
      ctx.fill();
    }

    ctx.restore();
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const easedProgress = easeOutCubic(progress);
    const currentAngle = easedProgress * finalAngleOffset;

    const currentSlice = Math.floor((-Math.PI / 2 - currentAngle) / sliceAngle) % numPlayers;
    if (currentSlice !== lastSoundSlice && progress < 0.95) {
      lastSoundSlice = currentSlice;
      audio.playClick();
    }

    drawWheel(currentAngle);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isRouletteSpinning = false;
      if (winnerBox) {
        winnerBox.style.display = 'block';
        if (winnerNameEl) {
          const wAvatar = window.profileManager ? window.profileManager.getAvatar(winnerPlayer.avatar) : { icon: '👑' };
          winnerNameEl.innerHTML = `${winnerPlayer.isBot ? '🤖' : wAvatar.icon} <span style="color:var(--color-${winnerPlayer.color})">${escapeHtml(winnerPlayer.name)}</span>`;
        }
        if (winnerDescEl) {
          winnerDescEl.innerText = `Ha sido elegido por el destino para abrir el reino y colocar la primera loseta.`;
        }
      }

      audio.playTurnSound(winnerPlayer.sound || 'horn');

      setTimeout(() => {
        modal.style.transition = 'opacity 0.4s ease';
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.style.display = 'none';
          modal.style.opacity = '1';
          if (onComplete) onComplete();
        }, 400);
      }, 1600);
    }
  }

  requestAnimationFrame(animate);
}
window.showStartingPlayerRoulette = showStartingPlayerRoulette;
