# Deploy Your Blog

Your blog is ready to deploy! Here are the easiest options:

## Option 1: Railway (Recommended - Easiest)

1. **Sign up at Railway**
   - Go to https://railway.app
   - Sign up with GitHub (free, no credit card needed)

2. **Push your code to GitHub**
   ```bash
   cd ~/simple-blog
   git init
   git add .
   git commit -m "initial commit"
   # Create a new repo on GitHub, then:
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

3. **Deploy on Railway**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your blog repository
   - Railway will automatically detect and deploy it!

4. **Set Environment Variables** (Important!)
   In Railway dashboard, go to Variables and add:
   ```
   ADMIN_USERNAME=yourchosenusername
   ADMIN_PASSWORD=yourchosenpassword
   SESSION_SECRET=somerandomlongstring
   ```

5. **Done!** Railway will give you a URL like `yourapp.up.railway.app`

## Option 2: Render

1. **Sign up at Render**
   - Go to https://render.com
   - Sign up with GitHub (free tier available)

2. **Push code to GitHub** (same as above)

3. **Deploy on Render**
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Render auto-detects Node.js

4. **Set Environment Variables** in Render dashboard:
   ```
   ADMIN_USERNAME=yourchosenusername
   ADMIN_PASSWORD=yourchosenpassword
   SESSION_SECRET=somerandomlongstring
   ```

5. **Done!** Render gives you a URL like `yourapp.onrender.com`

## Important Notes

- **Change your password!** Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in environment variables
- **Session secret:** Set `SESSION_SECRET` to a random string for security
- Your posts are stored in `posts.json` - this will persist on most platforms
- Both Railway and Render have free tiers that work great for personal blogs

## Custom Domain (Optional)

Once deployed, you can:
1. Buy a domain (like yourname.com) from Namecheap, Google Domains, etc.
2. Point it to your Railway/Render URL in the platform's settings
3. Both platforms support custom domains on free tier!

## Need Help?

- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
