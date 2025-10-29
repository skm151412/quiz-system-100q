# 🚀 Deploy Quiz System to Render - Quick Reference

## 📋 Checklist (20 minutes)

### ☐ Step 1: Sign Up (2 min)
```
1. Go to: https://render.com
2. Click "Get Started"
3. Sign up with GitHub
4. Verify email
```

### ☐ Step 2: Create Database (3 min)
```
1. Dashboard → "New +" → "PostgreSQL"
2. Name: quiz-system-db
3. Plan: Free
4. Region: Singapore
5. Click "Create Database"
6. COPY "Internal Database URL"
```

### ☐ Step 3: Import Data (5 min)
```
Option A (Easy):
1. Click your database → "Shell" tab
2. Click "Connect"
3. Open file: quiz_system_postgres.sql
4. Copy ALL content
5. Paste in shell and press Enter

Option B (Using psql):
psql "<External Database URL>" -f quiz_system_postgres.sql
```

### ☐ Step 4: Deploy Backend (10 min)
```
1. Dashboard → "New +" → "Web Service"
2. Connect GitHub (or manual)
3. Settings:
   - Name: quiz-system-backend
   - Root Directory: java-backend
   - Environment: Docker
   - Region: Singapore
   - Plan: Free
4. Environment Variables:
   DATABASE_URL = <paste Internal URL from Step 2>
   DATABASE_DRIVER = org.postgresql.Driver
   HIBERNATE_DIALECT = org.hibernate.dialect.PostgreSQLDialect
5. Health Check Path: /actuator/health
6. Click "Create Web Service"
7. Wait 5-10 min for build
8. COPY your service URL when ready
```

### ☐ Step 5: Update Frontend (2 min)
```powershell
# Edit backend-origin.js
window.QUIZ_BACKEND_BASE = 'https://quiz-system-backend.onrender.com';

# Deploy
firebase deploy --only hosting
```

### ☐ Step 6: Test! 🎉
```
Visit: https://quiz-app-f2d9e.web.app
Fill details → Begin Quiz → Should show 100 questions!
```

## 🆘 Troubleshooting

### "Database connection failed"
- ✅ Check DATABASE_URL in environment variables
- ✅ Verify database and backend in same region
- ✅ Ensure DATABASE_DRIVER is `org.postgresql.Driver`

### "Build failed"
- ✅ Check logs in Render dashboard
- ✅ Verify Root Directory is `java-backend`
- ✅ Ensure Docker is selected (not Node/Python)

### "Service takes long to start"
- ✅ Free tier sleeps after inactivity
- ✅ First request takes ~30 seconds
- ✅ This is normal behavior

### "Frontend shows 'Failed to fetch'"
- ✅ Wait 30 seconds (service waking up)
- ✅ Check backend URL in browser: `/actuator/health`
- ✅ Verify backend-origin.js has correct URL

## 📁 Files You Need

```
F:\quiz-system-100q\
├── quiz_system_postgres.sql     ← Database to import
├── backend-origin.js             ← Update with Render URL
└── java-backend/
    └── (everything is ready)
```

## 🎯 URLs After Deployment

```
Frontend: https://quiz-app-f2d9e.web.app
Backend:  https://quiz-system-backend.onrender.com
Database: (private, accessed by backend)
```

## 💰 Cost

**Everything is FREE:**
- PostgreSQL: Free tier (90 days trial)
- Backend: Free tier (750 hours/month)
- Frontend: Firebase free tier

## 📖 Need More Help?

- Quick Start: `RENDER_DEPLOY_NOW.md`
- Detailed Guide: `DEPLOY_RENDER_COMPLETE.md`
- What Changed: `CHANGES_SUMMARY.md`
- Overview: `DEPLOYMENT_READY.md`

## ⚡ Key Points

✅ Your local MySQL is unchanged
✅ Can still develop locally
✅ No code changes needed after initial setup
✅ Permanent URLs (no more tunnels!)
✅ 24/7 availability
✅ Auto-scaling and SSL included

---

**Time to completion: ~20 minutes**
**Difficulty: Easy (mostly clicking buttons)**
**Result: Production-ready quiz system!**
