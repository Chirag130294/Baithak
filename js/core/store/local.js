// Demo store: everything lives in this phone's browser. Other browser tabs on the same phone stay in sync.
import { clean } from '../names.js';
import { ls, rid } from '../util.js';

const RK = (c) => 'baithak:room:' + c;
const PK = (c) => 'baithak:presence:' + c;
const AK = (c) => 'baithak:audit:' + c;
const hasWindow = typeof window !== 'undefined';
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('baithak') : null;
const roomListeners = new Map();

function emit(code) {
  const r = ls.get(RK(code), null);
  (roomListeners.get(code) || []).forEach((cb) => cb(r));
}
const rxListeners = new Map();
const rxEmit = (code, r) => (rxListeners.get(code) || []).forEach((cb) => cb(r));
if (bc) bc.addEventListener('message', (e) => { if (e.data && e.data.rx) rxEmit(e.data.rx, e.data.r); else if (e.data && e.data.code) emit(e.data.code); });
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
        user = { uid: (user && user.uid) || 'u_' + rid(10), name: clean(name || 'Guest') || 'Guest', isGuest: true, provider: 'guest' };
        ls.set('baithak:user', user); notify(); return user;
      },
      async signInGoogle() { throw new Error('Google login needs Firebase. See the README (step 2).'); },
      async sendEmailLink() { throw new Error('Email login needs Firebase. See the README (step 2).'); },
      async completeEmailLink() { return null; },
      phone: { async start() { throw new Error('Phone login needs Firebase and the Blaze plan.'); } },
      async updateName(name) { if (!user) return; user = { ...user, name: clean(name) || user.name }; ls.set('baithak:user', user); notify(); },
      async signOut() { user = null; ls.del('baithak:user'); notify(); }
    },

    rooms: {
      async create(room, entry, opts = {}) {
        if (ls.get(RK(room.code), null)) throw new Error('That room code is taken');   // like the live database: never overwrite a room
        if (opts.pinHash) ls.set('baithak:roompin:' + room.code, opts.pinHash);
        ls.set(RK(room.code), room);
        ls.set(AK(room.code), entry ? [{ ...entry, ts: Date.now(), id: rid(6) }] : []);
        announce(room.code); return room;
      },
      async get(code) {
        const r = ls.get(RK(code), null);
        if (r && r.private) {   // same behaviour as the live rules: private rooms open for the host or after the right PIN
          const u = ls.get('baithak:user', null);
          if (!(u && u.uid === r.hostUid) && !ls.get('baithak:unlock:' + code, false)) throw Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
        }
        return r;
      },
      async unlock(code, hash) {
        if (ls.get('baithak:roompin:' + code, null) !== hash) throw Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
        ls.set('baithak:unlock:' + code, true);
      },
      watch(code, cb) {
        if (!roomListeners.has(code)) roomListeners.set(code, new Set());
        roomListeners.get(code).add(cb);
        cb(ls.get(RK(code), null));
        return () => roomListeners.get(code) && roomListeners.get(code).delete(cb);
      },
      // Same rules as the live database: a completed room refuses changes, the audit log only grows.
      async commit(code, { data, entries = [], lock = false }) {
        const cur = ls.get(RK(code), null);
        if (!cur) throw new Error('Room not found');
        if (cur.status === 'completed') throw new Error('This room is completed and locked.');
        ls.set(RK(code), { ...cur, data, updatedAt: Date.now(), status: lock ? 'completed' : cur.status });
        if (entries.length) ls.set(AK(code), [...ls.get(AK(code), []), ...entries.map((e) => ({ ...e, ts: Date.now(), id: rid(6) }))]);
        announce(code);
      },
      async audit(code) { return ls.get(AK(code), []); },
      async remove(code) { ls.del(RK(code)); ls.del(PK(code)); ls.del(AK(code)); announce(code); },
      async listMine(uid) {
        return ls.keys('baithak:room:').map((k) => ls.get(k, null)).filter((r) => r && r.hostUid === uid)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }
    },

    profile: {
      async get(uid) { return ls.get('baithak:profile:' + uid, {}); },
      async save(uid, obj) { ls.set('baithak:profile:' + uid, obj); }
    },

    reactions: {
      async send(code, r) {
        const full = { id: rid(8), k: r.k, from: r.from || '', to: r.to || '', ts: Date.now() };
        rxEmit(code, full); if (bc) bc.postMessage({ rx: code, r: full });
      },
      watch(code, cb) {
        if (!rxListeners.has(code)) rxListeners.set(code, new Set());
        rxListeners.get(code).add(cb);
        return () => rxListeners.get(code) && rxListeners.get(code).delete(cb);
      }
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
