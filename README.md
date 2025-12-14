# Simple Blog

A minimal, early 2000s-inspired personal blog with an easy-to-use admin interface for daily writing.

## Features

- Clean, nostalgic early 2000s web design with serif fonts
- Simple admin login to write and manage posts
- Archive page to browse all posts
- No database required - posts saved to JSON file
- Mobile responsive

## Getting Started

### 1. Start the blog

```bash
cd ~/simple-blog
npm start
```

The blog will be running at `http://localhost:3000`

### 2. Access the admin interface

Go to `http://localhost:3000/admin/login`

**Default credentials:**
- Username: `admin`
- Password: `password123`

### 3. Write your first post!

Once logged in, you'll see a simple form where you can:
- Enter a title
- Write your daily thoughts
- Click "Publish Post" to make it live

Your post will immediately appear on the main blog page.

## Important: Change Your Password

**BEFORE deploying this blog publicly**, you must change the admin credentials!

Edit `server.js` and find these lines (around line 20):

```javascript
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';
```

Change them to your own secure credentials.

## File Structure

```
simple-blog/
├── server.js           # Main server and routes
├── posts.json          # Your blog posts (auto-generated)
├── package.json        # Dependencies
├── views/              # HTML templates
│   ├── index.ejs       # Main blog page
│   ├── admin.ejs       # Admin dashboard
│   ├── login.ejs       # Admin login
│   └── archive.ejs     # Archive page
└── public/
    └── css/
        ├── style.css   # Blog styling
        └── admin.css   # Admin styling
```

## Customization

### Change the blog title

Edit `views/index.ejs` and `views/archive.ejs` - replace "My Daily Thoughts" with your preferred title.

### Adjust colors

Edit `public/css/style.css` to change:
- Header banner colors (`.header` section)
- Background color (`body { background-color: ... }`)
- Link and accent colors

### Change session secret

For security, edit `server.js` line 16 and change the session secret:

```javascript
secret: 'your-secret-key-change-this',
```

Replace with a random string.

## Deployment

To deploy this blog online, you can use services like:
- **Railway** (easiest)
- **Render**
- **Heroku**
- **DigitalOcean**

Make sure to:
1. Change the admin password
2. Change the session secret
3. Set the PORT environment variable if required by your host

## Daily Usage

Just visit `http://localhost:3000/admin/login`, log in, and start writing! Your posts will appear on the homepage in reverse chronological order (newest first).
