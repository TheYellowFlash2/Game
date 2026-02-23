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
const lobbySection = document.getElementById("lobbySection");
const gameSection = document.getElementById("gameSection");
const roomCodeText = document.getElementById("roomCodeText");
const mapNameText = document.getElementById("mapNameText");
const youText = document.getElementById("youText");
const taggerText = document.getElementById("taggerText");
const leaderboard = document.getElementById("leaderboard");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");

const PLAYER_W = 30;
const PLAYER_H = 44;
const MOVE_SPEED = 460;
const GRAVITY = 1900;
const JUMP_SPEED = 760;
const TAG_DISTANCE = 34;
const TAG_COOLDOWN_MS = 1200;

const MAPS = {
  city: {
    name: "Neon City",
    width: 3800,
    height: 1900,
    platforms: [
      { x: 0, y: 1820, w: 3800, h: 80 },
      { x: 180, y: 1650, w: 340, h: 26 },
      { x: 650, y: 1530, w: 260, h: 24 },
      { x: 1000, y: 1410, w: 300, h: 24 },
      { x: 1450, y: 1280, w: 280, h: 24 },
      { x: 1870, y: 1450, w: 340, h: 24 },
      { x: 2350, y: 1300, w: 260, h: 24 },
      { x: 2730, y: 1160, w: 300, h: 24 },
      { x: 3220, y: 1360, w: 320, h: 24 },
      { x: 250, y: 1160, w: 280, h: 24 },
      { x: 720, y: 1020, w: 250, h: 24 },
      { x: 1180, y: 930, w: 250, h: 24 },
      { x: 1600, y: 820, w: 260, h: 24 },
      { x: 2050, y: 980, w: 300, h: 24 },
      { x: 2500, y: 870, w: 240, h: 24 },
      { x: 2900, y: 730, w: 260, h: 24 },
      { x: 3320, y: 900, w: 250, h: 24 }
    ],
    spawns: [
      { x: 240, y: 1580 },
      { x: 840, y: 1460 },
      { x: 1550, y: 1210 },
      { x: 2380, y: 1230 },
      { x: 3330, y: 1290 },
      { x: 3000, y: 660 }
    ]
  },
  ruins: {
    name: "Sky Ruins",
    width: 3600,
    height: 2000,
    platforms: [
      { x: 0, y: 1920, w: 3600, h: 80 },
      { x: 180, y: 1740, w: 300, h: 26 },
      { x: 580, y: 1600, w: 220, h: 26 },
      { x: 920, y: 1480, w: 300, h: 26 },
      { x: 1320, y: 1620, w: 280, h: 26 },
      { x: 1700, y: 1480, w: 300, h: 26 },
      { x: 2160, y: 1320, w: 240, h: 26 },
      { x: 2500, y: 1450, w: 300, h: 26 },
      { x: 2950, y: 1260, w: 260, h: 26 },
      { x: 3260, y: 1030, w: 230, h: 26 },
      { x: 260, y: 1260, w: 220, h: 26 },
      { x: 630, y: 1110, w: 250, h: 26 },
      { x: 1020, y: 960, w: 220, h: 26 },
      { x: 1400, y: 820, w: 240, h: 26 },
      { x: 1750, y: 700, w: 220, h: 26 },
      { x: 2100, y: 850, w: 260, h: 26 },
      { x: 2520, y: 720, w: 220, h: 26 },
      { x: 2880, y: 600, w: 220, h: 26 }
    ],
    spawns: [
      { x: 220, y: 1680 },
      { x: 900, y: 1420 },
      { x: 1770, y: 1420 },
      { x: 2560, y: 1390 },
      { x: 3300, y: 970 },
      { x: 2940, y: 530 }
    ]
  }
};

let user = null;
let roomId = null;
let currentMap = MAPS.city;
let roomState = null;
let localPlayer = null;
let players = new Map();
let roomUnsub = null;
let playersUnsub = null;
let lastFrame = performance.now();
let lastNetworkPush = 0;
let keyState = {};
let camera = { x: 0, y: 0 };
let touchDebounceUntil = 0;
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

function getRoomRef(code) {
  return doc(db, "rooms", code);
}

function getPlayersCol(code) {
  return collection(db, "rooms", code, "players");
}

function getPlayerRef(code, uid) {
  return doc(db, "rooms", code, "players", uid);
}

function getPlayerName() {
  const v = nameInput.value.trim();
  return v ? v.slice(0, 16) : `Player-${user.uid.slice(0, 4)}`;
}

