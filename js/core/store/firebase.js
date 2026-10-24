// Live store: Firebase Authentication + Realtime Database, loaded from Google's CDN only when a config is present.
// Free plan covers Google login, email-link login, anonymous guests and the database for a friends-and-family app.
import { clean } from '../names.js';
import { ls, rid } from '../util.js';
import { FIREBASE_SDK_VERSION, appCheckSiteKey } from '../../config.js';

function clientId() {
  let c = ls.get('baithak:cid', null);
  if (!c) { c = 'c_' + rid(10); ls.set('baithak:cid', c); }
  return c;
}

export async function createFirebaseStore(cfg, features = {}) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;
  const [appM, authM, dbM] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-database.js')
  ]);
  const app = appM.initializeApp(cfg);
  // App Check must start before anything talks to Firebase. If it cannot start the app still works (enforcement is switched on in the console).
  if (appCheckSiteKey) {
    try {
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;   // dev machines register the debug token printed in the console
      const acM = await import(base + 'firebase-app-check.js');
      acM.initializeAppCheck(app, { provider: new acM.ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    } catch (e) { console.warn('App Check did not start', e); }
  }
  const auth = authM.getAuth(app);
  const db = dbM.getDatabase(app);

  const listeners = new Set();
  let current = null;
  const map = (u) => u && ({
    uid: u.uid,
    name: clean(u.displayName || (u.isAnonymous ? 'Guest' : (u.email ? u.email.split('@')[0] : (u.phoneNumber || 'Player')))),
    photo: u.photoURL || null,
    email: u.email || null,
    isGuest: !!u.isAnonymous,
    provider: u.isAnonymous ? 'guest' : ((u.providerData && u.providerData[0] && u.providerData[0].providerId) || 'firebase')
  });
  const notify = () => listeners.forEach((cb) => cb(current));
  let ready;
  const firstState = new Promise((r) => { ready = r; });
  authM.onAuthStateChanged(auth, (u) => { current = map(u); notify(); ready(); });
  authM.getRedirectResult(auth).catch(() => { /* a failed redirect just leaves the user signed out */ });
  await Promise.race([firstState, new Promise((r) => setTimeout(r, 2500))]);

  const R = (p) => dbM.ref(db, p);

  return {
    mode: 'firebase',
    auth: {
      current: () => current,
      onChange(cb) { listeners.add(cb); cb(current); return () => listeners.delete(cb); },
      async signInGuest(name) {
        const cred = await authM.signInAnonymously(auth);
        if (name) await authM.updateProfile(cred.user, { displayName: clean(name) });
        current = map(auth.currentUser); notify(); return current;
      },
      async signInGoogle() {
        const provider = new authM.GoogleAuthProvider();
        const standaloneIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && window.navigator.standalone === true;
        if (standaloneIOS) { await authM.signInWithRedirect(auth, provider); return null; } // popups do not work in an installed iPhone app
        try { await authM.signInWithPopup(auth, provider); }
        catch (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
            await authM.signInWithRedirect(auth, provider);
          } else if (e && e.code === 'auth/popup-closed-by-user') { return null; }
          else throw e;
        }
        return current;
      },
      async sendEmailLink(email) {
        const url = location.origin + location.pathname;
        await authM.sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
        ls.set('baithak:emailForSignIn', email);
      },
      async completeEmailLink() {
        if (!authM.isSignInWithEmailLink(auth, location.href)) return null;
        let email = ls.get('baithak:emailForSignIn', null);
        if (!email) email = (prompt('Please type the email you used to sign in') || '').trim();
        if (!email) return null;
        await authM.signInWithEmailLink(auth, email, location.href);
        ls.del('baithak:emailForSignIn');
        history.replaceState(null, '', location.pathname + '#/');
        return current;
      },
      phone: {
        // Needs the Blaze plan on Firebase. Hidden unless features.phoneLogin is true.
        async start(phoneNumber, containerId) {
          const verifier = new authM.RecaptchaVerifier(auth, containerId, { size: 'invisible' });
          const confirmation = await authM.signInWithPhoneNumber(auth, phoneNumber, verifier);
          return { confirm: (code) => confirmation.confirm(code) };
        }
      },
      async updateName(name) {
        if (!auth.currentUser) return;
        await authM.updateProfile(auth.currentUser, { displayName: clean(name) });
        current = map(auth.currentUser); notify();
      },
      async signOut() { await authM.signOut(auth); }
    },

    rooms: {
      // Creates the room and its first audit entry in one atomic write.
      async create(room, entry, opts = {}) {
        const key = dbM.push(R('audits/' + room.code)).key;
        const up = { ['rooms/' + room.code]: room };
        up[`userMeta/${room.hostUid}/lastCreate`] = dbM.serverTimestamp();   // the rules use this to allow one new room per 10 seconds per account
        if (opts.pinHash) up['roomPins/' + room.code] = opts.pinHash;
        if (entry) up[`audits/${room.code}/${key}`] = { ...entry, ts: dbM.serverTimestamp() };
        up[`userRooms/${room.hostUid}/${room.code}`] = room.updatedAt || Date.now();   // same atomic write: one round trip
        await dbM.update(dbM.ref(db), up);
        return room;
      },
      async get(code) { const s = await dbM.get(R('rooms/' + code)); return s.exists() ? s.val() : null; },
      // Private rooms: prove you know the PIN by writing its hash. The rules accept it only when it matches. A watcher needs an (anonymous) account for this.
      async unlock(code, hash) {
        if (!auth.currentUser) await authM.signInAnonymously(auth);
        await dbM.set(R(`access/${code}/${auth.currentUser.uid}`), hash);
      },
      watch(code, cb) {
        return dbM.onValue(R('rooms/' + code), (s) => cb(s.exists() ? s.val() : null), () => cb(null, true));
      },
      // Saves the scores and appends audit entries in ONE atomic write: either both happen or neither does.
      async commit(code, { data, entries = [], lock = false }) {
        const up = { [`rooms/${code}/data`]: data, [`rooms/${code}/updatedAt`]: Date.now() };
        if (lock) up[`rooms/${code}/status`] = 'completed';
        entries.forEach((e) => { up[`audits/${code}/${dbM.push(R('audits/' + code)).key}`] = { ...e, ts: dbM.serverTimestamp() }; });
        await dbM.update(dbM.ref(db), up);
      },
      async audit(code) {
        const s = await dbM.get(R('audits/' + code));
        return s.exists() ? Object.entries(s.val()).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.ts - b.ts) : [];
      },
      // Rooms are never deleted (the audit trail must stay). "Remove" only hides the room from this person's list.
      async remove(code, uid) { if (uid) await dbM.remove(R(`userRooms/${uid}/${code}`)); },
      async listMine(uid) {
        const s = await dbM.get(R('userRooms/' + uid));
        if (!s.exists()) return [];
        const codes = Object.entries(s.val()).sort((a, b) => b[1] - a[1]).slice(0, 30).map((e) => e[0]);
        const rooms = await Promise.all(codes.map((c) => this.get(c).catch(() => null)));
        return rooms.filter(Boolean);
      }
    },

    profile: {
      async get(uid) {
        const s = await dbM.get(R(`profiles/${uid}/data`));
        try { return s.exists() ? JSON.parse(s.val()) : {}; } catch { return {}; }
      },
      async save(uid, obj) { await dbM.set(R(`profiles/${uid}/data`), JSON.stringify(obj)); }
    },

    reactions: {
      async send(code, r) {
        const ref = dbM.push(R('reactions/' + code));
        // one write: the reaction plus the room's "last reaction" stamp the rules use to limit the rate
        await dbM.update(dbM.ref(db), { [`reactions/${code}/${ref.key}`]: { k: r.k, from: String(r.from || '').slice(0, 24), to: String(r.to || '').slice(0, 40), ts: dbM.serverTimestamp() }, [`rxLast/${code}`]: dbM.serverTimestamp() });
        setTimeout(() => dbM.remove(ref).catch(() => {}), 20000); // tidy up our own reaction (the rules allow removal after 15 s)
      },
      watch(code, cb) {
        let off = () => {}, dead = false;
        const base = R('reactions/' + code);
        dbM.get(dbM.query(base, dbM.orderByKey(), dbM.limitToLast(1))).then((snap) => {
          if (dead) return;
          let lastKey = null; snap.forEach((c) => { lastKey = c.key; });
          const q = lastKey ? dbM.query(base, dbM.orderByKey(), dbM.startAfter(lastKey)) : base;
          off = dbM.onChildAdded(q, (c) => { const v = c.val(); if (v && v.k) cb({ id: c.key, ...v }); });
        }).catch(() => {});
        return () => { dead = true; off(); };
      }
    },

    presence: {
      join(code) {
        const r = R(`presence/${code}/${clientId()}`);
        const beat = () => dbM.set(r, Date.now()).catch(() => {});
        beat();
        dbM.onDisconnect(r).remove().catch(() => {});
        const iv = setInterval(beat, 25000);
        return () => { clearInterval(iv); dbM.remove(r).catch(() => {}); };
      },
      watch(code, cb) {
        let last = {};
        const calc = () => cb(Object.values(last).filter((ts) => Date.now() - ts < 60000).length);
        const off = dbM.onValue(R('presence/' + code), (s) => { last = s.exists() ? s.val() : {}; calc(); });
        const iv = setInterval(calc, 20000);
        return () => { off(); clearInterval(iv); };
      }
    }
  };
}
