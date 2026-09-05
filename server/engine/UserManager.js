const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'users');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USERS_BACKUP_FILE = path.join(DATA_DIR, 'users.backup.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');
const ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'carcassonne_dan_2026';

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

class UserManager {
  constructor() {
    this.users = new Map();
    this.sessions = new Map(); // token -> { userId, createdAt, lastUsedAt, expiresAt }
    this.resetTokens = new Map(); // resetToken -> { userId, username, expiresAt, createdAt }
    this.loadUsers();
    this.loadSessions();
    this.loadResetTokens();
    this.ensureDefaultAdmin();
  }

  // Safe file write with atomic rename & backup
  safeWriteJson(filePath, data, backupPath = null) {
    try {
      const content = JSON.stringify(data, null, 2);
      const tmpPath = filePath + '.tmp';
      
      // If current file exists and backupPath is given, create backup
      if (backupPath && fs.existsSync(filePath)) {
        try {
          fs.copyFileSync(filePath, backupPath);
        } catch (bErr) {
          console.warn('⚠️ No se pudo crear backup de ' + filePath, bErr);
        }
      }

      fs.writeFileSync(tmpPath, content, 'utf8');
      
      // Atomic rename (or replace on Windows)
      if (process.platform === 'win32') {
        fs.copyFileSync(tmpPath, filePath);
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      } else {
        fs.renameSync(tmpPath, filePath);
      }
      return true;
    } catch (e) {
      console.error(`⚠️ Error escribiendo archivo seguro ${filePath}:`, e);
      return false;
    }
  }

  loadUsers() {
    let loaded = false;
    if (fs.existsSync(USERS_FILE)) {
      try {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        if (raw && raw.trim()) {
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(u => {
              if (u && u.id) this.users.set(u.id, u);
            });
            loaded = true;
            console.log(`🏰 [UserManager] Cargados ${this.users.size} usuarios desde users.json`);
          }
        }
      } catch (e) {
        console.error('⚠️ Error leyendo users.json principal:', e);
      }
    }

