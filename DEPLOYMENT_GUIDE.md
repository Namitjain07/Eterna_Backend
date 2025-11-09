# 🚀 Quick Deployment Guide

**Goal:** Deploy ETERNA Backend to free hosting in 30 minutes

---

## 🎯 Choose Your Platform

### Option 1: Railway (Recommended - Fastest)
✅ Easiest setup  
✅ Free PostgreSQL + Redis included  
✅ Automatic HTTPS  
⏱️ Time: 15 minutes

### Option 2: Render
✅ Most reliable free tier  
✅ Good documentation  
⏱️ Time: 25 minutes

---

## 🚂 **Railway Deployment (RECOMMENDED)**

### Step 1: Install Railway CLI
```powershell
npm install -g @railway/cli
```

### Step 2: Login to Railway
```powershell
railway login
```
- Browser will open
- Sign in with GitHub
- Authorize Railway

### Step 3: Initialize Project
```powershell
cd C:\Users\jnami\Downloads\ETERNA\Eterna_Backend
railway init
```
- Press Enter to create new project
- Name it: "eterna-backend"

### Step 4: Add PostgreSQL
```powershell
railway add --database postgres
```
- Railway automatically provisions PostgreSQL
- Environment variables are auto-configured

### Step 5: Add Redis
```powershell
railway add --database redis
```
- Railway automatically provisions Redis
- Environment variables are auto-configured

### Step 6: Create Application Service
```powershell
railway add --service
```
- This creates your web application service
- Railway will auto-detect your Node.js project

### Step 7: Link to Application Service
```powershell
railway service
```
- Select your application service (not Postgres or Redis)
- Use arrow keys to select, then press Enter

### Step 8: Deploy
```powershell
railway up
```
- Railway builds and deploys your app
- Wait 2-3 minutes for build to complete

### Step 9: Get Public URL
```powershell
railway domain
```
- Generates public URL like: `eterna-backend-production.up.railway.app`
- Copy this URL

### Step 10: Update README
1. Open `README.md`
2. Find line 348: `**Live URL**: [TO BE ADDED]`
3. Replace with: `**Live URL**: https://your-railway-url.up.railway.app`
4. Save and commit:
```powershell
git add README.md
git commit -m "Add deployment URL"
git push
```

### Step 11: Test Deployment
```powershell
# Test health endpoint
curl https://your-railway-url.up.railway.app/health

# Or open in browser
start https://your-railway-url.up.railway.app/health
```

✅ **Done! Railway deployment complete**

---

## 🎨 **Render Deployment (Alternative)**

### Step 1: Create Account
1. Go to https://render.com
2. Sign up with GitHub
3. Authorize Render

### Step 2: Create PostgreSQL Database
1. Click "New +" → "PostgreSQL"
2. Name: `eterna-db`
3. Select free plan
4. Click "Create Database"
5. Copy "Internal Database URL"

### Step 3: Create Redis Instance
1. Click "New +" → "Redis"
2. Name: `eterna-redis`
3. Select free plan
4. Click "Create Redis"
5. Copy "Internal Redis URL"

### Step 4: Create Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `Eterna_Backend`
3. Configure:
   - **Name**: eterna-backend
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 5: Add Environment Variables
Click "Environment" and add:
```
NODE_ENV=production
PORT=10000
HOST=0.0.0.0
DB_HOST=[from step 2 - internal hostname]
DB_PORT=5432
DB_NAME=eterna_db
DB_USER=[from step 2]
DB_PASSWORD=[from step 2]
REDIS_HOST=[from step 3 - internal hostname]
REDIS_PORT=6379
```

### Step 6: Deploy
1. Click "Create Web Service"
2. Wait 5-10 minutes for build
3. Check "Logs" tab for any errors

### Step 7: Get Public URL
- Your URL will be: `https://eterna-backend.onrender.com`
- Copy this URL

### Step 8: Update README
1. Open `README.md`
2. Find line 348: `**Live URL**: [TO BE ADDED]`
3. Replace with: `**Live URL**: https://eterna-backend.onrender.com`
4. Save and commit

✅ **Done! Render deployment complete**

---

## 🎥 **Record Demo Video**

