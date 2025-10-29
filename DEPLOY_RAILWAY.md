# Deploy Quiz System Backend to Railway

This guide deploys your Spring Boot backend to Railway.app (free tier) so students can access the quiz from the hosted Firebase site without manual tunnel setup.

## Prerequisites
- Railway account: https://railway.app (sign up with GitHub)
- Railway CLI installed (optional, can deploy via web)

## Option A: Deploy via Railway Web UI (Recommended)

1. **Create New Project**
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo"
   - Select your repo or "Deploy from local directory"

2. **Configure Service**
   - Root directory: `/java-backend`
   - Build command: `mvn clean package -DskipTests`
   - Start command: `java -jar target/*.jar`

3. **Set Environment Variables**
   Click "Variables" and add:
   ```
   SPRING_DATASOURCE_URL=jdbc:mysql://YOUR_PUBLIC_IP:3306/quiz_system?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
   SPRING_DATASOURCE_USERNAME=root
   SPRING_DATASOURCE_PASSWORD=626629
   SERVER_PORT=8080
   ```
   
   **Important**: Replace `YOUR_PUBLIC_IP` with your machine's public IP or use a MySQL tunnel service like ngrok for the database connection.

4. **Deploy**
   - Railway will build and deploy automatically
   - Copy the public URL (e.g., `https://quiz-backend-production.up.railway.app`)

5. **Update Frontend**
   - Edit `backend-origin.js`:
     ```js
     window.QUIZ_BACKEND_BASE = 'https://quiz-backend-production.up.railway.app';
     ```
   - Run: `firebase deploy --only hosting`

## Option B: Deploy via Railway CLI

```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd java-backend
railway init

# Set environment variables
railway variables set SPRING_DATASOURCE_URL=jdbc:mysql://YOUR_PUBLIC_IP:3306/quiz_system?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
railway variables set SPRING_DATASOURCE_USERNAME=root
railway variables set SPRING_DATASOURCE_PASSWORD=626629
railway variables set SERVER_PORT=8080

# Deploy
railway up
```

## Alternative: Use Railway MySQL (migrate database)

If you prefer not to expose your local MySQL:

1. Add MySQL service in Railway dashboard
2. Railway will provide connection details
3. Export your local database:
   ```powershell
   mysqldump -u root -p626629 quiz_system > quiz_backup.sql
   ```
4. Import to Railway MySQL:
   ```powershell
   mysql -h <railway-host> -u <railway-user> -p<railway-pass> <railway-db> < quiz_backup.sql
   ```
5. Update SPRING_DATASOURCE_URL to Railway's MySQL URL

## Notes
- Free tier: 500 hours/month (sufficient for testing)
- For production: upgrade to Hobby plan ($5/mo)
- Backend will sleep after 30min inactivity (free tier); first request may be slow
