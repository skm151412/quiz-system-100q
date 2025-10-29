CS Fundamentals Quiz (Firebase Only)

Overview
This app serves a 100-question quiz with a student experience and a teacher dashboard, running entirely on Firebase Hosting + Firestore. A Firestore migration script is included to import existing SQL dump data.

What’s included
- Frontend: index.html, script.js, style.css
- Teacher dashboard: teacher.html, teacher.js
- Firebase client init: firebase-init.js (now with Auth), firebase-api.js (Firestore API shim)
- Security: tightened firestore.rules, secure hosting headers in firebase.json
- Offline: basic PWA with manifest + service worker
- Migration: migrations/migrate_to_firestore.js to import quiz data

Prerequisites
- Firebase project created
- Enable Authentication: Email/Password
- Enable Firestore
- (Recommended) Pre-create teacher accounts (email/password) and set role on first login (see below)

Local development
Use Firebase Hosting emulator or just open index.html; Firebase CDN SDKs are used.

Deploy
1) Login and initialize (one time):
	- firebase login
	- firebase init (select Hosting and Firestore Rules if not already present)
2) Deploy:
	- firebase deploy

Security model
- Students and teachers sign in with Email/Password.
- Firestore rules enforce:
  - Public read for subjects/quizzes/questions/options
  - Attempts can be created/read/updated only by the authenticated user who owns them
  - Teacher-only writes to quizzes/questions/options and teacher access to attempts/users
- Role is stored in Firestore users/{uid}. Set role to 'teacher' for teacher accounts.

First-time teacher role
After a teacher signs in, create/update their users/{uid} document with { role: 'teacher' }. You can do this via the dashboard once you add yourself as a teacher, or manually in Firestore console.

Student flow
1) Student enters quiz password (guard), must be offline per exam rules
2) Student enters ID, email, password, and begins
3) App signs in or creates student account, stores profile in users/{uid}, starts attempt, loads questions
4) Answers are saved with debounce; offline cache is supported for questions and queued answers

Teacher flow
1) Sign in at index and choose teacher role
2) You’re redirected to teacher.html; access is protected by Auth + rules (role must be 'teacher')
3) View attempts/users, add/delete questions

Migration
Set GOOGLE_APPLICATION_CREDENTIALS to your service account json or place serviceAccountKey.json in repo root.
Run: npm ci && npm run migrate

Notes
- Security headers are configured in firebase.json
- Service worker provides basic offline caching; adjust ASSETS list as you evolve the app
- The connectivity checker interval is reduced to limit network noise

