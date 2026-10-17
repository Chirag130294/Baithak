// Picks the right store. Demo (local) mode needs nothing. Live mode needs js/config.js filled in.
import { firebaseConfig, features } from '../../config.js';
import { createLocalStore } from './local.js';

export async function createStore() {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL) {
    try {
      const { createFirebaseStore } = await import('./firebase.js');
      return await createFirebaseStore(firebaseConfig, features);
    } catch (e) {
      console.warn('Firebase could not start, using demo mode instead.', e);
      const s = createLocalStore();
      s.fallbackReason = e && e.message ? e.message : 'Firebase failed to load';
      return s;
    }
  }
  return createLocalStore();
}
