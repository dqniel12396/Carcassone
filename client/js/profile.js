// Carcassonne Player Profile, Auth, Admin & Stats Manager

const MEDIEVAL_AVATARS = [
  { id: 'king', icon: '👑', name: 'Rey Arturo', title: 'Monarca de Carcassonne' },
  { id: 'queen', icon: '👸', name: 'Reina Guinevere', title: 'Soberana del Reino' },
  { id: 'knight', icon: '🛡️', name: 'Caballero Lancelot', title: 'Defensor de las Fortalezas' },
  { id: 'wizard', icon: '🧙', name: 'Mago Merlín', title: 'Erudito de la Magia' },
  { id: 'archer', icon: '🏹', name: 'Arquera Robin', title: 'Guardiana de los Bosques' },
  { id: 'monk', icon: '⛪', name: 'Fray Guillermo', title: 'Abad del Monasterio' },
  { id: 'farmer', icon: '🌾', name: 'Granjera Elspeth', title: 'Señora de las Praderas' },
  { id: 'bandit', icon: '🗡️', name: 'Bandido Sombra', title: 'Amo de las Calzadas' },
  { id: 'baron', icon: '🏰', name: 'Barón de Foix', title: 'Constructor de Murallas' },
  { id: 'scout', icon: '🦅', name: 'Explorador Halcón', title: 'Vigía de las Colinas' },
  { id: 'paladin', icon: '⚔️', name: 'Paladín Roland', title: 'Campeón de la Orden' },
  { id: 'hunter', icon: '🐺', name: 'Cazadora Freya', title: 'Rastreadora del Norte' }
];

window.openAuthModal = function() {
  const pModal = document.getElementById('profile-modal');
  if (pModal) pModal.style.setProperty('display', 'none', 'important');
  const aModal = document.getElementById('admin-panel-modal');
  if (aModal) aModal.style.setProperty('display', 'none', 'important');
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.style.setProperty('display', 'flex', 'important');
    authModal.style.setProperty('visibility', 'visible', 'important');
    authModal.style.setProperty('opacity', '1', 'important');
    authModal.style.setProperty('z-index', '999999', 'important');
    const loginTab = document.getElementById('auth-tab-login-btn');
    const regTab = document.getElementById('auth-tab-reg-btn');
    const loginForm = document.getElementById('auth-login-form');
    const regForm = document.getElementById('auth-register-form');
    if (loginTab) loginTab.classList.add('active');
    if (regTab) regTab.classList.remove('active');
    if (loginForm) {
      loginForm.classList.add('active');
      loginForm.style.setProperty('display', 'flex', 'important');
    }
    if (regForm) {
      regForm.classList.remove('active');
      regForm.style.setProperty('display', 'none', 'important');
    }
    setTimeout(() => {
      const uInput = document.getElementById('auth-login-username');
      if (uInput) uInput.focus();
    }, 60);
  }
};

window.closeAuthModal = function() {
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.style.setProperty('display', 'none', 'important');
  }
};

window.openProfileModal = function() {
  window.closeAuthModal();
  const aModal = document.getElementById('admin-panel-modal');
  if (aModal) aModal.style.setProperty('display', 'none', 'important');
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.style.setProperty('display', 'flex', 'important');
    if (window.profileManager) window.profileManager.updateUI();
  }
};

window.openAdminModal = function() {
  if (window.profileManager) {
    window.profileManager.openAdminPanel();
  }
};

class ProfileManager {
  constructor() {
    this.token = localStorage.getItem('carcassonne_auth_token') || null;
    this.currentUser = null;
    this.profile = this.loadLocalProfile();
    this.adminUsersCache = [];
  }

