// Demo store: everything lives in this phone's browser. Other browser tabs on the same phone stay in sync.
import { ls, rid } from '../util.js';

const RK = (c) => 'baithak:room:' + c;
const PK = (c) => 'baithak:presence:' + c;
const hasWindow = typeof window !== 'undefined';
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('baithak') : null;
const roomListeners = new Map();

function emit(code) {
  const r = ls.get(RK(code), null);
  (roomListeners.get(code) || []).forEach((cb) => cb(r));
}
if (bc) bc.addEventListener('message', (e) => { if (e.data && e.data.code) emit(e.data.code); });
if (hasWindow) window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('baithak:room:')) emit(e.key.slice('baithak:room:'.length)); });
const announce = (code) => { emit(code); if (bc) bc.postMessage({ code }); };

function clientId() {
  let c = ls.get('baithak:cid', null);
  if (!c) { c = 'c_' + rid(10); ls.set('baithak:cid', c); }
  return c;
}

export function createLocalStore() {
  const authListeners = new Set();
  let user = ls.get('baithak:user', null);
  const notify = () => authListeners.forEach((cb) => cb(user));

  return {
    mode: 'local',
    auth: {
      current: () => user,
      onChange(cb) { authListeners.add(cb); cb(user); return () => authListeners.delete(cb); },
      async signInGuest(name) {
        user = { uid: (user && user.uid) || 'u_' + rid(10), name: (name || 'Guest').trim() || 'Guest', isGuest: true, provider: 'guest' };
        ls.set('baithak:user', user); notify(); return user;
      },
      async signInGoogle() { throw new Error('Google login needs Firebase. See the README (step 2).'); },
      async sendEmailLink() { throw new Error('Email login needs Firebase. See the README (step 2).'); },
      async completeEmailLink() { return null; },
      phone: { async start() { throw new Error('Phone login needs Firebase and the Blaze plan.'); } },
      async updateName(name) { if (!user) return; user = { ...user, name: name.trim() || user.name }; ls.set('baithak:user', user); notify(); },
      async signOut() { user = null; ls.del('baithak:user'); notify(); }
    },

    rooms: {
      async create(room) { ls.set(RK(room.code), room); announce(room.code); return room; },
      async get(code) { return ls.get(RK(code), null); },
      watch(code, cb) {
        if (!roomListeners.has(code)) roomListeners.set(code, new Set());
        roomListeners.get(code).add(cb);
        cb(ls.get(RK(code), null));
        return () => roomListeners.get(code) && roomListeners.get(code).delete(cb);
      },
      async update(code, patch) {
        const cur = ls.get(RK(code), null);
        if (!cur) throw new Error('Room not found');
        ls.set(RK(code), { ...cur, ...patch });
        announce(code);
      },
      async remove(code) { ls.del(RK(code)); ls.del(PK(code)); announce(code); },
      async listMine(uid) {
        return ls.keys('baithak:room:').map((k) => ls.get(k, null)).filter((r) => r && r.hostUid === uid)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }
    },

    profile: {
      async get(uid) { return ls.get('baithak:profile:' + uid, {}); },
      async save(uid, obj) { ls.set('baithak:profile:' + uid, obj); }
    },

    presence: {
      join(code) {
        const cid = clientId();
        const beat = () => { const m = ls.get(PK(code), {}); m[cid] = Date.now(); ls.set(PK(code), m); };
        beat();
        const iv = setInterval(beat, 15000);
        return () => { clearInterval(iv); const m = ls.get(PK(code), {}); delete m[cid]; ls.set(PK(code), m); };
      },
      watch(code, cb) {
        const calc = () => { const m = ls.get(PK(code), {}); cb(Object.values(m).filter((ts) => Date.now() - ts < 45000).length); };
        calc();
        const iv = setInterval(calc, 5000);
        return () => clearInterval(iv);
      }
    }
  };
}