    // Fallback: Si users.json falló o estaba vacío, intentar cargar desde users.backup.json
    if (!loaded && fs.existsSync(USERS_BACKUP_FILE)) {
      try {
        const rawBackup = fs.readFileSync(USERS_BACKUP_FILE, 'utf8');
        if (rawBackup && rawBackup.trim()) {
          const data = JSON.parse(rawBackup);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(u => {
              if (u && u.id) this.users.set(u.id, u);
            });
            console.log(`🛡️ [UserManager] Restaurados ${this.users.size} usuarios desde users.backup.json`);
            // Restaurar archivo principal
            this.safeWriteJson(USERS_FILE, Array.from(this.users.values()));
          }
        }
      } catch (bErr) {
        console.error('⚠️ Error cargando backup de usuarios:', bErr);
      }
    }
  }

  saveUsers() {
    try {
      const data = Array.from(this.users.values());
      // Prevent saving empty array if we previously had users in backup
      if (data.length === 0 && fs.existsSync(USERS_BACKUP_FILE)) {
        console.warn('⚠️ Intento de guardar 0 usuarios cuando existe backup. Abortando sobreescritura accidental.');
        return;
      }
      this.safeWriteJson(USERS_FILE, data, USERS_BACKUP_FILE);
    } catch (e) {
      console.error('⚠️ Error guardando base de datos de usuarios:', e);
    }
  }

  loadSessions() {
    if (fs.existsSync(SESSIONS_FILE)) {
      try {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
        if (raw && raw.trim()) {
          const data = JSON.parse(raw);
          const now = Date.now();
          if (Array.isArray(data)) {
            data.forEach(s => {
              if (s && s.token && s.userId) {
                // If expiresAt is missing or still in the future, keep session
                if (!s.expiresAt || s.expiresAt > now) {
                  this.sessions.set(s.token, {
                    userId: s.userId,
                    createdAt: s.createdAt || now,
                    lastUsedAt: s.lastUsedAt || now,
                    expiresAt: s.expiresAt || (now + SESSION_TTL_MS)
                  });
                }
              }
            });
            console.log(`🔑 [UserManager] Cargadas ${this.sessions.size} sesiones activas persistentes`);
          }
        }
      } catch (e) {
        console.error('⚠️ Error cargando sessions.json:', e);
      }
    }
  }

  saveSessions() {
    try {
      const list = [];
      const now = Date.now();
      for (const [token, s] of this.sessions.entries()) {
        if (!s.expiresAt || s.expiresAt > now) {
          list.push({
            token,
            userId: typeof s === 'string' ? s : s.userId,
            createdAt: s.createdAt || now,
            lastUsedAt: s.lastUsedAt || now,
            expiresAt: s.expiresAt || (now + SESSION_TTL_MS)
          });
        }
      }
      this.safeWriteJson(SESSIONS_FILE, list);
    } catch (e) {
      console.error('⚠️ Error guardando sessions.json:', e);
    }
  }

  loadResetTokens() {
    if (fs.existsSync(RESET_TOKENS_FILE)) {
      try {
        const raw = fs.readFileSync(RESET_TOKENS_FILE, 'utf8');
        if (raw && raw.trim()) {
          const data = JSON.parse(raw);
          const now = Date.now();
          if (Array.isArray(data)) {
            data.forEach(r => {
              if (r && r.resetToken && r.userId && r.expiresAt > now) {
                this.resetTokens.set(r.resetToken, r);
              }
            });
          }
        }
      } catch (e) {
        console.error('⚠️ Error cargando reset_tokens.json:', e);
      }
    }
  }

  saveResetTokens() {
    try {
      const list = [];
      const now = Date.now();
      for (const [resetToken, r] of this.resetTokens.entries()) {
        if (r.expiresAt > now) {
          list.push({
            resetToken,
            userId: r.userId,
            username: r.username,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt
          });
        }
      }
      this.safeWriteJson(RESET_TOKENS_FILE, list);
    } catch (e) {
      console.error('⚠️ Error guardando reset_tokens.json:', e);
    }
  }

  ensureDefaultAdmin() {
    // Check if any admin exists and grant admin to admin/dan accounts
    let hasAdmin = false;
    for (const u of this.users.values()) {
      const norm = (u.username || '').toLowerCase();
      if (u.role === 'admin' || norm === 'admin' || norm.includes('dan') || norm === 'dqniel') {
        u.role = 'admin';
        u.title = 'Soberano Supremo del Reino';
        hasAdmin = true;
      }
    }

    if (!hasAdmin) {
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = this.hashPassword('admin123', salt);
      const adminId = 'usr_admin_master';
      const adminUser = {
        id: adminId,
        username: 'admin',
        displayName: 'Gran Rey Administrador',
        passwordHash,
        salt,
        role: 'admin',
        avatar: 'king',
        color: 'yellow',
        title: 'Soberano Supremo del Reino',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        stats: {
          gamesPlayed: 0,
          wins: 0,
          highScore: 0,
          totalPoints: 0,
          citiesCompleted: 0,
          roadsCompleted: 0,
          winRate: 0
        }
      };
      this.users.set(adminId, adminUser);
      this.saveUsers();
      console.log('👑 Usuario Administrador inicial creado: [admin / admin123]');
    } else {
      this.saveUsers();
    }
  }

  hashPassword(password, salt) {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  register(username, password, profileData = {}) {
    if (!username || typeof username !== 'string') {
      return { ok: false, success: false, error: 'Nombre de comandante requerido' };
    }
    const cleanName = username.trim();
    if (cleanName.length < 3 || cleanName.length > 20) {
      return { ok: false, success: false, error: 'El nombre debe tener entre 3 y 20 caracteres' };
    }
    if (!password || password.length < 4) {
      return { ok: false, success: false, error: 'La contraseña debe tener al menos 4 caracteres' };
    }

    // Check duplicate username (case-insensitive)
    const norm = cleanName.toLowerCase();
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === norm) {
        return { ok: false, success: false, error: 'Este nombre de comandante ya está registrado. Por favor inicia sesión.' };
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const userId = 'usr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

    const isDanOrAdmin = norm === 'admin' || norm.includes('dan') || norm === 'dqniel';

    const user = {
      id: userId,
      username: cleanName,
      displayName: profileData.displayName || cleanName,
      passwordHash,
      salt,
      role: isDanOrAdmin ? 'admin' : 'player',
      avatar: profileData.avatar || 'king',
      color: profileData.color || 'yellow',
      title: profileData.title || (isDanOrAdmin ? 'Soberano Supremo del Reino' : 'Noble de Carcassonne'),
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      stats: {
        gamesPlayed: 0,
        wins: 0,
        highScore: 0,
        totalPoints: 0,
        citiesCompleted: 0,
        roadsCompleted: 0,
        winRate: 0
      }
    };

    this.users.set(userId, user);
    this.saveUsers();

    const token = this.createSession(userId);
    return { ok: true, success: true, token, user: this.sanitizeUser(user) };
  }

  login(username, password) {
    if (!username || !password) {
      return { ok: false, success: false, error: 'Usuario y contraseña requeridos' };
    }

    const norm = username.trim().toLowerCase();
    let foundUser = null;
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === norm) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      return { ok: false, success: false, error: 'Comandante no encontrado. ¿Deseas registrarte?' };
    }

    const hash = this.hashPassword(password, foundUser.salt);
    if (hash !== foundUser.passwordHash) {
      return { ok: false, success: false, error: 'Contraseña incorrecta' };
    }

    foundUser.lastLoginAt = Date.now();
    this.saveUsers();

    const token = this.createSession(foundUser.id);
    return { ok: true, success: true, token, user: this.sanitizeUser(foundUser) };
  }

  createSession(userId) {
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    this.sessions.set(token, {
      userId,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + SESSION_TTL_MS
    });
    this.saveSessions();
    return token;
  }

  getUserByToken(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    
    const userId = typeof session === 'string' ? session : session.userId;
    const expiresAt = typeof session === 'object' ? session.expiresAt : null;
    
    if (expiresAt && Date.now() > expiresAt) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    if (typeof session === 'object') {
      session.lastUsedAt = Date.now();
    }

    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  getUser(userId) {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  updateProfile(userId, { avatar, color, title, displayName, name }) {
    const user = this.users.get(userId);
    if (!user) return { ok: false, success: false, error: 'Usuario no encontrado' };

    if (avatar) user.avatar = avatar;
    if (color) user.color = color;
    if (title) user.title = title;
    if (displayName) user.displayName = displayName.trim();
    if (name && name.trim().length >= 3 && name.trim().length <= 20) {
      const clean = name.trim();
      const norm = clean.toLowerCase();
      let exists = false;
      for (const u of this.users.values()) {
        if (u.id !== userId && u.username.toLowerCase() === norm) {
          exists = true;
          break;
        }
      }
      if (!exists) user.username = clean;
    }

    this.saveUsers();
    return { ok: true, success: true, user: this.sanitizeUser(user) };
  }

  recordGameFinished(userId, { score, isWinner, citiesCompleted = 0, roadsCompleted = 0 }) {
    const user = this.users.get(userId);
    if (!user) return { ok: false, success: false, error: 'Usuario no encontrado' };

    if (!user.stats) {
      user.stats = { gamesPlayed: 0, wins: 0, highScore: 0, totalPoints: 0, citiesCompleted: 0, roadsCompleted: 0, winRate: 0 };
    }

    user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;
    if (isWinner) user.stats.wins = (user.stats.wins || 0) + 1;
    user.stats.totalPoints = (user.stats.totalPoints || 0) + (score || 0);
    user.stats.highScore = Math.max(user.stats.highScore || 0, score || 0);
    user.stats.citiesCompleted = (user.stats.citiesCompleted || 0) + citiesCompleted;
    user.stats.roadsCompleted = (user.stats.roadsCompleted || 0) + roadsCompleted;
    user.stats.winRate = Math.round((user.stats.wins / user.stats.gamesPlayed) * 100);

    this.saveUsers();
    return { ok: true, success: true, user: this.sanitizeUser(user) };
  }

  // ==================== ADMIN OPERATIONS ====================

  isAdmin(userId) {
    if (!userId) return false;
    const user = this.users.get(userId);
    return !!(user && user.role === 'admin');
  }

  claimAdmin(userId, masterKey) {
    if (!masterKey || masterKey !== ADMIN_MASTER_KEY) {
      return { ok: false, success: false, error: 'Clave maestra de administrador incorrecta' };
    }
    const user = this.users.get(userId);
    if (!user) return { ok: false, success: false, error: 'Usuario no encontrado' };

    user.role = 'admin';
    user.title = 'Soberano Supremo del Reino';
    this.saveUsers();
    return { ok: true, success: true, user: this.sanitizeUser(user) };
  }

  getAllUsersForAdmin(adminUserId) {
    if (!this.isAdmin(adminUserId)) {
      return { ok: false, success: false, error: 'Acceso denegado: Se requiere rango de Administrador' };
    }
    const list = Array.from(this.users.values()).map(u => this.sanitizeUser(u));
    return { ok: true, success: true, users: list };
  }

  adminChangePassword(adminUserId, targetUserId, newPassword) {
    if (!this.isAdmin(adminUserId)) {
      return { ok: false, success: false, error: 'Acceso denegado: Se requiere rango de Administrador' };
    }
    if (!newPassword || newPassword.length < 4) {
      return { ok: false, success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' };
    }
    const targetUser = this.users.get(targetUserId);
    if (!targetUser) {
      return { ok: false, success: false, error: 'Usuario objetivo no encontrado' };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    targetUser.salt = salt;
    targetUser.passwordHash = this.hashPassword(newPassword, salt);
    this.saveUsers();

    return { ok: true, success: true, message: `Contraseña cambiada exitosamente para @${targetUser.username}` };
  }

  adminCreateResetLink(adminUserId, targetUserId, expiryHours = 24) {
    if (!this.isAdmin(adminUserId)) {
      return { ok: false, success: false, error: 'Acceso denegado: Se requiere rango de Administrador' };
    }
    const targetUser = this.users.get(targetUserId);
    if (!targetUser) {
      return { ok: false, success: false, error: 'Usuario objetivo no encontrado' };
    }

    const resetToken = 'rst_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + (expiryHours * 60 * 60 * 1000);

    this.resetTokens.set(resetToken, {
      userId: targetUserId,
      username: targetUser.username,
      expiresAt,
      createdAt: Date.now()
    });
    this.saveResetTokens();

    return {
      ok: true,
      success: true,
      resetToken,
      username: targetUser.username,
      expiresAt,
      expiryHours
    };
  }

  validateResetToken(resetToken) {
    if (!resetToken) return { ok: false, error: 'Token no proporcionado' };
    const entry = this.resetTokens.get(resetToken);
    if (!entry) return { ok: false, error: 'Enlace de recuperación no válido o ya utilizado' };
    if (Date.now() > entry.expiresAt) {
      this.resetTokens.delete(resetToken);
      this.saveResetTokens();
      return { ok: false, error: 'El enlace de recuperación ha caducado' };
    }
    const user = this.users.get(entry.userId);
    if (!user) return { ok: false, error: 'Usuario no encontrado' };
    return { ok: true, user: this.sanitizeUser(user) };
  }

  resetPasswordWithToken(resetToken, newPassword) {
    const valid = this.validateResetToken(resetToken);
    if (!valid.ok) return { ok: false, success: false, error: valid.error };

    if (!newPassword || newPassword.length < 4) {
      return { ok: false, success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' };
    }

    const entry = this.resetTokens.get(resetToken);
    const targetUser = this.users.get(entry.userId);

    const salt = crypto.randomBytes(16).toString('hex');
    targetUser.salt = salt;
    targetUser.passwordHash = this.hashPassword(newPassword, salt);
    this.saveUsers();

    // Consume token
    this.resetTokens.delete(resetToken);
    this.saveResetTokens();

    // Create session token for direct login
    const token = this.createSession(targetUser.id);
    return { ok: true, success: true, token, user: this.sanitizeUser(targetUser), message: 'Contraseña actualizada exitosamente' };
  }

  adminDeleteUser(adminUserId, targetUserId) {
    if (!this.isAdmin(adminUserId)) {
      return { ok: false, success: false, error: 'Acceso denegado: Se requiere rango de Administrador' };
    }
    if (adminUserId === targetUserId) {
      return { ok: false, success: false, error: 'No puedes eliminar tu propia cuenta de administrador' };
    }
    const targetUser = this.users.get(targetUserId);
    if (!targetUser) {
      return { ok: false, success: false, error: 'Usuario no encontrado' };
    }

    this.users.delete(targetUserId);
    this.saveUsers();

    // Clean up all sessions belonging to target user
    for (const [token, s] of this.sessions.entries()) {
      const uid = typeof s === 'string' ? s : s.userId;
      if (uid === targetUserId) {
        this.sessions.delete(token);
      }
    }
    this.saveSessions();

    return { ok: true, success: true, message: `Usuario @${targetUser.username} eliminado del reino` };
  }

  sanitizeUser(user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role || 'player',
      avatar: user.avatar,
      color: user.color,
      title: user.title,
      stats: user.stats || { gamesPlayed: 0, wins: 0, highScore: 0, totalPoints: 0, winRate: 0 },
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  getAllUsersForLeaderboard() {
    return Array.from(this.users.values()).map(u => ({
      name: u.displayName || u.username,
      username: u.username,
      role: u.role || 'player',
      avatar: u.avatar || 'king',
      color: u.color || 'yellow',
      isBot: false,
      games: u.stats?.gamesPlayed || 0,
      wins: u.stats?.wins || 0,
      totalPoints: u.stats?.totalPoints || 0,
      highScore: u.stats?.highScore || 0,
      winRate: u.stats?.winRate || 0
    }));
  }
}

module.exports = new UserManager();