### Prerequisites
- Server running (locally or deployed)
- Postman installed
- Screen recording software (pick one):
  - **OBS Studio** (free, professional)
  - **Loom** (free, easy)
  - **QuickTime** (Mac only)
  - **Xbox Game Bar** (Windows, Win+G)

### Step 1: Prepare Environment
```powershell
# If testing locally
npm run dev

# If testing deployed
# Just have your deployed URL ready
```

### Step 2: Set Up Postman
1. Open Postman
2. Import collection: `postman_collection.json`
3. Set variable `base_url` to:
   - Local: `http://localhost:3000`
   - Deployed: `https://your-deployed-url`

### Step 3: Start Recording
**Windows (Xbox Game Bar):**
- Press `Win + G`
- Click record button
- Select browser/terminal window

**OBS Studio:**
- Add "Display Capture" source
- Click "Start Recording"

**Loom:**
- Install Loom extension
- Click Loom icon → "Screen + Webcam"
- Click "Start Recording"

### Step 4: Record Demo (1-2 minutes)

**Script:**
```
[0:00-0:10] Introduction
"This is the ETERNA Order Execution Engine. I'll demonstrate 
concurrent order processing with DEX routing."

[0:10-0:30] Show Console
- Show terminal with server running
- Point out: "Server listening on port 3000"

[0:30-1:00] Submit Orders
- Open Postman Collection Runner
- Select all 5 requests
- Click "Run Collection"
- Show: "Submitting 5 orders simultaneously"

[1:00-1:30] Show Results
- Show console logs with DEX routing decisions
  "Raydium selected - better price by 0.12 USDC"
- Show WebSocket responses in Postman
  "Status updates: pending → routing → building → submitted → confirmed"
- Show queue metrics endpoint
  "10 concurrent workers processing orders"

[1:30-2:00] Conclusion
"All orders executed successfully. DEX router compared Raydium 
and Meteora prices for each order, selecting the best execution 
venue. Queue handled concurrent processing with automatic retries."
```

### Step 5: Stop Recording
- Stop screen recording
- Save video file

### Step 6: Upload to YouTube
1. Go to https://studio.youtube.com
2. Click "Create" → "Upload videos"
3. Select your video
4. **Title**: "ETERNA Order Execution Engine - DEX Router Demo"
5. **Description**:
   ```
   Demo of ETERNA Order Execution Engine
   
   Features:
   - Concurrent order processing (10 workers)
   - DEX routing (Raydium vs Meteora)
   - WebSocket real-time updates
   - BullMQ queue management
   
   GitHub: https://github.com/Namitjain07/Eterna_Backend
   ```
6. **Visibility**: **Unlisted** (important!)
7. Click "Publish"
8. Copy video URL

### Step 7: Update README
1. Open `README.md`
2. Find line 344: `**Video Link**: [TO BE ADDED]`
3. Replace with: `**Video Link**: https://youtu.be/YOUR_VIDEO_ID`
4. Save and commit

✅ **Done! Video uploaded**

---

## ✅ **Final Checklist**

Before submitting:

- [ ] Deployment URL in README (line 348)
- [ ] Demo video URL in README (line 344)
- [ ] All changes committed to GitHub
- [ ] Deployed server health check working
- [ ] Video is public/unlisted on YouTube
- [ ] Postman collection tested on deployed URL

---

## 🐛 **Troubleshooting**

### Railway: Build Failed
```powershell
# Check logs
railway logs

# Common fix: ensure package.json has build script
npm run build  # should work locally first
```

### Render: Database Connection Failed
- Verify environment variables are correct
- Use INTERNAL database URL, not external
- Check database is in same region as web service

### Video: File Too Large
- Compress video using HandBrake
- Or trim to exactly 2 minutes
- Or reduce resolution to 720p

### Postman: WebSocket Not Working
- WebSocket connections may not work through Postman when testing deployed servers
- Use browser WebSocket test tool instead
- Or mention this limitation in video

---

## 🎉 **Congratulations!**

Once you've completed:
1. ✅ Deployment (URL in README)
2. ✅ Video (URL in README)

Your assignment is **100% COMPLETE** and ready to submit! 🚀

**Total Time:** ~45 minutes
- Railway deployment: 15 min
- Video recording: 15 min
- README updates: 5 min
- Testing: 10 min
