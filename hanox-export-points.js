/**
 * HANOX MOD Z — Server Key System
 * Tích hợp Firebase từ HEADLOCK ULTRA V3
 * Logic: 1 ngày = 1 điểm (mỗi lần xuất tốn 1 ngày)
 */

/* ============================
   FIREBASE CONFIG (từ logo.html)
   ============================ */
const MODFF_FB_CONFIG = {
  apiKey: "AIzaSyB6Dg4b6Lb9EUXfW1fDecO9YC35pVF5K4s",
  authDomain: "headlock-ultra-v3.firebaseapp.com",
  projectId: "headlock-ultra-v3",
  storageBucket: "headlock-ultra-v3.firebasestorage.app",
  messagingSenderId: "700255580228",
  appId: "1:700255580228:web:9294697678ff2a9da8cc11"
};

const LIFETIME_DAYS = 99999;
const SESSION_KEY   = 'modff_key_session';
const DEVICE_ID_KEY = 'modff_device_id';

/* ============================
   HELPERS
   ============================ */
const safeGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const safeRemove = k => { try { localStorage.removeItem(k); } catch {} };

function getDeviceId() {
  let id = safeGet(DEVICE_ID_KEY);
  if (!id) {
    id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase()
       + '-' + Date.now().toString(36).toUpperCase();
    safeSet(DEVICE_ID_KEY, id);
  }
  return id;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/* ============================
   FIREBASE INIT
   ============================ */
let _db = null;
let _fbReady = false;

function loadFirebaseScripts() {
  return new Promise((resolve, reject) => {
    if (typeof firebase !== 'undefined') { resolve(); return; }
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore-compat.js',
    ];
    let loaded = 0;
    scripts.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { if (++loaded === scripts.length) resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  });
}

async function getDB() {
  if (_db) return _db;
  await loadFirebaseScripts();
  if (!firebase.apps.length) {
    firebase.initializeApp(MODFF_FB_CONFIG);
  }
  _db = firebase.firestore();
  _fbReady = true;
  return _db;
}

/* ============================
   KEY VERIFICATION
   Trả về { days, expiresAt, tier }
   ============================ */
async function verifyAndActivateKey(rawKey) {
  const key = String(rawKey || '').trim().toUpperCase();
  if (!key) throw new Error('Vui lòng nhập Key.');
  if (!/^[A-Z0-9]+-[A-Z0-9]{6}-[A-Z0-9]{6}$/.test(key))
    throw new Error('Định dạng Key không hợp lệ.');

  const db = await getDB();
  const deviceId = getDeviceId();
  const docRef = db.collection('keys').doc(key);
  const LOCK_MS = 5000;

  // Bước 1: Tạo login lock
  try {
    await db.runTransaction(async tx => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error('__NO_KEY__');
      const data = doc.data();
      const now = Date.now();
      const lock = data.loginLock;
      if (lock && lock.deviceId !== deviceId && lock.expiresAt && now < lock.expiresAt) {
        const sec = Math.ceil((lock.expiresAt - now) / 1000);
        throw new Error(`__LOCKED__:${sec}`);
      }
      tx.update(docRef, { loginLock: { deviceId, expiresAt: now + LOCK_MS, startedAt: now } });
    });
  } catch (e) {
    const msg = String(e.message || '');
    if (msg === '__NO_KEY__') throw new Error('Key không đúng hoặc đã bị xóa.');
    if (msg.startsWith('__LOCKED__:')) {
      const sec = msg.split(':')[1];
      throw new Error(`⚠️ Key đang được thiết bị khác đăng nhập.\nĐợi ${sec} giây rồi thử lại.`);
    }
    throw e;
  }

  // Bước 2: Activate + lấy thông tin
  try {
    const result = await db.runTransaction(async tx => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error('Key không đúng hoặc đã bị xóa.');
      const data = doc.data();
      if (data.locked === true) throw new Error('Key đã bị Admin KHÓA.');
      if (data.expiresAt && Date.now() >= data.expiresAt) throw new Error('Key đã hết hạn.');

      const devices = Array.isArray(data.devices) ? data.devices : [];
      const max = typeof data.maxDevices === 'number' ? data.maxDevices : 1;
      const isUnlimited = max === -1;
      const updates = {};

      if (!devices.includes(deviceId)) {
        if (!isUnlimited && devices.length >= max)
          throw new Error(`Key đã đạt giới hạn ${max} thiết bị.`);
        devices.push(deviceId);
        updates.devices = devices;
        updates.usedDevices = devices.length;
      }

      if (data.status === 'unused') {
        updates.status = 'active';
        updates.activatedAt = Date.now();
        updates.expiresAt = data.days >= LIFETIME_DAYS
          ? null
          : Date.now() + data.days * 86400000;
      }

      updates.loginLock = null;
      if (Object.keys(updates).length) tx.update(docRef, updates);

      const expiresMs = (updates.expiresAt !== undefined ? updates.expiresAt : data.expiresAt) || 0;
      const daysLeft = expiresMs
        ? Math.max(0, Math.ceil((expiresMs - Date.now()) / 86400000))
        : (data.days >= LIFETIME_DAYS ? LIFETIME_DAYS : data.days);

      return {
        key,
        days: data.days,
        daysLeft,
        expiresAt: expiresMs ? Math.floor(expiresMs / 1000) : 0,
        tier: data.days >= 19 ? 'VIP' : 'BASIC',
      };
    });
    return result;
  } catch (e) {
    try { await docRef.update({ loginLock: firebase.firestore.FieldValue.delete() }); } catch {}
    throw e;
  }
}

