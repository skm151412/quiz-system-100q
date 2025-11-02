// Firebase-only deployment configuration
// Set FIREBASE_MODE to true to route all API calls to Firestore via firebase-api.js
// No separate backend origin is required when using Firebase only.

window.FIREBASE_MODE = true;
// Ensure any stale cached configuration is cleared
try { delete window.QUIZ_BACKEND_BASE; } catch (_) { window.QUIZ_BACKEND_BASE = undefined; }
// window.QUIZ_BACKEND_BASE is intentionally unset for Firebase-only mode.
