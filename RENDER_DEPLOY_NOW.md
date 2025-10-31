# Deploy to Render (Web Service)

This repo is a static frontend served by a tiny Node/Express server so it works on Render's Free plan and serves the service worker from the root.

## One‑click: Blueprint deploy

1. In Render, click New > Blueprint.
2. Paste your repo URL and pick the branch to deploy (e.g. main).
3. Render auto-detects `render.yaml` and sets up a Web Service named `quiz-system-100q`.
4. Hit Apply. Build command: `npm ci --omit=dev || npm install --production`, Start: `npm start`.
5. After it's live, open the URL and you should see the quiz.

## Manual (without Blueprint)

1. New > Web Service > Connect the repo/branch.
2. Runtime: Node
3. Build command: `npm install --production`
4. Start command: `npm start`
5. Health check path: `/health`
6. Create the service. Render will provision and deploy.

## Notes
- Service worker is served from `/service-worker.js` with `Service-Worker-Allowed: /`.
- Static assets are cached for 7 days; HTML is `no-store`.
- This frontend uses Firebase (Auth + Firestore) directly from the browser. No server secrets are used.
- If you use the migration script, run it locally: `npm run migrate` with your Firebase Admin cred set via GOOGLE_APPLICATION_CREDENTIALS.

## Troubleshooting
- Build succeeds but service fails to start: ensure Start command is `npm start` and `server.js` exists.
- 404 for deep links: Express falls back to `index.html`, so most GET routes should load the app.
- Mixed content or HTTP issues: Make sure your Firebase config uses https endpoints.
