# Simple One-Click Deploy Solution

Since you want zero manual setup, here's the easiest path:

## Deploy Backend to Render.com (Free, Auto-Deploy)

1. **Create account**: https://render.com (sign up with GitHub)

2. **New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repo or upload manually
   - Root Directory: `java-backend`
   - Environment: `Java`
   - Build Command: `mvn clean package -DskipTests`
   - Start Command: `java -jar target/*.jar`

3. **Add Environment Variables**:
   ```
   SPRING_DATASOURCE_URL=jdbc:mysql://sql.freedb.tech:3306/freedb_quizsystem
   SPRING_DATASOURCE_USERNAME=freedb_souravuser
   SPRING_DATASOURCE_PASSWORD=YOUR_PASSWORD_HERE
   ```
   
   **OR use Free MySQL at db4free.net**:
   - Register at https://db4free.net
   - Create database `quizsystem`
   - Import your data via phpMyAdmin
   - Use those credentials above

4. **Deploy**:
   - Render builds automatically
   - Copy the URL: `https://quiz-backend-xxxx.onrender.com`

5. **Update frontend** (I'll do this for you):
   - Just tell me the Render URL and I'll update `backend-origin.js` and redeploy Hosting

## Even Simpler: Use PlanetScale (Free MySQL + No Server Needed)

If you migrate the DB to PlanetScale (free, cloud MySQL):
1. Export: `mysqldump -u root -p626629 quiz_system > backup.sql`
2. Import to PlanetScale web console
3. Deploy backend to Render with PlanetScale connection string
4. Done - fully managed, no local dependencies

**Want me to walk you through one of these?** I can't deploy to Railway/Render from here without your account, but I can:
- Guide you step-by-step
- Prepare all config files (done above)
- Update and redeploy the frontend once you share the backend URL

The actual deployment takes ~5 minutes on Render's free tier.
