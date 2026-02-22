import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_tLz38wPY-GyKU4MLaxftvFuIO4X_rD8",
  authDomain: "game-61407.firebaseapp.com",
  projectId: "game-61407",
  storageBucket: "game-61407.firebasestorage.app",
  messagingSenderId: "678194841920",
  appId: "1:678194841920:web:71ebf89ff6fa30ec5d12a5",
  measurementId: "G-MHD5V1CDVM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const nameInput = document.getElementById("nameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const mapSelect = document.getElementById("mapSelect");
const statusText = document.getElementById("statusText");
const menuPanel = document.getElementById("menuPanel");
const hudPanel = document.getElementById("hudPanel");
const roomCodeText = document.getElementById("roomCodeText");
const mapNameText = document.getElementById("mapNameText");
const youText = document.getElementById("youText");
const weaponButtons = document.getElementById("weaponButtons");
const leaderboard = document.getElementById("leaderboard");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");

const MAPS = {
  arena: {
    name: "Arena District",
    width: 1280,
    height: 720,
    obstacles: [
      { x: 280, y: 180, w: 200, h: 40 },
      { x: 760, y: 140, w: 260, h: 40 },
      { x: 540, y: 320, w: 200, h: 120 },
      { x: 180, y: 520, w: 280, h: 40 },
      { x: 860, y: 500, w: 220, h: 40 }
    ],
    spawns: [
      { x: 80, y: 80 },
      { x: 1200, y: 80 },
      { x: 80, y: 640 },
      { x: 1200, y: 640 },
      { x: 640, y: 80 },
      { x: 640, y: 640 }
    ]
  },
  canyon: {
    name: "Canyon Works",
    width: 1280,
    height: 720,
    obstacles: [
      { x: 200, y: 250, w: 880, h: 50 },
      { x: 160, y: 470, w: 240, h: 40 },
      { x: 470, y: 470, w: 340, h: 40 },
      { x: 880, y: 470, w: 240, h: 40 },
      { x: 570, y: 90, w: 140, h: 90 }
    ],
    spawns: [
      { x: 100, y: 100 },
      { x: 1180, y: 100 },
      { x: 100, y: 620 },
      { x: 1180, y: 620 },
      { x: 640, y: 620 },
      { x: 640, y: 100 }
    ]
  }
};

const WEAPONS = {
  pistol: { name: "Pistol", damage: 20, range: 540, spread: 0.025, pellets: 1, cooldown: 260, speedPenalty: 1.0 },
  ar: { name: "Assault", damage: 12, range: 620, spread: 0.09, pellets: 1, cooldown: 100, speedPenalty: 0.95 },
  shotgun: { name: "Shotgun", damage: 10, range: 320, spread: 0.38, pellets: 8, cooldown: 750, speedPenalty: 0.84 },
  sniper: { name: "Sniper", damage: 52, range: 950, spread: 0.01, pellets: 1, cooldown: 950, speedPenalty: 0.9 }
};

const PLAYER_RADIUS = 16;
const BASE_SPEED = 250;

let user = null;
let roomId = null;
let currentMap = MAPS.arena;
let localPlayer = null;
let players = new Map();
let roomUnsub = null;
let playersUnsub = null;
let keyState = {};
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let lastFrame = performance.now();
let lastNetworkPush = 0;
let lastShotAt = 0;
let recentTracers = [];

const palette = ["#38bdf8", "#84cc16", "#f97316", "#e879f9", "#22d3ee", "#f43f5e", "#facc15"];

function setStatus(msg, isError = false) {
  statusText.textContent = msg;
  statusText.className = isError ? "text-sm text-rose-300" : "text-sm text-slate-300";
}

function randCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getRoomRef(code) {
  return doc(db, "rooms", code);
}

function getPlayersCol(code) {
  return collection(db, "rooms", code, "players");
}

function getPlayerRef(code, uid) {
  return doc(db, "rooms", code, "players", uid);
}

function pickSpawn(map) {
  const s = map.spawns[Math.floor(Math.random() * map.spawns.length)];
  return { x: s.x, y: s.y };
}

function collidesWithMap(x, y) {
  if (x - PLAYER_RADIUS < 0 || y - PLAYER_RADIUS < 0 || x + PLAYER_RADIUS > currentMap.width || y + PLAYER_RADIUS > currentMap.height) {
    return true;
  }
  for (const o of currentMap.obstacles) {
    const closestX = clamp(x, o.x, o.x + o.w);
    const closestY = clamp(y, o.y, o.y + o.h);
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {
      return true;
    }
  }
  return false;
}

