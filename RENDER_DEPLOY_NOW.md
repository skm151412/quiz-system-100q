# Quiz System - Render Deployment Quick Start

## 🎯 What You Need to Do

Since I don't have access to create accounts or deploy to cloud services, here's what you need to do:

### 1. Create Render Account (2 minutes)
- Go to https://render.com
- Click "Get Started" and sign up with GitHub
- Verify your email

### 2. Create PostgreSQL Database (3 minutes)
1. In Render dashboard, click "New +" → "PostgreSQL"
2. Settings:
   - Name: `quiz-system-db`
   - Plan: Free
   - Region: Singapore (or closest to you)
3. Click "Create Database"
4. **Copy the "Internal Database URL"** (looks like: `postgresql://quiz_user:xxx@xxx/quiz_system`)

### 3. Upload Data to Database (5 minutes)
The database schema and data are ready in `quiz_system_postgres.sql`

**Option A: Use Render Web Shell**
1. In your database dashboard, go to "Shell" tab
2. Click "Connect"
3. Copy and paste the content from `quiz_system_postgres.sql` file

**Option B: Use psql locally**
```powershell
# Get the External Database URL from Render dashboard
# Then run:
psql "postgresql://quiz_user:password@dpg-xxx-a.singapore-postgres.render.com/quiz_system" -f quiz_system_postgres.sql
```

### 4. Deploy Backend (10 minutes)

**Option A: Deploy from GitHub (Recommended)**
1. Push your code to GitHub:
   ```powershell
   git init
   git add .
   git commit -m "Deploy to Render"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. In Render dashboard, click "New +" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - Name: `quiz-system-backend`
   - Root Directory: `java-backend`
   - Environment: Docker
   - Region: Singapore (same as database)
   - Plan: Free

5. Add Environment Variables:
   Click "Advanced" → "Add Environment Variable":
   ```
   DATABASE_URL = <paste-internal-database-url>
   DATABASE_DRIVER = org.postgresql.Driver
   HIBERNATE_DIALECT = org.hibernate.dialect.PostgreSQLDialect
   ```

6. Health Check Path: `/actuator/health`
7. Click "Create Web Service"

**Option B: Deploy Manually**
1. Build the JAR locally:
   ```powershell
   cd java-backend
   mvn clean package -DskipTests
   ```
2. Follow Render's manual deployment guide

### 5. Update Frontend (2 minutes)
1. Once backend is deployed, copy your Render URL (e.g., `https://quiz-system-backend.onrender.com`)
2. Edit `backend-origin.js`:
   ```javascript
   window.QUIZ_BACKEND_BASE = 'https://quiz-system-backend.onrender.com';
   ```
3. Deploy to Firebase:
   ```powershell
   firebase deploy --only hosting
   ```

### 6. Test! 🎉
Visit: https://quiz-app-f2d9e.web.app

## 📁 Files Ready for Deployment
✅ `java-backend/Dockerfile` - Docker configuration for Render
✅ `java-backend/pom.xml` - Updated with PostgreSQL dependency
✅ `java-backend/src/main/resources/application.properties` - Environment variable support
✅ `quiz_system_postgres.sql` - PostgreSQL-compatible database dump
✅ `render.yaml` - Render configuration file

## ⏱️ Total Time: ~20 minutes

## 🆘 Need Help?
Follow the detailed guide in `DEPLOY_RENDER_COMPLETE.md`

## 🎯 End Result
- ✅ Frontend: https://quiz-app-f2d9e.web.app (permanent URL)
- ✅ Backend: https://quiz-system-backend.onrender.com (permanent URL)
- ✅ Database: Hosted on Render (automatic backups)
- ✅ **No more tunnel issues!**
- ✅ **No need to keep your computer running!**
- ✅ **Students can access 24/7!**