/* ============================
   POINTS LOGIC: 1 ngày = 1 điểm
   Mỗi lần xuất → trừ 1 ngày (1 điểm)
   ============================ */
async function chargeOneDay(keyStr) {
  const db = await getDB();
  const docRef = db.collection('keys').doc(keyStr);

  return db.runTransaction(async tx => {
    const doc = await tx.get(docRef);
    if (!doc.exists) throw new Error('Không tìm thấy key.');
    const data = doc.data();
    if (data.locked) throw new Error('Key đã bị khóa.');

    const now = Date.now();
    if (data.expiresAt && now >= data.expiresAt) throw new Error('Key đã hết hạn.');

    // Vĩnh viễn: không trừ
    if (!data.expiresAt || data.days >= LIFETIME_DAYS) return { ok: true, daysLeft: LIFETIME_DAYS };

    // Trừ 1 ngày = giảm expiresAt 86400000ms
    const newExpires = data.expiresAt - 86400000;
    if (newExpires <= now) throw new Error('Không đủ điểm (ngày) để xuất. Vui lòng gia hạn key.');
    tx.update(docRef, { expiresAt: newExpires });

    const daysLeft = Math.max(0, Math.ceil((newExpires - now) / 86400000));
    return { ok: true, daysLeft };
  });
}

/* ============================
   SESSION MANAGEMENT
   ============================ */
let _session = null;

function loadSession() {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !s.key) return null;
    if (s.expiresAt && s.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch { return null; }
}