function getPlayerName() {
  const v = nameInput.value.trim();
  return v ? v.slice(0, 16) : `Player-${user.uid.slice(0, 4)}`;
}

function showGameUI(inRoom) {
  menuPanel.classList.toggle("hidden", inRoom);
  hudPanel.classList.toggle("hidden", !inRoom);
}

function drawWeaponButtons() {
  weaponButtons.innerHTML = "";
  Object.entries(WEAPONS).forEach(([key, w], i) => {
    const btn = document.createElement("button");
    btn.textContent = `${i + 1}. ${w.name}`;
    btn.className = "rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs font-semibold hover:border-accent";
    btn.onclick = () => {
      if (!localPlayer) return;
      localPlayer.weapon = key;
      queuePlayerSync(true);
    };
    weaponButtons.appendChild(btn);
  });
}

function lineRectHit(x1, y1, x2, y2, rect) {
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t);
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return true;
    }
  }
  return false;
}

function lineCircleDistance(px, py, qx, qy, cx, cy) {
  const vx = qx - px;
  const vy = qy - py;
  const wx = cx - px;
  const wy = cy - py;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(cx - px, cy - py);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(cx - qx, cy - qy);
  const b = c1 / c2;
  const bx = px + b * vx;
  const by = py + b * vy;
  return Math.hypot(cx - bx, cy - by);
}

async function applyDamage(targetUid, damage) {
  if (!roomId || !user) return;
  const targetRef = getPlayerRef(roomId, targetUid);
  const shooterRef = getPlayerRef(roomId, user.uid);
  await runTransaction(db, async (tx) => {
    const targetSnap = await tx.get(targetRef);
    const shooterSnap = await tx.get(shooterRef);
    if (!targetSnap.exists() || !shooterSnap.exists()) return;

    const target = targetSnap.data();
    const shooter = shooterSnap.data();
    if (!target.alive || !shooter.alive) return;

    const hp = (target.hp ?? 100) - damage;
    if (hp <= 0) {
      tx.update(targetRef, {
        hp: 0,
        alive: false,
        deaths: (target.deaths ?? 0) + 1,
        respawnAt: Date.now() + 3000,
        updatedAt: serverTimestamp()
      });
      tx.update(shooterRef, {
        kills: (shooter.kills ?? 0) + 1,
        updatedAt: serverTimestamp()
      });
    } else {
      tx.update(targetRef, {
        hp,
        updatedAt: serverTimestamp()
      });
    }
  });
}

async function tryShoot() {
  if (!localPlayer?.alive || !roomId) return;
  const gun = WEAPONS[localPlayer.weapon] || WEAPONS.pistol;
  const now = Date.now();
  if (now - lastShotAt < gun.cooldown) return;
  lastShotAt = now;

  const targets = [...players.values()].filter((p) => p.uid !== user.uid && p.alive);
  const damageByTarget = new Map();

  for (let i = 0; i < gun.pellets; i++) {
    const spread = (Math.random() - 0.5) * gun.spread;
    const angle = localPlayer.dir + spread;
    const ex = localPlayer.x + Math.cos(angle) * gun.range;
    const ey = localPlayer.y + Math.sin(angle) * gun.range;

    let blocked = false;
    for (const obstacle of currentMap.obstacles) {
      if (lineRectHit(localPlayer.x, localPlayer.y, ex, ey, obstacle)) {
        blocked = true;
        break;
      }
    }

    let hitTarget = null;
    let bestDist = Infinity;

    if (!blocked) {
      for (const t of targets) {
        const distToRay = lineCircleDistance(localPlayer.x, localPlayer.y, ex, ey, t.x, t.y);
        if (distToRay < PLAYER_RADIUS) {
          const d = Math.hypot(t.x - localPlayer.x, t.y - localPlayer.y);
          if (d < bestDist) {
            bestDist = d;
            hitTarget = t;
          }
        }
      }
    }

    recentTracers.push({ x1: localPlayer.x, y1: localPlayer.y, x2: ex, y2: ey, t: now });

    if (hitTarget) {
      damageByTarget.set(hitTarget.uid, (damageByTarget.get(hitTarget.uid) || 0) + gun.damage);
    }
  }

  for (const [targetUid, damage] of damageByTarget.entries()) {
    await applyDamage(targetUid, damage);
  }
}

function syncOverlay() {
  if (!localPlayer) {
    overlay.classList.add("hidden");
    return;
  }
  if (!localPlayer.alive) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    const left = Math.max(0, Math.ceil(((localPlayer.respawnAt || Date.now()) - Date.now()) / 1000));
    overlayText.textContent = `Respawning in ${left}s...`;
  } else {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }
}

