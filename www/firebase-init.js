// Firebase initialization for frontend only (ES module via CDN)
// This file is safe to include on Firebase Hosting and local dev.
// If you later use Auth/Firestore/Storage, import their modules similarly.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Your web app's Firebase configuration (public client config)
const firebaseConfig = {
  apiKey: 'AIzaSyDuWPrIC0l4gluDLlm2o-h-UZD9kSS7rTY',
  authDomain: 'quiz-app-f2d9e.firebaseapp.com',
  projectId: 'quiz-app-f2d9e',
  storageBucket: 'quiz-app-f2d9e.firebasestorage.app',
  messagingSenderId: '297656894701',
  appId: '1:297656894701:web:a247ce71fcfb038293b8e4'
};

// Initialize Firebase and expose the app if needed elsewhere
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Enable Firestore offline persistence to allow cached reads in WebView
try {
  enableIndexedDbPersistence(db).catch((err) => {
    // Multiple tabs or unsupported browsers may throw; non-fatal for our flow
    console.warn('[Firebase] IndexedDB persistence not enabled:', err?.code || err?.message || err);
  });
} catch (e) {
  console.warn('[Firebase] Persistence setup failed:', e?.message || e);
}
// Expose globally for non-module scripts
window.firebaseApp = app;
window.firebaseDb = db;

// Initialize Auth and expose helpers
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
window.firebaseAuth = auth;
window.firebaseAuthHelpers = {
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
  signInWithEmailAndPassword: (email, password) => signInWithEmailAndPassword(auth, email, password),
  createUserWithEmailAndPassword: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signOut: () => signOut(auth),
  getCurrentUser: () => auth.currentUser
};

// Signal that Firebase is ready
console.log('[Firebase] Initialization complete');
window.FIREBASE_MODE = true;