function saveSession(data) {
  _session = data;
  safeSet(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  _session = null;
  safeRemove(SESSION_KEY);
}

/* ============================
   LOGIN UI (màn hình login overlay)
   ============================ */
function buildLoginUI() {
  if (document.getElementById('modff-login-overlay')) return;

  const style = document.createElement('style');
  style.textContent = `
#modff-login-overlay {
  position:fixed;inset:0;z-index:99999;background:#08080bdd;
  display:flex;align-items:center;justify-content:center;padding:16px;
  backdrop-filter:blur(10px);
}
#modff-login-overlay.hidden{display:none}
.modff-login-card {
  width:min(440px,100%);background:#1b1b26;border:1px solid #b29aff55;
  border-radius:22px;padding:28px 24px;color:#f1f1f6;
  box-shadow:0 20px 60px #0009;
  animation:modffPop .35s cubic-bezier(.19,1,.22,1);
}
@keyframes modffPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
.modff-login-logo {
  display:grid;place-items:center;width:60px;height:60px;border-radius:18px;
  background:linear-gradient(135deg,#6d4ff6,#b29aff);font-size:30px;
  margin:0 auto 16px;box-shadow:0 0 24px #b29aff55;
}
.modff-login-title {
  text-align:center;font-size:22px;font-weight:900;letter-spacing:2px;
  color:#e2d9ff;margin:0 0 4px;
}
.modff-login-sub {
  text-align:center;font-size:12px;color:#8888aa;letter-spacing:1px;margin:0 0 22px;
}
.modff-fb-status {
  display:flex;align-items:center;justify-content:center;gap:8px;
  font-size:11px;color:#666;margin-bottom:16px;
}
.modff-fb-dot {
  width:7px;height:7px;border-radius:50%;background:#666;transition:.3s;
}
.modff-fb-dot.online{background:#c5ee87;box-shadow:0 0 6px #c5ee87;}
.modff-fb-dot.offline{background:#ff6060;box-shadow:0 0 6px #ff6060;}
.modff-key-wrap {
  position:relative;display:flex;align-items:center;
  background:#12121a;border:1.5px solid #3a3a55;border-radius:14px;
  overflow:hidden;transition:.25s;margin-bottom:14px;
}
.modff-key-wrap:focus-within{border-color:#b29aff;box-shadow:0 0 0 3px #b29aff22;}
.modff-key-pfx {
  display:grid;place-items:center;width:46px;height:50px;
  color:#b29aff;font-size:16px;border-right:1px solid #2a2a40;flex-shrink:0;
}
.modff-key-input {
  flex:1;padding:14px 12px;background:transparent;border:0;
  color:#e8e8f0;font-size:14px;font-family:monospace;letter-spacing:1px;outline:none;
}
.modff-key-input::placeholder{color:#3a3a55;font-family:system-ui}
.modff-key-eye {
  width:46px;height:50px;background:transparent;border:0;
  color:#555;font-size:15px;cursor:pointer;transition:.2s;flex-shrink:0;
}
.modff-key-eye:hover{color:#b29aff}
.modff-err {
  display:none;align-items:center;gap:8px;padding:10px 12px;
  border-radius:10px;background:#ff606015;border:1px solid #ff606040;
  color:#ff9090;font-size:12px;margin-bottom:12px;
}
.modff-err.show{display:flex}
.modff-btn-login {
  width:100%;padding:15px;border:0;border-radius:13px;
  background:linear-gradient(135deg,#6d4ff6,#b29aff);color:#fff;
  font-size:14px;font-weight:800;letter-spacing:1px;cursor:pointer;
  box-shadow:0 6px 20px #6d4ff644;transition:.18s;
}
.modff-btn-login:disabled{opacity:.55;cursor:not-allowed}
.modff-btn-login:active:not(:disabled){transform:scale(.98)}
.modff-days-chip {
  display:inline-flex;align-items:center;gap:6px;margin:14px 0 0;
  padding:6px 14px;border-radius:20px;background:#c5ee8722;
  border:1px solid #c5ee8755;color:#c5ee87;font-size:12px;font-weight:700;
  width:100%;justify-content:center;
}
`;
  document.head.appendChild(style);

  const ov = document.createElement('div');
  ov.id = 'modff-login-overlay';
  ov.innerHTML = `
<div class="modff-login-card">
  <div class="modff-login-logo">🎭</div>
  <div class="modff-login-title">HANOX MOD Z</div>
  <div class="modff-login-sub">PHỐI ĐỒ FREE FIRE · NHẬP KEY ĐỂ TIẾP TỤC</div>
  <div class="modff-fb-status">
    <div class="modff-fb-dot" id="modff-fb-dot"></div>
    <span id="modff-fb-txt">Đang kết nối server...</span>
  </div>
  <div class="modff-key-wrap" id="modff-key-wrap">
    <div class="modff-key-pfx">🔑</div>
    <input type="password" class="modff-key-input" id="modff-key-input"
      placeholder="Nhập Key VIP của bạn..."
      autocomplete="off">
    <button class="modff-key-eye" id="modff-key-eye" type="button">👁</button>
  </div>
  <div class="modff-err" id="modff-err">
    <span>⚠️</span><span id="modff-err-txt">Lỗi</span>
  </div>
  <button class="modff-btn-login" id="modff-btn-login" type="button">
    <span id="modff-btn-txt">🔓 Đăng Nhập</span>
  </button>
  <div id="modff-days-row" style="display:none">
    <div class="modff-days-chip" id="modff-days-chip">✅ Đang tải...</div>
  </div>
</div>`;
  document.body.appendChild(ov);

  // Events
  const input = document.getElementById('modff-key-input');
  const btn   = document.getElementById('modff-btn-login');
  const eye   = document.getElementById('modff-key-eye');
  const errBox = document.getElementById('modff-err');
  const errTxt = document.getElementById('modff-err-txt');

  eye.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptLogin();
  });

  btn.addEventListener('click', attemptLogin);

  // Firebase status
  getDB().then(db => {
    db.collection('settings').doc('ping').get({ source: 'server' }).then(() => {
      const dot = document.getElementById('modff-fb-dot');
      const txt = document.getElementById('modff-fb-txt');
      if (dot) dot.className = 'modff-fb-dot online';
      if (txt) txt.textContent = 'Server: Đã kết nối';
    }).catch(() => {
      const dot = document.getElementById('modff-fb-dot');
      if (dot) dot.className = 'modff-fb-dot offline';
    });
  }).catch(() => {});
}

function showLoginError(msg) {
  const box = document.getElementById('modff-err');
  const txt = document.getElementById('modff-err-txt');
  if (txt) txt.textContent = msg;
  if (box) box.classList.add('show');
  setTimeout(() => { if (box) box.classList.remove('show'); }, 5000);
}

async function attemptLogin() {
  const input = document.getElementById('modff-key-input');
  const btn   = document.getElementById('modff-btn-login');
  const btnTxt = document.getElementById('modff-btn-txt');
  const rawKey = input ? input.value.trim() : '';

  if (!rawKey) { showLoginError('Vui lòng nhập Key.'); return; }
  if (btn) btn.disabled = true;
  if (btnTxt) btnTxt.textContent = '⏳ Đang xác minh...';

  try {
    const data = await verifyAndActivateKey(rawKey);
    saveSession(data);
    enterApp(data);
  } catch (e) {
    showLoginError(e.message || 'Key không hợp lệ.');
    if (btn) btn.disabled = false;
    if (btnTxt) btnTxt.textContent = '🔓 Đăng Nhập';
  }
}