  loadLocalProfile() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem('carcassonne_player_profile'));
    } catch (e) {}

    const defaultName = localStorage.getItem('carcassonne_player_name') || ('Noble ' + Math.floor(Math.random() * 900 + 100));
    const defaultColor = localStorage.getItem('carcassonne_preferred_color') || 'yellow';

    if (!saved) {
      saved = {
        id: localStorage.getItem('carcassonne_player_id') || ('usr_' + Math.random().toString(36).substring(2, 9)),
        name: defaultName,
        avatar: 'king',
        color: defaultColor,
        stats: {
          gamesPlayed: 0,
          wins: 0,
          maxScore: 0,
          citiesCompleted: 0,
          roadsCompleted: 0,
          monasteriesCompleted: 0
        },
        createdAt: Date.now()
      };
      this.saveLocalProfile(saved);
    }

    // Sync legacy keys
    localStorage.setItem('carcassonne_player_id', saved.id);
    localStorage.setItem('carcassonne_player_name', saved.name);
    localStorage.setItem('carcassonne_preferred_color', saved.color);

    return saved;
  }

  saveLocalProfile(data = this.profile) {
    this.profile = data;
    try {
      localStorage.setItem('carcassonne_player_profile', JSON.stringify(this.profile));
      localStorage.setItem('carcassonne_player_id', this.profile.id);
      localStorage.setItem('carcassonne_player_name', this.profile.name);
      localStorage.setItem('carcassonne_preferred_color', this.profile.color);
    } catch (e) {}

    this.updateUI();
  }

  isLoggedIn() {
    return !!(this.token && this.currentUser);
  }

  isAdmin() {
    return !!(this.isLoggedIn() && this.currentUser && this.currentUser.role === 'admin');
  }

  getName() {
    if (this.currentUser) return this.currentUser.displayName || this.currentUser.username || this.profile.name;
    return this.profile?.name || localStorage.getItem('carcassonne_player_name') || 'Comandante';
  }

  getColor() {
    if (this.currentUser) return this.currentUser.color || this.profile.color;
    return this.profile?.color || localStorage.getItem('carcassonne_preferred_color') || 'yellow';
  }

  getAvatar(avatarId) {
    const id = avatarId || (this.currentUser ? this.currentUser.avatar : (this.profile ? this.profile.avatar : 'king'));
    return MEDIEVAL_AVATARS.find(a => a.id === id) || MEDIEVAL_AVATARS[0];
  }

  async setName(name) {
    const clean = (name || '').trim();
    if (clean) {
      this.profile.name = clean;
      this.saveLocalProfile();
      if (this.isLoggedIn()) {
        await this.updateRemoteProfile({ displayName: clean });
      }
    }
  }

  async setAvatar(avatarId) {
    if (MEDIEVAL_AVATARS.some(a => a.id === avatarId)) {
      this.profile.avatar = avatarId;
      this.saveLocalProfile();
      if (this.isLoggedIn()) {
        await this.updateRemoteProfile({ avatar: avatarId });
      }
    }
  }

  async setColor(color) {
    this.profile.color = color;
    this.saveLocalProfile();
    if (this.isLoggedIn()) {
      await this.updateRemoteProfile({ color: color });
    }
  }

  async updateRemoteProfile(fields) {
    if (!this.token) return;
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(fields)
      });
      const data = await res.json();
      if ((data.ok || data.success) && data.user) {
        this.currentUser = data.user;
        this.syncProfileWithUser(data.user);
      }
    } catch (err) {
      console.warn('Error updating remote profile:', err);
    }
  }

  syncProfileWithUser(user) {
    this.profile.id = user.id;
    this.profile.name = user.displayName || user.username;
    this.profile.avatar = user.avatar || 'king';
    this.profile.color = user.color || 'yellow';
    this.profile.stats = user.stats || {
      gamesPlayed: 0,
      wins: 0,
      maxScore: 0,
      citiesCompleted: 0,
      roadsCompleted: 0,
      monasteriesCompleted: 0
    };
    this.saveLocalProfile(this.profile);
  }

  async checkSession() {
    if (!this.token) {
      this.updateUI();
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if ((data.ok || data.success) && data.user) {
          this.currentUser = data.user;
          this.syncProfileWithUser(data.user);
        }
      } else if (res.status === 401) {
        // Only clear token if server definitively rejects it with 401
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('carcassonne_auth_token');
      }
    } catch (err) {
      console.warn('Session check failed (servidor reiniciando o sin red):', err);
      // Mantener el token guardado en caso de reinicio de servidor o corte temporal
    }
    this.updateUI();
  }

  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.ok && !data.success) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }

    this.token = data.token;
    this.currentUser = data.user;
    localStorage.setItem('carcassonne_auth_token', this.token);
    this.syncProfileWithUser(data.user);
    this.updateUI();
    return data.user;
  }

  async register(username, password, displayName, avatar, color) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        displayName: displayName || username,
        avatar: avatar || this.profile.avatar || 'king',
        color: color || this.profile.color || 'yellow'
      })
    });
    const data = await res.json();
    if (!data.ok && !data.success) {
      throw new Error(data.error || 'Error al registrar usuario');
    }

    this.token = data.token;
    this.currentUser = data.user;
    localStorage.setItem('carcassonne_auth_token', this.token);
    this.syncProfileWithUser(data.user);
    this.updateUI();
    return data.user;
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('carcassonne_auth_token');
    this.loadLocalProfile();
    this.updateUI();
  }

  async recordGameFinished(myScore, isWinner, featuresScored = []) {
    this.profile.stats.gamesPlayed = (this.profile.stats.gamesPlayed || 0) + 1;
    if (isWinner) {
      this.profile.stats.wins = (this.profile.stats.wins || 0) + 1;
    }
    if (myScore > (this.profile.stats.maxScore || 0)) {
      this.profile.stats.maxScore = myScore;
    }

    let cities = 0, roads = 0;
    if (Array.isArray(featuresScored)) {
      featuresScored.forEach(feat => {
        if (feat.type === 'city') {
          this.profile.stats.citiesCompleted = (this.profile.stats.citiesCompleted || 0) + 1;
          cities++;
        }
        if (feat.type === 'road') {
          this.profile.stats.roadsCompleted = (this.profile.stats.roadsCompleted || 0) + 1;
          roads++;
        }
      });
    }

    this.saveLocalProfile();

    if (this.isLoggedIn()) {
      try {
        await fetch('/api/auth/sync-stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({
            score: myScore,
            isWinner: isWinner,
            citiesCompleted: cities,
            roadsCompleted: roads
          })
        });
      } catch (err) {
        console.warn('Could not sync stats to cloud server:', err);
      }
    }
  }

  updateUI() {
    const avatarObj = this.getAvatar();
    const isLogged = this.isLoggedIn();
    const isAdmin = this.isAdmin();

    // 1. Lobby Header Profile Card
    const lobbyAvatarIcon = document.getElementById('lobby-profile-avatar-icon');
    const lobbyNameText = document.getElementById('lobby-profile-name-text');
    const lobbyTitleText = document.getElementById('lobby-profile-title-text');
    const lobbyStatsSummary = document.getElementById('lobby-profile-stats-summary');
    const lobbyAuthBadge = document.getElementById('lobby-auth-status-badge');
    const lobbyAuthBtn = document.getElementById('lobby-auth-action-btn');

    if (lobbyAvatarIcon) lobbyAvatarIcon.textContent = avatarObj.icon;
    if (lobbyNameText) lobbyNameText.textContent = this.getName();
    if (lobbyTitleText) lobbyTitleText.textContent = avatarObj.title;

    if (lobbyAuthBadge) {
      if (isLogged) {
        if (isAdmin) {
          lobbyAuthBadge.className = 'auth-pill-badge logged';
          lobbyAuthBadge.style.borderColor = '#f1c40f';
          lobbyAuthBadge.style.color = '#f1c40f';
          lobbyAuthBadge.innerHTML = '👑 Admin: @' + this.currentUser.username;
          lobbyAuthBadge.title = 'Sesión iniciada con Rango de Administrador Real';
        } else {
          lobbyAuthBadge.className = 'auth-pill-badge logged';
          lobbyAuthBadge.style.borderColor = '';
          lobbyAuthBadge.style.color = '';
          lobbyAuthBadge.innerHTML = '🛡️ @' + this.currentUser.username;
          lobbyAuthBadge.title = `Conectado como @${this.currentUser.username}`;
        }
      } else {
        lobbyAuthBadge.className = 'auth-pill-badge guest';
        lobbyAuthBadge.style.borderColor = '';
        lobbyAuthBadge.style.color = '';
        lobbyAuthBadge.innerHTML = '👤 Invitado';
        lobbyAuthBadge.title = 'Jugando en modo local/invitado';
      }
    }

    if (lobbyAuthBtn) {
      if (isLogged) {
        lobbyAuthBtn.textContent = '🚪 Cerrar Sesión';
        lobbyAuthBtn.className = 'btn btn-xs btn-outline-danger';
        lobbyAuthBtn.onclick = async () => {
          const ok = window.showMedievalConfirm ? await window.showMedievalConfirm({
            title: '¿Cerrar Sesión?',
            message: `¿Deseas cerrar la sesión del comandante @${this.currentUser.username}?`,
            icon: '🚪',
            confirmText: '🚪 Cerrar Sesión',
            confirmClass: 'btn-danger'
          }) : confirm('¿Deseas cerrar la sesión?');
          if (ok) {
            this.logout();
          }
        };
      } else {
        lobbyAuthBtn.textContent = '🔑 Iniciar Sesión';
        lobbyAuthBtn.className = 'btn btn-sm btn-primary open-auth-modal-btn';
        lobbyAuthBtn.onclick = (e) => {
          if (e) e.preventDefault();
          window.openAuthModal();
        };
      }
    }

    // Admin Navigation Tab & Modal Button
    const adminNavTab = document.getElementById('tab-btn-admin');
    const profileAdminBtn = document.getElementById('profile-modal-admin-btn');
    if (adminNavTab) adminNavTab.style.display = isAdmin ? 'inline-flex' : 'none';
    if (profileAdminBtn) profileAdminBtn.style.display = isAdmin ? 'inline-block' : 'none';

    if (lobbyStatsSummary) {
      const stats = this.profile.stats || {};
      const winRate = stats.gamesPlayed > 0 
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;
      lobbyStatsSummary.textContent = `🏆 ${stats.wins || 0} Victorias • 🎮 ${stats.gamesPlayed || 0} Partidas (${winRate}%) • 🌟 Récord: ${stats.maxScore || 0} pts`;
    }

    // 2. Input Fields in Lobby
    const nameInput = document.getElementById('player-name-input');
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = this.getName();
    }

    const colorSelect = document.getElementById('preferred-color-select');
    if (colorSelect) {
      colorSelect.value = this.getColor();
    }

    // 3. Profile Modal Elements
    const modalAvatarIcon = document.getElementById('modal-profile-avatar-icon');
    const modalNameInput = document.getElementById('modal-profile-name-input');
    const modalTitleText = document.getElementById('modal-profile-title-text');
    const modalColorSelect = document.getElementById('modal-profile-color-select');

    if (modalAvatarIcon) modalAvatarIcon.textContent = avatarObj.icon;
    if (modalNameInput && document.activeElement !== modalNameInput) modalNameInput.value = this.getName();
    if (modalTitleText) modalTitleText.textContent = avatarObj.title;
    if (modalColorSelect) modalColorSelect.value = this.getColor();

    // Modal Account Bar
    const modalAuthIcon = document.getElementById('profile-modal-auth-icon');
    const modalAuthTitle = document.getElementById('profile-modal-auth-title');
    const modalAuthDesc = document.getElementById('profile-modal-auth-desc');
    const modalLoginBtn = document.getElementById('profile-modal-login-btn');
    const modalLogoutBtn = document.getElementById('profile-modal-logout-btn');

    if (modalAuthIcon) modalAuthIcon.textContent = isLogged ? (isAdmin ? '👑' : '🛡️') : '👤';
    if (modalAuthTitle) modalAuthTitle.textContent = isLogged ? `Conectado como @${this.currentUser.username} (${isAdmin ? 'Administrador' : 'Comandante'})` : 'Modo Invitado (Sin Guardar en Nube)';
    if (modalAuthDesc) {
      modalAuthDesc.textContent = isLogged 
        ? 'Tus estadísticas y rango se sincronizan automáticamente con el servidor del reino.' 
        : 'Tus datos solo residen en este navegador. Inicia sesión o regístrate para que tus récords aparezcan en la clasificación.';
    }
    if (modalLoginBtn) modalLoginBtn.style.display = isLogged ? 'none' : 'inline-block';
    if (modalLogoutBtn) modalLogoutBtn.style.display = isLogged ? 'inline-block' : 'none';

    // Stats Grid
    const stGames = document.getElementById('stat-games-played');
    const stWins = document.getElementById('stat-wins-count');
    const stWinRate = document.getElementById('stat-win-rate');
    const stMaxScore = document.getElementById('stat-max-score');
    const stCities = document.getElementById('stat-cities-count');
    const stRoads = document.getElementById('stat-roads-count');

    const stats = this.profile.stats || {};
    const winRate = stats.gamesPlayed > 0 
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0;

    if (stGames) stGames.textContent = stats.gamesPlayed || 0;
    if (stWins) stWins.textContent = stats.wins || 0;
    if (stWinRate) stWinRate.textContent = `${winRate}%`;
    if (stMaxScore) stMaxScore.textContent = stats.maxScore || 0;
    if (stCities) stCities.textContent = stats.citiesCompleted || 0;
    if (stRoads) stRoads.textContent = stats.roadsCompleted || 0;

    // Highlight selected avatar in grid
    const avatarCards = document.querySelectorAll('.avatar-select-card');
    avatarCards.forEach(card => {
      const cardId = card.getAttribute('data-avatar-id');
      card.classList.toggle('active', cardId === this.profile.avatar);
    });
  }

  // ==================== ADMIN PANEL UI ====================

  async openAdminPanel() {
    if (!this.isAdmin()) {
      alert('Se requiere rango de Administrador');
      return;
    }
    const adminModal = document.getElementById('admin-panel-modal');
    if (adminModal) adminModal.style.display = 'flex';
    await this.fetchAndRenderAdminUsers();
  }

  async fetchAndRenderAdminUsers() {
    const container = document.getElementById('admin-users-list-container');
    if (!container) return;
    container.innerHTML = '<div class="empty-hint">Cargando comandantes...</div>';

    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      if (!data.ok && !data.success) {
        container.innerHTML = `<div class="auth-alert-msg error">${data.error || 'Error al cargar usuarios'}</div>`;
        return;
      }

      this.adminUsersCache = data.users || [];
      this.renderAdminUsersList(this.adminUsersCache);
    } catch (err) {
      container.innerHTML = `<div class="auth-alert-msg error">Error de conexión: ${err.message}</div>`;
    }
  }

  renderAdminUsersList(users) {
    const container = document.getElementById('admin-users-list-container');
    if (!container) return;

    if (!users || users.length === 0) {
      container.innerHTML = '<div class="empty-hint">No se encontraron usuarios registrados.</div>';
      return;
    }

    let html = `
      <table class="admin-users-table">
        <thead>
          <tr>
            <th>Comandante</th>
            <th>Rango</th>
            <th>Partidas / Victorias</th>
            <th>Puntos Máx.</th>
            <th>Registro</th>
            <th style="text-align:right;">Acciones de Rey</th>
          </tr>
        </thead>
        <tbody>
    `;

    users.forEach(u => {
      const av = this.getAvatar(u.avatar);
      const regDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
      const stats = u.stats || {};
      const isAdmin = u.role === 'admin';

      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">${av.icon}</span>
              <div>
                <strong>${u.displayName || u.username}</strong>
                <span style="display:block; font-size:0.75rem; color:var(--text-muted);">@${u.username}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="role-badge ${u.role || 'player'}">${u.role === 'admin' ? '👑 Admin' : '🛡️ Jugador'}</span>
          </td>
          <td>
            <span>🎮 ${stats.gamesPlayed || 0} • 🏆 ${stats.wins || 0}</span>
          </td>
          <td>
            <span style="color:var(--accent-gold); font-weight:700;">${stats.highScore || stats.maxScore || 0} pts</span>
          </td>
          <td>
            <span style="font-size:0.8rem; color:var(--text-muted);">${regDate}</span>
          </td>
          <td style="text-align:right;">
            <div class="admin-actions-cell" style="justify-content:flex-end;">
              <button class="btn btn-xs btn-primary btn-admin-change-pass" data-userid="${u.id}" data-username="${u.username}" title="Cambiar Contraseña">
                🔑 Cambiar Clave
              </button>
              <button class="btn btn-xs btn-outline-gold btn-admin-reset-link" data-userid="${u.id}" data-username="${u.username}" title="Generar Enlace Temporal">
                🔗 Link Reset
              </button>
              ${!isAdmin ? `
                <button class="btn btn-xs btn-outline-danger btn-admin-delete-user" data-userid="${u.id}" data-username="${u.username}" title="Eliminar Usuario">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Attach actions
    container.querySelectorAll('.btn-admin-change-pass').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-userid');
        const uname = btn.getAttribute('data-username');
        this.openAdminChangePassModal(uid, uname);
      });
    });

    container.querySelectorAll('.btn-admin-reset-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-userid');
        const uname = btn.getAttribute('data-username');
        this.createAdminResetLink(uid, uname);
      });
    });

    container.querySelectorAll('.btn-admin-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.getAttribute('data-userid');
        const uname = btn.getAttribute('data-username');
        const ok = window.showMedievalConfirm ? await window.showMedievalConfirm({
          title: '¿Desterrar Comandante?',
          message: `¿Estás seguro de desterrar (eliminar) permanentemente al comandante @${uname}? Esta acción no se puede revertir.`,
          icon: '⚔️',
          confirmText: '⚔️ Desterrar Usuario',
          confirmClass: 'btn-danger'
        }) : confirm(`¿Estás seguro de desterrar a @${uname}?`);
        if (ok) {
          await this.adminDeleteUser(uid);
        }
      });
    });
  }

  openAdminChangePassModal(userId, username) {
    const modal = document.getElementById('admin-change-pass-modal');
    const uInput = document.getElementById('admin-change-pass-userid');
    const uName = document.getElementById('admin-change-pass-username');
    const msg = document.getElementById('admin-change-pass-msg');
    const newPass = document.getElementById('admin-change-pass-newpass');

    if (uInput) uInput.value = userId;
    if (uName) uName.textContent = '@' + username;
    if (msg) msg.style.display = 'none';
    if (newPass) newPass.value = '';
    if (modal) modal.style.display = 'flex';
  }

  async createAdminResetLink(userId, username) {
    try {
      const res = await fetch('/api/admin/create-reset-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ targetUserId: userId, expiryHours: 24 })
      });
      const data = await res.json();
      if (!data.ok && !data.success) {
        if (window.showToast) showToast(data.error || 'Error al generar enlace', 'danger');
        return;
      }

      const modal = document.getElementById('admin-reset-link-modal');
      const uName = document.getElementById('admin-reset-link-user');
      const input = document.getElementById('admin-reset-link-input');
      const feedback = document.getElementById('admin-copy-feedback');

      if (uName) uName.textContent = '@' + username;
      if (input) input.value = data.fullLink;
      if (feedback) feedback.style.display = 'none';
      if (modal) modal.style.display = 'flex';
    } catch (err) {
      if (window.showToast) showToast('Error: ' + err.message, 'danger');
    }
  }

  async adminDeleteUser(userId) {
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ targetUserId: userId })
      });
      const data = await res.json();
      if (!data.ok && !data.success) {
        if (window.showToast) showToast(data.error || 'Error al eliminar usuario', 'danger');
        return;
      }
      if (window.showToast) showToast('Usuario desterrado con éxito.', 'info');
      await this.fetchAndRenderAdminUsers();
    } catch (err) {
      if (window.showToast) showToast('Error: ' + err.message, 'danger');
    }
  }

  // ==================== RESET PASSWORD VIA URL TOKEN ====================

  async checkUrlResetToken() {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('resetToken');
    if (!resetToken) return;

    try {
      const res = await fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(resetToken)}`);
      const data = await res.json();
      if (!data.ok && !data.success) {
        if (window.showToast) showToast(`Enlace no válido: ${data.error || 'Caducado o ya utilizado'}`, 'danger');
        return;
      }

      const modal = document.getElementById('reset-password-modal');
      const uName = document.getElementById('user-reset-pass-username');
      if (uName) uName.textContent = `@${data.user.username} (${data.user.displayName || data.user.name})`;
      if (modal) modal.style.display = 'flex';

      const form = document.getElementById('user-reset-pass-form');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const p1 = document.getElementById('user-reset-new-password').value;
          const p2 = document.getElementById('user-reset-confirm-password').value;
          const msg = document.getElementById('user-reset-pass-msg');

          if (p1 !== p2) {
            if (msg) {
              msg.className = 'auth-alert-msg error';
              msg.textContent = 'Las contraseñas no coinciden';
              msg.style.display = 'block';
            }
            return;
          }

          try {
            const resetRes = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: resetToken, newPassword: p1 })
            });
            const resetData = await resetRes.json();
            if (!resetData.ok && !resetData.success) {
              if (msg) {
                msg.className = 'auth-alert-msg error';
                msg.textContent = resetData.error || 'Error al actualizar contraseña';
                msg.style.display = 'block';
              }
              return;
            }

            // Success: log in with new session token
            this.token = resetData.token;
            this.currentUser = resetData.user;
            localStorage.setItem('carcassonne_auth_token', this.token);
            this.syncProfileWithUser(resetData.user);
            this.updateUI();

            if (msg) {
              msg.className = 'auth-alert-msg success';
              msg.textContent = '¡Contraseña restablecida exitosamente! Entrando a la gran mesa...';
              msg.style.display = 'block';
            }

            setTimeout(() => {
              if (modal) modal.style.display = 'none';
              // Clean URL query
              window.history.replaceState({}, document.title, window.location.pathname);
            }, 1200);
          } catch (err) {
            if (msg) {
              msg.className = 'auth-alert-msg error';
              msg.textContent = err.message;
              msg.style.display = 'block';
            }
          }
        };
      }
    } catch (err) {
      console.warn('Reset token check error:', err);
    }
  }

  // ==================== INITIALIZATION ====================

  initModal() {
    const grid = document.getElementById('avatar-selection-grid');
    if (grid) {
      grid.innerHTML = '';
      MEDIEVAL_AVATARS.forEach(av => {
        const card = document.createElement('div');
        card.className = `avatar-select-card ${av.id === this.profile.avatar ? 'active' : ''}`;
        card.setAttribute('data-avatar-id', av.id);
        card.innerHTML = `
          <span class="avatar-icon">${av.icon}</span>
          <span class="avatar-name">${av.name}</span>
          <span class="avatar-role">${av.title}</span>
        `;
        card.addEventListener('click', () => {
          this.setAvatar(av.id);
          if (window.audio) audio.playClick();
        });
        grid.appendChild(card);
      });
    }

    const modalNameInput = document.getElementById('modal-profile-name-input');
    if (modalNameInput) {
      modalNameInput.addEventListener('change', (e) => this.setName(e.target.value));
    }

    const modalColorSelect = document.getElementById('modal-profile-color-select');
    if (modalColorSelect) {
      modalColorSelect.addEventListener('change', (e) => this.setColor(e.target.value));
    }

    // Global delegated click listener for all modal trigger buttons
    document.addEventListener('click', (e) => {
      const authTrigger = e.target.closest('.open-auth-modal-btn, #lobby-auth-action-btn, #profile-modal-login-btn');
      if (authTrigger) {
        if (!this.isLoggedIn() || authTrigger.id === 'profile-modal-login-btn' || authTrigger.classList.contains('open-auth-modal-btn') || authTrigger.id === 'lobby-auth-action-btn') {
          e.preventDefault();
          if (window.audio) audio.playClick();
          window.openAuthModal();
          return;
        }
      }

      const profTrigger = e.target.closest('.open-profile-modal-btn');
      if (profTrigger) {
        e.preventDefault();
        if (window.audio) audio.playClick();
        window.openProfileModal();
        return;
      }

      const adminTrigger = e.target.closest('.tab-btn-admin, #profile-modal-admin-btn');
      if (adminTrigger) {
        e.preventDefault();
        if (window.audio) audio.playClick();
        window.openAdminModal();
        return;
      }
    });

    // Profile modal open/close
    const openBtns = document.querySelectorAll('.open-profile-modal-btn');
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('close-profile-modal-btn');

    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (modal) modal.style.display = 'flex';
        this.updateUI();
      });
    });

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    // Modal Logout button
    const modalLogoutBtn = document.getElementById('profile-modal-logout-btn');
    if (modalLogoutBtn) {
      modalLogoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    // Modal Login redirect
    const modalLoginBtn = document.getElementById('profile-modal-login-btn');
    const authModal = document.getElementById('auth-modal');
    if (modalLoginBtn && authModal) {
      modalLoginBtn.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
        authModal.style.display = 'flex';
      });
    }

    // Profile Modal Admin button
    const profileAdminBtn = document.getElementById('profile-modal-admin-btn');
    if (profileAdminBtn) {
      profileAdminBtn.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
        this.openAdminPanel();
      });
    }

    // Admin Navigation Tab
    const adminNavTab = document.getElementById('tab-btn-admin');
    if (adminNavTab) {
      adminNavTab.addEventListener('click', () => {
        this.openAdminPanel();
      });
    }

    // Admin Panel Close
    const closeAdminBtn = document.getElementById('close-admin-panel-btn');
    const adminPanelModal = document.getElementById('admin-panel-modal');
    if (closeAdminBtn && adminPanelModal) {
      closeAdminBtn.addEventListener('click', () => adminPanelModal.style.display = 'none');
    }
    if (adminPanelModal) {
      adminPanelModal.addEventListener('click', (e) => {
        if (e.target === adminPanelModal) adminPanelModal.style.display = 'none';
      });
    }

    // Admin Toolbar Search & Refresh
    const adminSearchInput = document.getElementById('admin-search-users-input');
    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = this.adminUsersCache.filter(u => 
          (u.username && u.username.toLowerCase().includes(query)) ||
          (u.displayName && u.displayName.toLowerCase().includes(query))
        );
        this.renderAdminUsersList(filtered);
      });
    }

    const adminRefreshBtn = document.getElementById('admin-refresh-users-btn');
    if (adminRefreshBtn) {
      adminRefreshBtn.addEventListener('click', () => this.fetchAndRenderAdminUsers());
    }

    const adminClaimBtn = document.getElementById('admin-claim-key-btn');
    if (adminClaimBtn) {
      adminClaimBtn.addEventListener('click', async () => {
        const key = window.showMedievalPrompt ? await window.showMedievalPrompt({
          title: 'Clave Maestra de Administrador',
          message: 'Introduce la clave maestra real para obtener privilegios supremos:',
          placeholder: 'Clave secreta...',
          icon: '👑',
          confirmText: '👑 Reclamar Rango'
        }) : prompt('Introduce la Clave Maestra de Administrador:');

        if (key) {
          try {
            const res = await fetch('/api/admin/claim', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
              },
              body: JSON.stringify({ masterKey: key })
            });
            const data = await res.json();
            if (data.ok || data.success) {
              if (window.showToast) showToast('👑 ¡Rango de Administrador Real otorgado con éxito!', 'success');
              this.currentUser = data.user;
              this.updateUI();
              this.openAdminPanel();
            } else {
              if (window.showToast) showToast(data.error || 'Clave incorrecta', 'danger');
            }
          } catch (err) {
            if (window.showToast) showToast('Error: ' + err.message, 'danger');
          }
        }
      });
    }

    // Admin Submodals Close
    const closeAdminPassBtn = document.getElementById('close-admin-change-pass-btn');
    const adminPassModal = document.getElementById('admin-change-pass-modal');
    const cancelAdminPassBtn = document.getElementById('admin-change-pass-cancel-btn');
    [closeAdminPassBtn, cancelAdminPassBtn].forEach(btn => {
      if (btn && adminPassModal) btn.addEventListener('click', () => adminPassModal.style.display = 'none');
    });

    const adminPassForm = document.getElementById('admin-change-pass-form');
    if (adminPassForm) {
      adminPassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetUserId = document.getElementById('admin-change-pass-userid').value;
        const newPass = document.getElementById('admin-change-pass-newpass').value;
        const msg = document.getElementById('admin-change-pass-msg');

        try {
          const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ targetUserId, newPassword: newPass })
          });
          const data = await res.json();
          if (data.ok || data.success) {
            if (msg) {
              msg.className = 'auth-alert-msg success';
              msg.textContent = '¡Contraseña actualizada exitosamente!';
              msg.style.display = 'block';
            }
            setTimeout(() => {
              if (adminPassModal) adminPassModal.style.display = 'none';
            }, 800);
          } else {
            if (msg) {
              msg.className = 'auth-alert-msg error';
              msg.textContent = data.error || 'Error al cambiar contraseña';
              msg.style.display = 'block';
            }
          }
        } catch (err) {
          if (msg) {
            msg.className = 'auth-alert-msg error';
            msg.textContent = err.message;
            msg.style.display = 'block';
          }
        }
      });
    }

    const closeResetLinkBtn = document.getElementById('close-admin-reset-link-btn');
    const resetLinkModal = document.getElementById('admin-reset-link-modal');
    if (closeResetLinkBtn && resetLinkModal) {
      closeResetLinkBtn.addEventListener('click', () => resetLinkModal.style.display = 'none');
    }

    const copyResetBtn = document.getElementById('admin-copy-reset-link-btn');
    if (copyResetBtn) {
      copyResetBtn.addEventListener('click', () => {
        const input = document.getElementById('admin-reset-link-input');
        const feedback = document.getElementById('admin-copy-feedback');
        if (input) {
          navigator.clipboard.writeText(input.value);
          if (feedback) feedback.style.display = 'block';
        }
      });
    }

    const closeUserResetBtn = document.getElementById('close-reset-pass-modal-btn');
    const userResetModal = document.getElementById('reset-password-modal');
    if (closeUserResetBtn && userResetModal) {
      closeUserResetBtn.addEventListener('click', () => userResetModal.style.display = 'none');
    }

    // Auth Modal setup
    this.initAuthModal();

    this.checkSession();
    this.checkUrlResetToken();
  }

  initAuthModal() {
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-modal-btn');
    const guestBtn = document.getElementById('auth-continue-guest-btn');

    const tabLoginBtn = document.getElementById('auth-tab-login-btn');
    const tabRegBtn = document.getElementById('auth-tab-reg-btn');
    const loginForm = document.getElementById('auth-login-form');
    const regForm = document.getElementById('auth-register-form');

    const loginMsg = document.getElementById('auth-login-msg');
    const regMsg = document.getElementById('auth-reg-msg');

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => window.closeAuthModal());
    }
    if (guestBtn && authModal) {
      guestBtn.addEventListener('click', () => window.closeAuthModal());
    }
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) window.closeAuthModal();
      });
    }

    // Tabs switch
    if (tabLoginBtn && tabRegBtn && loginForm && regForm) {
      tabLoginBtn.addEventListener('click', () => {
        tabLoginBtn.classList.add('active');
        tabRegBtn.classList.remove('active');
        loginForm.classList.add('active');
        loginForm.style.setProperty('display', 'flex', 'important');
        regForm.classList.remove('active');
        regForm.style.setProperty('display', 'none', 'important');
        if (loginMsg) loginMsg.style.display = 'none';
      });

      tabRegBtn.addEventListener('click', () => {
        tabRegBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        regForm.classList.add('active');
        regForm.style.setProperty('display', 'flex', 'important');
        loginForm.classList.remove('active');
        loginForm.style.setProperty('display', 'none', 'important');
        if (regMsg) regMsg.style.display = 'none';
      });
    }

    // Submit Login
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-login-username').value.trim();
        const password = document.getElementById('auth-login-password').value;

        if (loginMsg) {
          loginMsg.className = 'auth-alert-msg';
          loginMsg.style.display = 'none';
        }

        try {
          await this.login(username, password);
          if (loginMsg) {
            loginMsg.className = 'auth-alert-msg success';
            loginMsg.textContent = '¡Bienvenido, noble comandante! Sesión iniciada.';
            loginMsg.style.display = 'block';
          }
          setTimeout(() => {
            if (authModal) authModal.style.display = 'none';
          }, 600);
        } catch (err) {
          if (loginMsg) {
            loginMsg.className = 'auth-alert-msg error';
            loginMsg.textContent = err.message || 'Error al iniciar sesión';
            loginMsg.style.display = 'block';
          }
        }
      });
    }

    // Submit Register
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-reg-username').value.trim();
        const displayName = document.getElementById('auth-reg-displayname').value.trim();
        const password = document.getElementById('auth-reg-password').value;
        const confirmPass = document.getElementById('auth-reg-confirm').value;

        if (regMsg) {
          regMsg.className = 'auth-alert-msg';
          regMsg.style.display = 'none';
        }

        if (password !== confirmPass) {
          if (regMsg) {
            regMsg.className = 'auth-alert-msg error';
            regMsg.textContent = 'Las contraseñas no coinciden.';
            regMsg.style.display = 'block';
          }
          return;
        }

        try {
          await this.register(username, password, displayName, this.profile.avatar, this.profile.color);
          if (regMsg) {
            regMsg.className = 'auth-alert-msg success';
            regMsg.textContent = '¡Comandante registrado exitosamente en el reino!';
            regMsg.style.display = 'block';
          }
          setTimeout(() => {
            if (authModal) authModal.style.display = 'none';
          }, 700);
        } catch (err) {
          if (regMsg) {
            regMsg.className = 'auth-alert-msg error';
            regMsg.textContent = err.message || 'Error al registrar';
            regMsg.style.display = 'block';
          }
        }
      });
    }
  }
}

window.profileManager = new ProfileManager();

document.addEventListener('DOMContentLoaded', () => {
  window.profileManager.initModal();
});
