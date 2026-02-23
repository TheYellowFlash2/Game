# Platform Tag Rooms

Multiplayer HTML5 platformer tag game with:
- Room create/join flow
- Real-time players via Firestore
- Platformer movement (run + jump + gravity)
- Big maps larger than the screen (camera follows your player)
- Tag transfer by touching players
- Centered gameplay view when in a room

## 1) Firebase Console Setup

1. Open Firebase Console: https://console.firebase.google.com/
2. Project: `game-61407`
3. Go to `Authentication` -> `Sign-in method` -> enable `Anonymous`.
4. Go to `Firestore Database` -> create database in Production mode.
5. In Firestore Rules, paste contents of `firestore.rules` and publish.

## 2) Local Run

```bash
cd /home/phillipwrencher5/Game
python3 -m http.server 5500
```

Open:
- http://localhost:5500

Open multiple tabs/devices, create room in one tab, join the room code in others.

## 3) Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
cd /home/phillipwrencher5/Game
firebase login
firebase use game-61407
firebase deploy --only firestore:rules,hosting
```

## Controls

- `A/D` or arrow keys: move
- `W` / `ArrowUp` / `Space`: jump

## Notes

- Current `firestore.rules` are permissive so serverless tag transfer works from clients.
- For anti-cheat, move tag validation to trusted backend logic (Cloud Functions / server).