function enterApp(sessionData) {
  const ov = document.getElementById('modff-login-overlay');
  if (ov) ov.classList.add('hidden');

  // Cập nhật heading hiển thị số ngày còn lại
  const headingEl = document.getElementById('hanox-mod-turns');
  if (headingEl) {
    const daysLeft = sessionData.daysLeft;
    const isUnlimited = !sessionData.expiresAt || daysLeft >= LIFETIME_DAYS;
    headingEl.textContent = isUnlimited
      ? `Vĩnh viễn · Xuất không giới hạn`
      : `Còn ${daysLeft} ngày (${daysLeft} lượt xuất)`;
  }

  // Hiện nút đăng xuất
  const logoutBtn = document.getElementById('modff-logout-btn');
  if (logoutBtn) logoutBtn.style.display = 'inline-block';

  // Hiện ghi chú điểm (không hiện nếu vĩnh viễn)
  const pointsNote = document.getElementById('hanox-points-note');
  if (pointsNote && sessionData.expiresAt && sessionData.days < LIFETIME_DAYS)
    pointsNote.style.display = 'block';

  // Expose để wardrobe-app.js dùng
  _session = sessionData;
}

/* ============================
   EXPORT HOOKS (dùng bởi wardrobe-app.js)
   window.fishCheckExport  → kiểm tra trước khi xuất
   window.fishChargeExport → trừ 1 ngày sau khi xuất xong
   ============================ */
window.fishCheckExport = async function(count) {
  if (!_session) throw new Error('Chưa đăng nhập. Hãy nhập key.');
  if (_session.expiresAt && _session.expiresAt <= Math.floor(Date.now() / 1000))
    throw new Error('Key đã hết hạn. Vui lòng gia hạn.');
  const isUnlimited = !_session.expiresAt || _session.days >= LIFETIME_DAYS;
  if (!isUnlimited && _session.daysLeft <= 0)
    throw new Error('Không còn lượt xuất. Vui lòng gia hạn key.');
  return { id: 'modff-' + crypto.randomUUID(), user: _session.key, count: Number(count) || 1, local: false };
};

window.fishChargeExport = async function(ticket) {
  if (!ticket) throw new Error('Phiên xuất không hợp lệ.');
  if (!_session) throw new Error('Mất phiên đăng nhập.');

  const isUnlimited = !_session.expiresAt || _session.days >= LIFETIME_DAYS;
  if (isUnlimited) {
    // Vĩnh viễn: không trừ, chỉ hiển thị
    const headingEl = document.getElementById('hanox-mod-turns');
    if (headingEl) headingEl.textContent = 'Vĩnh viễn · Xuất không giới hạn';
    return true;
  }

  // Trừ 1 ngày = 1 điểm
  const result = await chargeOneDay(_session.key);
  _session.daysLeft = result.daysLeft;
  // Cập nhật expiresAt trong session
  if (_session.expiresAt) {
    _session.expiresAt = _session.expiresAt - 86400; // giảm 1 ngày (seconds)
    saveSession(_session);
  }

  const headingEl = document.getElementById('hanox-mod-turns');
  if (headingEl) {
    headingEl.textContent = result.daysLeft <= 0
      ? 'Hết lượt xuất — Vui lòng gia hạn key'
      : `Còn ${result.daysLeft} ngày (${result.daysLeft} lượt xuất)`;
  }
  return true;
};

/* ============================
   BOOT: kiểm tra session cũ, nếu không có → hiện login
   ============================ */
(async function boot() {
  // Đợi DOM ready
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  const sess = loadSession();
  if (sess) {
    // Xác minh online nhanh
    try {
      const db = await getDB();
      const doc = await db.collection('keys').doc(sess.key).get();
      if (doc.exists) {
        const data = doc.data();
        if (!data.locked && !(data.expiresAt && Date.now() >= data.expiresAt)) {
          const now = Date.now();
          const daysLeft = data.expiresAt
            ? Math.max(0, Math.ceil((data.expiresAt - now) / 86400000))
            : LIFETIME_DAYS;
          sess.daysLeft = daysLeft;
          sess.expiresAt = data.expiresAt ? Math.floor(data.expiresAt / 1000) : 0;
          saveSession(sess);
          _session = sess;
          enterApp(sess);
          return;
        }
      }
    } catch {}
    // Nếu lỗi mạng → vẫn vào app với session cũ
    if (sess.expiresAt && sess.expiresAt > Math.floor(Date.now() / 1000)) {
      _session = sess;
      enterApp(sess);
      return;
    }
    clearSession();
  }

  // Hiện màn hình login
  buildLoginUI();
})();
