# Firestore version (reference only)

Baithak itself runs on **Realtime Database** (see `database.rules.json`, `js/core/store/firebase.js`).
If you ever move to Firestore, this is the equivalent. Not emulator-tested: try it in the Rules Playground first.

## Security rules (rules_version 2)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /rooms/{roomId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.hostUid == request.auth.uid
                    && request.resource.data.status == 'live';
      // host only; nothing at all once completed; status can only go live -> completed
      allow update: if request.auth != null
                    && resource.data.hostUid == request.auth.uid
                    && resource.data.status != 'completed'
                    && request.resource.data.hostUid == resource.data.hostUid
                    && request.resource.data.status in ['live', 'completed'];
      allow delete: if false;

      match /auditLog/{entryId} {
        allow read: if true;
        // append-only: create only, never update or delete, and only while the room is not completed
        allow create: if request.auth != null
                      && get(/databases/$(db)/documents/rooms/$(roomId)).data.hostUid == request.auth.uid
                      && get(/databases/$(db)/documents/rooms/$(roomId)).data.status != 'completed'
                      && request.resource.data.uid == request.auth.uid
                      && request.resource.data.ts == request.time;
        allow update, delete: if false;
      }
    }
  }
}
```

Note: inside a batch, `get()` reads the room as it is *before* the batch, so the audit entry that comes with the final lock write is accepted, and anything after it is refused.

## Log an action (room update + audit entry in one batch)

```js
import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';

export async function logAndUpdate(db, { roomId, newScores, actionType, user, summary = '' }) {
  const batch = writeBatch(db);
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { scores: newScores, updatedAt: serverTimestamp() });
  batch.set(doc(collection(roomRef, 'auditLog')), {
    action: actionType,            // 'SCORE' | 'EDIT' | 'UNDO' ...
    uid: user.uid, name: user.displayName || 'Unknown',
    summary, scores: newScores, ts: serverTimestamp()
  });
  await batch.commit();            // both writes succeed or neither does
}
```

## Lock the room

```js
export async function lockRoom(db, { roomId, newScores, user }) {
  const batch = writeBatch(db);
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { scores: newScores, status: 'completed', completedAt: serverTimestamp() });
  batch.set(doc(collection(roomRef, 'auditLog')), {
    action: 'LOCK_ROOM', uid: user.uid, name: user.displayName || 'Unknown',
    summary: 'Room locked', scores: newScores, ts: serverTimestamp()
  });
  await batch.commit();
}
```
