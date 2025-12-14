const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database (Turso for production)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:blog.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.set('view engine', 'ejs');

// Simple admin credentials (change these!)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'jed';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'flipflop';

// Helper functions
async function getPosts() {
    const result = await db.execute('SELECT * FROM posts');
    return result.rows;
}

// Extract first 1-2 lines as preview/subheading
function getPreview(content) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return '';

    // Get first line, or first two if first is very short
    const firstLine = lines[0].trim();
    if (firstLine.length < 50 && lines.length > 1) {
        return firstLine + ' ' + lines[1].trim();
    }
    return firstLine;
}

async function getAbout() {
    const result = await db.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: ['about']
    });
    const row = result.rows[0];
    return { content: row ? row.value : '' };
}

async function saveAbout(content) {
    await db.execute({
        sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        args: ['about', content]
    });
}

async function getSidebar() {
    const result = await db.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: ['sidebar']
    });
    const row = result.rows[0];
    return { topics: row ? JSON.parse(row.value) : [] };
}

async function saveSidebar(topics) {
    await db.execute({
        sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        args: ['sidebar', JSON.stringify(topics)]
    });
}

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}

// Routes
// Main blog page - posts
app.get('/', async (req, res) => {
    const allPosts = await getPosts();
    const posts = allPosts.filter(p => p.type === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
    const sidebar = await getSidebar();
    res.render('index', { posts, sidebarTopics: sidebar.topics, getPreview });
});

// SS page - notes
app.get('/ss', async (req, res) => {
    const allPosts = await getPosts();
    const notes = allPosts.filter(p => p.type === 'note').sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('ss', { notes, getPreview });
});

// About page
app.get('/about', async (req, res) => {
    const about = await getAbout();
    res.render('about', { content: about.content });
});

// Individual essay page
app.get('/essay/:id', async (req, res) => {
    const allPosts = await getPosts();
    const post = allPosts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/');
    }
    res.render('single', { post, getPreview });
});

// Individual note page
app.get('/note/:id', async (req, res) => {
    const allPosts = await getPosts();
    const post = allPosts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/ss');
    }
    res.render('single', { post, getPreview });
});

// Archive page
app.get('/archive', async (req, res) => {
    const allPosts = await getPosts();
    const posts = allPosts.filter(p => p.type === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('archive', { posts });
});

// Admin login page
app.get('/admin/login', (req, res) => {
    if (req.session.isAdmin) {
        res.redirect('/admin');
    } else {
        res.render('login', { error: null });
    }
});

// Admin login handler
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

// Admin dashboard
app.get('/admin', requireAuth, async (req, res) => {
    const allPosts = await getPosts();
    const sortedPosts = allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('admin', { posts: sortedPosts });
});

// Create new post
app.post('/admin/post', requireAuth, async (req, res) => {
    const { title, content, type } = req.body;
    const newPost = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        type: type || 'post',
        date: new Date().toISOString()
    };
    await db.execute({
        sql: 'INSERT INTO posts (id, title, content, type, date) VALUES (?, ?, ?, ?, ?)',
        args: [newPost.id, newPost.title, newPost.content, newPost.type, newPost.date]
    });
    res.redirect('/admin');
});

// Get about content for editing
app.get('/admin/about-content', requireAuth, async (req, res) => {
    const about = await getAbout();
    res.json(about);
});

// Save about content
app.post('/admin/about', requireAuth, async (req, res) => {
    const { content } = req.body;
    await saveAbout(content.trim());
    res.redirect('/admin');
});

// Get sidebar content for editing
app.get('/admin/sidebar-content', requireAuth, async (req, res) => {
    const sidebar = await getSidebar();
    res.json(sidebar);
});

// Save sidebar content
app.post('/admin/sidebar', requireAuth, async (req, res) => {
    const { topics } = req.body;
    const topicsArray = topics.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    await saveSidebar(topicsArray);
    res.redirect('/admin');
});

// Get post for editing
app.get('/admin/edit/:id', requireAuth, async (req, res) => {
    const result = await db.execute({
        sql: 'SELECT * FROM posts WHERE id = ?',
        args: [req.params.id]
    });
    const post = result.rows[0];
    if (!post) {
        return res.redirect('/admin');
    }
    res.json(post);
});

// Update post
app.post('/admin/update/:id', requireAuth, async (req, res) => {
    const { title, content } = req.body;
    await db.execute({
        sql: 'UPDATE posts SET title = ?, content = ? WHERE id = ?',
        args: [title.trim(), content.trim(), req.params.id]
    });
    res.redirect('/admin');
});

// Delete post
app.post('/admin/delete/:id', requireAuth, async (req, res) => {
    await db.execute({
        sql: 'DELETE FROM posts WHERE id = ?',
        args: [req.params.id]
    });
    res.redirect('/admin');
});

// Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Blog running at http://localhost:${PORT}`);
    console.log(`Admin login at http://localhost:${PORT}/admin/login`);
    console.log(`Default credentials - Username: ${ADMIN_USERNAME}, Password: ${ADMIN_PASSWORD}`);
});
