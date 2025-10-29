# Deploy Quiz System to Render (PostgreSQL + Spring Boot)

This guide deploys your complete quiz system to Render.com with PostgreSQL database hosting.

## ✅ Prerequisites
- Render account: https://render.com (sign up with GitHub - FREE)
- Your quiz system code (already prepared with PostgreSQL support)

## 🚀 Step-by-Step Deployment

### Step 1: Create Render Account
1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with your GitHub account
4. Verify your email

### Step 2: Create PostgreSQL Database
1. In Render dashboard, click "New +" button
2. Select "PostgreSQL"
3. Configure:
   - **Name**: `quiz-system-db`
   - **Database**: `quiz_system`
   - **User**: `quiz_user` (auto-generated)
   - **Region**: Singapore (or closest to you)
   - **Plan**: Free
4. Click "Create Database"
5. **IMPORTANT**: Copy the "Internal Database URL" - you'll need it

### Step 3: Import Database Data
1. Once database is created, click on it in your dashboard
2. Scroll down to "Connections"
3. Click "Connect" and copy the "External Database URL" (starts with `postgresql://`)
4. Open PowerShell and run:
   ```powershell
   # Install psql if not already installed (via PostgreSQL installer)
   # Then connect and import data:
   psql "<paste-external-database-url-here>" -f postgres_schema.sql
   
   # Import the converted data:
   python convert_mysql_to_postgres.py
   psql "<paste-external-database-url-here>" -f quiz_system_postgres.sql
   ```

### Step 4: Deploy Spring Boot Backend
1. Push your code to GitHub (if not already):
   ```powershell
   git init
   git add .
   git commit -m "Prepare for Render deployment"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. In Render dashboard, click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `quiz-system-backend`
   - **Region**: Singapore (same as database)
   - **Branch**: main
   - **Root Directory**: `java-backend`
   - **Runtime**: Docker
   - **Docker Command**: (leave empty, uses Dockerfile)
   - **Plan**: Free

5. Add Environment Variables (click "Environment" tab):
   ```
   DATABASE_URL=<internal-database-url-from-step2>
   DATABASE_DRIVER=org.postgresql.Driver
   HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
   DATABASE_USER=quiz_user
   DATABASE_PASSWORD=<password-from-database-url>
   ```

6. Set Health Check Path:
   - Go to "Settings" → scroll to "Health Check Path"
   - Enter: `/actuator/health`

7. Click "Create Web Service"

### Step 5: Wait for Deployment
- Render will build and deploy your backend (takes 5-10 minutes)
- Watch the logs in real-time
- Once deployed, copy your service URL (e.g., `https://quiz-system-backend.onrender.com`)

### Step 6: Update Frontend
1. Edit `backend-origin.js`:
   ```javascript
   window.QUIZ_BACKEND_BASE = 'https://quiz-system-backend.onrender.com';
   ```

2. Deploy to Firebase:
   ```powershell
   firebase deploy --only hosting
   ```

### Step 7: Test Your Quiz System
1. Visit: `https://quiz-app-f2d9e.web.app`
2. Fill in user details
3. Click "Begin Quiz"
4. Quiz should load all 100 questions without errors! 🎉

## 🎯 Your Permanent URLs
- **Frontend**: https://quiz-app-f2d9e.web.app
- **Backend**: https://quiz-system-backend.onrender.com
- **Database**: Hosted on Render (private, accessed by backend only)

## 🔥 Benefits of This Setup
- ✅ Everything in the cloud - no local dependencies
- ✅ Permanent URLs that never change
- ✅ No need to keep your computer running
- ✅ Free tier for everything
- ✅ Students can access anytime, anywhere
- ✅ Auto-scaling and SSL certificates included

## 🐛 Troubleshooting

### Backend build fails
- Check logs in Render dashboard
- Ensure Java 17 is specified in Dockerfile
- Verify pom.xml has PostgreSQL dependency

### Database connection fails
- Verify DATABASE_URL in environment variables
- Check that database and backend are in same region
- Ensure DATABASE_DRIVER is set to `org.postgresql.Driver`

### Frontend shows "Failed to fetch"
- Check backend URL in browser directly: `https://quiz-system-backend.onrender.com/actuator/health`
- Verify backend-origin.js has correct URL
- Check CORS is configured in backend (already done)

### "This service is taking longer than usual to start"
- Free tier services sleep after 15 minutes of inactivity
- First request takes ~30 seconds to wake up
- Subsequent requests are fast

## 📊 Monitor Your Services
- Render Dashboard: https://dashboard.render.com
- View logs, metrics, and health status
- Set up email alerts for downtime

## 💰 Costs
- **Database**: Free tier (90 days, then $7/month or migrate data)
- **Backend**: Free tier (750 hours/month)
- **Frontend**: Firebase Hosting free tier (10GB/month)
- **Total**: FREE for development/student use

## 🔄 Future Updates
When you make changes:
1. Push to GitHub: `git push`
2. Render auto-deploys backend (if auto-deploy enabled)
3. Update frontend: `firebase deploy --only hosting`

---

**Need Help?**
- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
