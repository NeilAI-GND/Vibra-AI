# Deployment Guide for Vibra AI

## Overview
This guide covers deploying your Vibra AI application. The project has been configured for easy deployment to Vercel (frontend) and other platforms for the backend.

## Fixed Issues
✅ **Vercel Build Error Fixed**: Updated package.json and build configuration
✅ **Node.js Version**: Set to 22.x (Vercel's current default)
✅ **Module Type**: Added ES module support to eliminate warnings
✅ **Build Process**: Optimized for production deployment

## Deployment Options

### Option 1: Vercel (Frontend) + Render/Railway (Backend) - Recommended

#### Step 1: Deploy Frontend to Vercel

1. **Push your code to GitHub** (if not already done)
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the configuration

3. **Environment Variables** (Set in Vercel Dashboard):
   ```
   VITE_API_URL=https://your-backend-url.com/api
   VITE_APP_NAME=Vibra AI
   VITE_APP_VERSION=1.0.0
   VITE_MAX_FILE_SIZE=10485760
   VITE_ENABLE_ANALYTICS=false
   VITE_ENABLE_DEBUG=false
   ```

4. **Deploy**: Vercel will automatically build and deploy

#### Step 2: Deploy Backend to Render

1. **Create a new Web Service** on [render.com](https://render.com)
2. **Connect your GitHub repository**
3. **Configure the service**:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node.js

4. **Environment Variables** (Set in Render Dashboard):
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   SESSION_SECRET=your_session_secret
   ```

5. **Update Frontend Environment**:
   - Go back to Vercel
   - Update `VITE_API_URL` to your Render backend URL
   - Redeploy frontend

### Option 2: Vercel Full-Stack (Simpler)

1. **Deploy to Vercel** as above
2. **Add Vercel Functions** for backend:
   - Create `api/` folder in root
   - Move backend routes to serverless functions
   - Update database connections for serverless

### Option 3: Railway (Full-Stack)

1. **Connect to Railway**: [railway.app](https://railway.app)
2. **Deploy**: Railway will auto-detect and deploy both frontend and backend
3. **Set Environment Variables** in Railway dashboard

## Environment Variables Reference

### Frontend (.env.production)
```env
VITE_API_URL=https://your-backend-url.com/api
VITE_APP_NAME=Vibra AI
VITE_APP_VERSION=1.0.0
VITE_MAX_FILE_SIZE=10485760
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false
```

### Backend (.env)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vibra-ai
JWT_SECRET=your-super-secret-jwt-key-here
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
SESSION_SECRET=your-session-secret-key
```

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] MongoDB database accessible from deployment platform
- [ ] API keys are valid and have proper permissions
- [ ] CORS settings updated for production domains
- [ ] Build process tested locally (`npm run build`)
- [ ] Frontend API URL points to production backend

## Troubleshooting

### Common Issues:

1. **Build Fails on Vercel**:
   - Check Node.js version (should be 22.x)
   - Ensure all dependencies are in package.json
   - Check build logs for specific errors

2. **API Calls Fail**:
   - Verify VITE_API_URL is correct
   - Check CORS settings in backend
   - Ensure backend is running and accessible

3. **Environment Variables Not Working**:
   - Prefix frontend vars with `VITE_`
   - Restart deployment after adding variables
   - Check variable names for typos

4. **Database Connection Issues**:
   - Whitelist deployment platform IPs in MongoDB
   - Use connection string format for your database provider
   - Check network access settings

## File Structure for Deployment

```
Vibra AI/
├── package.json          # Root package.json (fixed)
├── vercel.json           # Vercel configuration
├── DEPLOYMENT.md         # This guide
├── frontend/
│   ├── dist/            # Built files (auto-generated)
│   ├── .env.production  # Production environment
│   ├── package.json     # Frontend dependencies
│   └── vite.config.js   # Build configuration
└── backend/
    ├── package.json     # Backend dependencies
    ├── server.js        # Entry point
    └── ...
```

## Next Steps

1. **Choose your deployment option** (Vercel + Render recommended for beginners)
2. **Set up your databases** (MongoDB Atlas for production)
3. **Configure environment variables** on your chosen platforms
4. **Deploy and test** your application
5. **Set up monitoring** and error tracking (optional)

## Support

If you encounter issues:
1. Check the deployment platform's logs
2. Verify all environment variables are set correctly
3. Test the build process locally first
4. Check CORS and network settings

Your application is now ready for deployment! 🚀