function pickSpawn(map) {
  const s = map.spawns[Math.floor(Math.random() * map.spawns.length)];
  return { x: s.x, y: s.y };
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function showSections(inRoom) {
  lobbySection.classList.toggle("hidden", inRoom);
  gameSection.classList.toggle("hidden", !inRoom);
}

function localRect(nextX, nextY) {
  return {
    x: nextX - PLAYER_W / 2,
    y: nextY - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H
  };
}

function resolveHorizontalCollision(nextX, nextY) {
  let x = nextX;
  const y = nextY;

  x = clamp(x, PLAYER_W / 2, currentMap.width - PLAYER_W / 2);
  let rect = localRect(x, y);

  for (const p of currentMap.platforms) {
    if (!intersects(rect, p)) continue;
    if (localPlayer.vx > 0) {
      x = p.x - PLAYER_W / 2;
    } else if (localPlayer.vx < 0) {
      x = p.x + p.w + PLAYER_W / 2;
    }
    rect = localRect(x, y);
  }

  return x;
}

function resolveVerticalCollision(nextX, nextY) {
  let y = nextY;
  let onGround = false;

  y = clamp(y, PLAYER_H, currentMap.height + PLAYER_H);
  let rect = localRect(nextX, y);

  for (const p of currentMap.platforms) {
    if (!intersects(rect, p)) continue;

    if (localPlayer.vy > 0) {
      y = p.y;
      onGround = true;
      localPlayer.vy = 0;
    } else if (localPlayer.vy < 0) {
      y = p.y + p.h + PLAYER_H;
      localPlayer.vy = 0;
    }
    rect = localRect(nextX, y);
  }

  if (y > currentMap.height + 20) {
    const spawn = pickSpawn(currentMap);
    y = spawn.y;
    localPlayer.x = spawn.x;
    localPlayer.vx = 0;
    localPlayer.vy = 0;
  }

  return { y, onGround };
}

function updateCamera() {
  if (!localPlayer) return;
  const targetX = localPlayer.x - canvas.width / 2;
  const targetY = localPlayer.y - canvas.height / 2;
  camera.x = clamp(targetX, 0, currentMap.width - canvas.width);
  camera.y = clamp(targetY, 0, currentMap.height - canvas.height);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#111827");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWorld() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  for (let x = 0; x < currentMap.width; x += 80) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.09)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, currentMap.height);
    ctx.stroke();
  }
  for (let y = 0; y < currentMap.height; y += 80) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.09)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(currentMap.width, y);
    ctx.stroke();
  }

  for (const p of currentMap.platforms) {
    ctx.fillStyle = "#334155";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  for (const p of players.values()) {
    const isTagger = roomState?.taggerId === p.uid;
    ctx.fillStyle = isTagger ? "#f43f5e" : (p.color || "#38bdf8");
    ctx.fillRect(p.x - PLAYER_W / 2, p.y - PLAYER_H, PLAYER_W, PLAYER_H);

    if (isTagger) {
      ctx.strokeStyle = "#fda4af";
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x - PLAYER_W / 2 - 2, p.y - PLAYER_H - 2, PLAYER_W + 4, PLAYER_H + 4);
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${p.name || "Player"}`, p.x, p.y - PLAYER_H - 10);
    ctx.fillText(`Tags: ${p.tags || 0}`, p.x, p.y - PLAYER_H - 26);
  }

  ctx.restore();
}

function drawOverlay() {
  if (!localPlayer || !roomState?.taggerId) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    return;
  }

  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
  const youAreTagger = roomState.taggerId === user.uid;
  overlayText.textContent = youAreTagger ? "You are IT - chase someone." : "Run - avoid the tagger.";
}

function updateLeaderboard() {
  const sorted = [...players.values()].sort((a, b) => (b.tags || 0) - (a.tags || 0));
  leaderboard.innerHTML = "";

  sorted.slice(0, 9).forEach((p) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs";
    const marker = roomState?.taggerId === p.uid ? " (IT)" : "";
    row.innerHTML = `<span>${p.name || "Player"}${marker}</span><span>${p.tags || 0} tags</span>`;
    leaderboard.appendChild(row);
  });
}

function queuePlayerSync(force = false) {
  if (!roomId || !localPlayer) return;
  const now = performance.now();
  if (!force && now - lastNetworkPush < 45) return;
  lastNetworkPush = now;

  setDoc(getPlayerRef(roomId, user.uid), {
    name: localPlayer.name,
    x: localPlayer.x,
    y: localPlayer.y,
    vx: localPlayer.vx,
    vy: localPlayer.vy,
    onGround: localPlayer.onGround,
    color: localPlayer.color,
    tags: localPlayer.tags || 0,
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

async function transferTag(targetUid) {
  if (!roomId || !roomState || roomState.taggerId !== user.uid) return;
  if (Date.now() < touchDebounceUntil) return;
  touchDebounceUntil = Date.now() + TAG_COOLDOWN_MS;

  const roomRef = getRoomRef(roomId);
  const yourRef = getPlayerRef(roomId, user.uid);

  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    const yourSnap = await tx.get(yourRef);
    if (!roomSnap.exists() || !yourSnap.exists()) return;

    const roomData = roomSnap.data();
    const yourData = yourSnap.data();
    if (roomData.taggerId !== user.uid) return;

    tx.update(roomRef, {
      taggerId: targetUid,
      lastTagAt: Date.now(),
      updatedAt: serverTimestamp()
    });

    tx.update(yourRef, {
      tags: (yourData.tags || 0) + 1,
      updatedAt: serverTimestamp()
    });
  });
}

function handleTagContact() {
  if (!localPlayer || !roomState || roomState.taggerId !== user.uid) return;

  for (const p of players.values()) {
    if (p.uid === user.uid) continue;
    const d = Math.hypot(localPlayer.x - p.x, localPlayer.y - p.y);
    if (d <= TAG_DISTANCE) {
      transferTag(p.uid).catch(() => {});
      break;
    }
  }
}

function updateLocal(dt) {
  if (!localPlayer) return;

  const movingLeft = keyState["a"] || keyState["arrowleft"];
  const movingRight = keyState["d"] || keyState["arrowright"];
  const jumpPressed = keyState["w"] || keyState["arrowup"] || keyState[" "];

  localPlayer.vx = 0;
  if (movingLeft) localPlayer.vx = -MOVE_SPEED;
  if (movingRight) localPlayer.vx = MOVE_SPEED;

  if (jumpPressed && localPlayer.onGround) {
    localPlayer.vy = -JUMP_SPEED;
    localPlayer.onGround = false;
  }

  localPlayer.vy += GRAVITY * dt;

  const nextX = localPlayer.x + localPlayer.vx * dt;
  const resolvedX = resolveHorizontalCollision(nextX, localPlayer.y);
  localPlayer.x = resolvedX;

  const nextY = localPlayer.y + localPlayer.vy * dt;
  const vertical = resolveVerticalCollision(localPlayer.x, nextY);
  localPlayer.y = vertical.y;
  localPlayer.onGround = vertical.onGround;

  handleTagContact();
}

function tick(ts) {
  const dt = Math.min(0.05, (ts - lastFrame) / 1000);
  lastFrame = ts;

  if (roomId && localPlayer) {
    updateLocal(dt);
    updateCamera();
    queuePlayerSync();
  }

  drawBackground();
  drawWorld();
  drawOverlay();

  requestAnimationFrame(tick);
}

async function createRoom() {
  if (!user) return;
  let code = randCode();

  for (let i = 0; i < 6; i++) {
    const roomRef = getRoomRef(code);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      await setDoc(roomRef, {
        createdAt: serverTimestamp(),
        hostId: user.uid,
        mapKey: mapSelect.value,
        status: "active",
        taggerId: user.uid,
        lastTagAt: 0
      });
      await joinRoom(code);
      return;
    }

    code = randCode();
  }

  setStatus("Could not create room. Try again.", true);
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
  roomState = roomSnap.data();
  currentMap = MAPS[roomState.mapKey] || MAPS.city;
  const spawn = pickSpawn(currentMap);

  localPlayer = {
    uid: user.uid,
    name: getPlayerName(),
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    onGround: false,
    tags: 0,
    color: palette[Math.floor(Math.random() * palette.length)]
  };

  await setDoc(getPlayerRef(roomId, user.uid), {
    ...localPlayer,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (!roomState.taggerId) {
    await setDoc(roomRef, { taggerId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
  }

  roomCodeText.textContent = roomId;
  mapNameText.textContent = currentMap.name;
  youText.textContent = localPlayer.name;
  taggerText.textContent = "...";

  watchRoom();
  showSections(true);
  setStatus("Joined room.");
}

function watchRoom() {
  if (!roomId) return;
  roomUnsub?.();
  playersUnsub?.();

  roomUnsub = onSnapshot(getRoomRef(roomId), (snap) => {
    if (!snap.exists()) return;

    roomState = snap.data();
    currentMap = MAPS[roomState.mapKey] || MAPS.city;
    mapNameText.textContent = currentMap.name;

    const tagger = players.get(roomState.taggerId);
    taggerText.textContent = tagger?.name || (roomState.taggerId === user?.uid ? "You" : "Unknown");
    updateLeaderboard();
  });

  playersUnsub = onSnapshot(getPlayersCol(roomId), (snap) => {
    players = new Map();

    snap.forEach((d) => {
      const p = d.data();
      players.set(d.id, { uid: d.id, ...p });
    });

    const mine = players.get(user.uid);
    if (mine) {
      localPlayer = { ...localPlayer, ...mine, uid: user.uid };
      youText.textContent = localPlayer.name;
    }

    const tagger = players.get(roomState?.taggerId);
    taggerText.textContent = tagger?.name || (roomState?.taggerId === user?.uid ? "You" : "Unknown");
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
  roomState = null;
  localPlayer = null;
  players = new Map();
  leaderboard.innerHTML = "";
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  showSections(false);
  setStatus("Left room.");
}

window.addEventListener("beforeunload", () => {
  if (roomId && user) {
    deleteDoc(getPlayerRef(roomId, user.uid)).catch(() => {});
  }
});

window.addEventListener("keydown", (e) => {
  keyState[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keyState[e.key.toLowerCase()] = false;
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", () => joinRoom(roomCodeInput.value));
leaveRoomBtn.addEventListener("click", leaveRoom);

showSections(false);
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
