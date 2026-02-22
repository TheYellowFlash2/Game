# Firebase Battle Rooms

Multiplayer HTML5 top-down shooter with:
- Room create/join flow
- Real-time players via Firestore
- 4 weapons (Pistol, Assault, Shotgun, Sniper)
- 2 maps (Arena District, Canyon Works)
- Respawn flow, kills/deaths scoreboard, clean Tailwind UI

## 1) Firebase Console Setup

1. Open Firebase Console: https://console.firebase.google.com/
2. Project: `game-61407`
3. Go to `Authentication` -> `Sign-in method` -> enable `Anonymous`.
4. Go to `Firestore Database` -> create database in Production mode.
5. In Firestore Rules, paste contents of `firestore.rules` and publish.

## 2) Local Run

From this folder:

```bash
cd /home/phillipwrencher5/Game
python3 -m http.server 5500
```

Open:
- http://localhost:5500

Open multiple tabs/devices, create a room in one, join by code in others.

## 3) Deploy to Firebase Hosting

Install CLI once:

```bash
npm install -g firebase-tools
```

Login and deploy:

```bash
cd /home/phillipwrencher5/Game
firebase login
firebase use game-61407
firebase deploy --only firestore:rules,hosting
```

## Notes

- This is a finished browser multiplayer shooter baseline (2D top-down).
- Current `firestore.rules` are intentionally permissive for serverless PvP writes.
- For stronger anti-cheat and authoritative combat, add a server (Cloud Functions / game server) to validate hits and damage.