async function maybeRespawn() {
  if (!localPlayer || localPlayer.alive || !roomId) return;
  if ((localPlayer.respawnAt || 0) > Date.now()) return;

  const spawn = pickSpawn(currentMap);
  localPlayer = {
    ...localPlayer,
    x: spawn.x,
    y: spawn.y,
    hp: 100,
    alive: true,
    respawnAt: 0
  };

  await setDoc(getPlayerRef(roomId, user.uid), {
    x: spawn.x,
    y: spawn.y,
    hp: 100,
    alive: true,
    respawnAt: 0,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function drawMap() {
  const g = ctx.createLinearGradient(0, 0, 0, currentMap.height);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#111827");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, currentMap.width, currentMap.height);

  ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
  for (let x = 0; x < currentMap.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, currentMap.height);
    ctx.stroke();
  }
  for (let y = 0; y < currentMap.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(currentMap.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#334155";
  currentMap.obstacles.forEach((o) => {
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  });
}

function drawTracers() {
  const now = Date.now();
  recentTracers = recentTracers.filter((t) => now - t.t < 120);
  for (const t of recentTracers) {
    const a = 1 - (now - t.t) / 120;
    ctx.strokeStyle = `rgba(250, 204, 21, ${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
}

function drawPlayers() {
  const list = [...players.values()];
  for (const p of list) {
    const alpha = p.alive ? 1 : 0.35;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color || "#38bdf8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.dir || 0) * 24, p.y + Math.sin(p.dir || 0) * 24);
    ctx.stroke();

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(p.x - 22, p.y - 30, 44, 6);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(p.x - 22, p.y - 30, 44 * ((p.hp || 0) / 100), 6);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${p.name || "Player"} (${p.kills || 0})`, p.x, p.y - 38);
  }
  ctx.globalAlpha = 1;
}

function drawHudText() {
  if (!localPlayer) return;
  const gun = WEAPONS[localPlayer.weapon] || WEAPONS.pistol;
  ctx.fillStyle = "rgba(2, 6, 23, 0.7)";
  ctx.fillRect(16, 16, 220, 86);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`HP: ${Math.max(0, Math.floor(localPlayer.hp || 0))}`, 28, 40);
  ctx.fillText(`Weapon: ${gun.name}`, 28, 62);
  ctx.fillText(`Kills: ${localPlayer.kills || 0}`, 28, 84);

  ctx.strokeStyle = "rgba(226, 232, 240, 0.9)";
  ctx.beginPath();
  ctx.moveTo(mouse.x - 8, mouse.y);
  ctx.lineTo(mouse.x + 8, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 8);
  ctx.lineTo(mouse.x, mouse.y + 8);
  ctx.stroke();
}

function updateLeaderboard() {
  const sorted = [...players.values()].sort((a, b) => (b.kills || 0) - (a.kills || 0));
  leaderboard.innerHTML = "";
  for (const p of sorted.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs";
    row.innerHTML = `<span>${p.name || "Player"}</span><span>K ${p.kills || 0} / D ${p.deaths || 0}</span>`;
    leaderboard.appendChild(row);
  }
}

function queuePlayerSync(force = false) {
  if (!roomId || !user || !localPlayer) return;
  const now = performance.now();
  if (!force && now - lastNetworkPush < 55) return;
  lastNetworkPush = now;

  setDoc(getPlayerRef(roomId, user.uid), {
    name: localPlayer.name,
    x: localPlayer.x,
    y: localPlayer.y,
    dir: localPlayer.dir,
    hp: localPlayer.hp,
    alive: localPlayer.alive,
    weapon: localPlayer.weapon,
    kills: localPlayer.kills || 0,
    deaths: localPlayer.deaths || 0,
    respawnAt: localPlayer.respawnAt || 0,
    color: localPlayer.color,
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

function updateLocal(dt) {
  if (!localPlayer?.alive) return;
  let vx = 0;
  let vy = 0;
  if (keyState["w"]) vy -= 1;
  if (keyState["s"]) vy += 1;
  if (keyState["a"]) vx -= 1;
  if (keyState["d"]) vx += 1;

  const len = Math.hypot(vx, vy) || 1;
  const gun = WEAPONS[localPlayer.weapon] || WEAPONS.pistol;
  const speed = BASE_SPEED * gun.speedPenalty;
  vx = (vx / len) * speed;
  vy = (vy / len) * speed;

  const nx = localPlayer.x + vx * dt;
  const ny = localPlayer.y + vy * dt;

  if (!collidesWithMap(nx, localPlayer.y)) localPlayer.x = nx;
  if (!collidesWithMap(localPlayer.x, ny)) localPlayer.y = ny;

  localPlayer.dir = Math.atan2(mouse.y - localPlayer.y, mouse.x - localPlayer.x);
}

function tick(ts) {
  const dt = Math.min(0.05, (ts - lastFrame) / 1000);
  lastFrame = ts;

  if (roomId && localPlayer) {
    updateLocal(dt);
    queuePlayerSync();
    maybeRespawn();
    syncOverlay();
  }

  drawMap();
  drawTracers();
  drawPlayers();
  drawHudText();

  requestAnimationFrame(tick);
}

async function createRoom() {
  if (!user) return;
  let code = randCode();
  let attempts = 0;

  while (attempts < 6) {
    const roomRef = getRoomRef(code);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      await setDoc(roomRef, {
        createdAt: serverTimestamp(),
        hostId: user.uid,
        mapKey: mapSelect.value,
        status: "active"
      });
      await joinRoom(code);
      return;
    }
    code = randCode();
    attempts += 1;
  }

  setStatus("Failed to create room. Try again.", true);
}

async function joinRoom(codeRaw) {
  const code = codeRaw.trim().toUpperCase();
  if (!user || !code) return;

  const roomRef = getRoomRef(code);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    setStatus("Room not found.", true);
    return;
  }

  roomId = code;
  const roomData = roomSnap.data();
  currentMap = MAPS[roomData.mapKey] || MAPS.arena;

  const spawn = pickSpawn(currentMap);
  localPlayer = {
    uid: user.uid,
    name: getPlayerName(),
    x: spawn.x,
    y: spawn.y,
    dir: 0,
    hp: 100,
    alive: true,
    weapon: "pistol",
    kills: 0,
    deaths: 0,
    respawnAt: 0,
    color: palette[Math.floor(Math.random() * palette.length)]
  };

  await setDoc(getPlayerRef(code, user.uid), {
    ...localPlayer,
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp()
  });

  roomCodeText.textContent = code;
  mapNameText.textContent = currentMap.name;
  youText.textContent = localPlayer.name;

  watchRoom();
  showGameUI(true);
  setStatus("In room. Fight!", false);
}

function watchRoom() {
  if (!roomId) return;
  roomUnsub?.();
  playersUnsub?.();

  roomUnsub = onSnapshot(getRoomRef(roomId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    currentMap = MAPS[data.mapKey] || MAPS.arena;
    mapNameText.textContent = currentMap.name;
  });

  playersUnsub = onSnapshot(getPlayersCol(roomId), (snap) => {
    players = new Map();
    snap.forEach((d) => {
      const p = d.data();
      players.set(d.id, { uid: d.id, ...p });
    });

    const freshMe = players.get(user.uid);
    if (freshMe) {
      localPlayer = { ...localPlayer, ...freshMe, uid: user.uid };
      youText.textContent = `${localPlayer.name}`;
    }
    updateLeaderboard();
  });
}

async function leaveRoom() {
  if (!roomId || !user) return;

  const oldRoom = roomId;
  roomUnsub?.();
  playersUnsub?.();
  roomUnsub = null;
  playersUnsub = null;

  try {
    await deleteDoc(getPlayerRef(oldRoom, user.uid));
  } catch (_) {}

  roomId = null;
  players = new Map();
  localPlayer = null;
  showGameUI(false);
  leaderboard.innerHTML = "";
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  setStatus("Left room.");
}

window.addEventListener("beforeunload", () => {
  if (roomId && user) {
    deleteDoc(getPlayerRef(roomId, user.uid)).catch(() => {});
  }
});

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keyState[k] = true;
  if (!localPlayer) return;
  if (k === "1") localPlayer.weapon = "pistol";
  if (k === "2") localPlayer.weapon = "ar";
  if (k === "3") localPlayer.weapon = "shotgun";
  if (k === "4") localPlayer.weapon = "sniper";
});

window.addEventListener("keyup", (e) => {
  keyState[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
  mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) tryShoot();
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", () => joinRoom(roomCodeInput.value));
leaveRoomBtn.addEventListener("click", leaveRoom);

drawWeaponButtons();
showGameUI(false);
requestAnimationFrame(tick);

onAuthStateChanged(auth, (u) => {
  if (u) {
    user = u;
    setStatus(`Signed in. UID: ${u.uid.slice(0, 8)}...`);
  }
});

signInAnonymously(auth).catch((err) => {
  setStatus(`Auth error: ${err.message}`, true);
});
