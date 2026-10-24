// ---------------------------------------------------------------------------
// Baithak settings. This is the only file you need to edit to go live.
//
// DEMO MODE (default): firebaseConfig is null. Everything works on one phone,
// stored in that phone's browser. Great for trying it out. Friends on other
// phones cannot watch yet.
//
// LIVE MODE: paste your Firebase web app config below (see README step 2).
// You then get Google / email-link login and live viewing on any phone.
// ---------------------------------------------------------------------------

// Your Firebase project (baithak-13712). These web keys are meant to be public; the database rules protect your data.
export const firebaseConfig = {
  apiKey: 'AIzaSyA4krjWlSjv2CSctuTlOJNBgo7GGXTl1Lk',
  authDomain: 'baithak-13712.firebaseapp.com',
  databaseURL: 'https://baithak-13712-default-rtdb.firebaseio.com',
  projectId: 'baithak-13712',
  storageBucket: 'baithak-13712.firebasestorage.app',
  messagingSenderId: '4432327117',
  appId: '1:4432327117:web:42d062e1c3563bdf1a9484',
  measurementId: 'G-V0185J78BV'
};

// Login methods shown on the sign-in screen (only used in live mode).
export const features = {
  google: true,      // free
  emailLink: true,   // free: Firebase emails a sign-in link
  guest: true,       // free: anonymous account, good for trying things
  phoneLogin: false  // SMS codes need the pay-as-you-go (Blaze) plan. Turn on only if you set that up.
};

// Firebase App Check (stops scripts and look-alike sites from using your database). Paste the reCAPTCHA v3 SITE key here after doing
// SECURITY.md step 1. Leave it empty until then; the app works either way.
export const appCheckSiteKey = '';

export const FIREBASE_SDK_VERSION = '10.14.1';
export const APP_VERSION = '1.7.0';
