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

export const firebaseConfig = null;
/* Example (replace with your own values from the Firebase console):
export const firebaseConfig = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  databaseURL: 'https://your-project-default-rtdb.firebaseio.com',
  projectId: 'your-project',
  appId: '1:1234567890:web:abcdef'
};
*/

// Login methods shown on the sign-in screen (only used in live mode).
export const features = {
  google: true,      // free
  emailLink: true,   // free: Firebase emails a sign-in link
  guest: true,       // free: anonymous account, good for trying things
  phoneLogin: false  // SMS codes need the pay-as-you-go (Blaze) plan. Turn on only if you set that up.
};

export const FIREBASE_SDK_VERSION = '10.14.1';
export const APP_VERSION = '1.0.0';
