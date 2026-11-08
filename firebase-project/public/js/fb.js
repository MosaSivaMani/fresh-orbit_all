// Firebase setup shared by the shop and the owner panel.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const configured = !/PASTE|YOUR-PROJECT-ID/.test(firebaseConfig.apiKey + firebaseConfig.projectId);

let cache = null;
// Loads the Firebase SDK on demand. Resolves to null when the config has not
// been filled in or the SDK cannot be reached, so callers can fall back.
export async function firebase() {
  if (!configured) return null;
  if (cache) return cache;
  try {
    const [appMod, fs, authMod] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
      import(SDK + 'firebase-auth.js')
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    cache = { app, appMod, fs, authMod, db: fs.getFirestore(app), auth: authMod.getAuth(app) };
    return cache;
  } catch (e) {
    console.warn('Firebase unavailable, using built-in catalogue', e);
    return null;
  }
}
