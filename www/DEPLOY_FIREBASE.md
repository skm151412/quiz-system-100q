# Deploy to Firebase Hosting + Cloud Run

This guide deploys:
- Frontend (this folder) to Firebase Hosting
- Java Spring Boot backend (`java-backend/`) to Cloud Run

## Prereqs
- Google Cloud SDK (gcloud)
- Firebase CLI (`npm i -g firebase-tools`)
- Google account with a project (ID: `quiz-app-f2d9e` from .firebaserc)

## 1) Deploy backend to Cloud Run
```powershell
# Login and select project
gcloud auth login
gcloud config set project quiz-app-f2d9e

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Deploy from source using Buildpacks
# Adjust region if desired
gcloud run deploy quiz-backend `
  --source .\java-backend `
  --region asia-south1 `
  --allow-unauthenticated

# Note the service URL printed, e.g.:
# https://quiz-backend-xxxxx-asia-south1.run.app
```

## 2) Firebase Hosting (frontend)
The repository already includes:
- `.firebaserc` (default project id)
- `firebase.json` (Hosting config)

You can deploy in two ways:

### A) No rewrites (direct backend calls) — current default
Use this if you prefer to keep Hosting purely static and call your backend directly.

1) Edit `backend-origin.js` and set:
   ```js
   window.QUIZ_BACKEND_BASE = 'https://<your-backend-origin>'; // no trailing slash
   ```
   Examples: Cloud Run URL like `https://quiz-backend-xxxxx-asia-south1.run.app` or your own domain.

2) Ensure both `index.html` and `teacher.html` include `backend-origin.js` before the app scripts (already wired in this repo).

3) Make sure your backend CORS allows your Hosting domains (e.g., https://<project>.web.app and https://<project>.firebaseapp.com).

4) Deploy:
   ```powershell
   firebase login
   firebase deploy --only hosting
   ```

Open the Hosting URL (e.g., https://<project>.web.app). The app will call `https://<your-backend-origin>/api/...` directly.

### B) With rewrites (proxy /api/** to Cloud Run)
If you prefer proxies, add a rewrite in `firebase.json` that points `/api/**` to your Cloud Run service. Then you do not need `backend-origin.js`.

Example rewrite block in `firebase.json`:
```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "quiz-backend",
          "region": "asia-south1"
        }
      }
    ]
  }
}
```
Then deploy Hosting as above. The frontend will call `/api/...` and Hosting will proxy to Cloud Run.

## Local dev
- Backend: `start-quiz-system.bat` or run the Spring Boot app on 8081.
- Frontend: open `index.html` with any static server.
  - In dev on `localhost` or `127.0.0.1`, the app uses `http://<host>:8081/api` automatically.

## Notes
- For option A (No rewrites), set `window.QUIZ_BACKEND_BASE` and ensure backend CORS is open to your Hosting domains.
- For option B (Rewrites), if you deploy the backend to a different region or service name, edit `firebase.json` -> rewrites.run.region/serviceId accordingly.
