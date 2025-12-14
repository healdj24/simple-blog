const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Data files
const DATA_FILE = path.join(__dirname, 'posts.json');
const ABOUT_FILE = path.join(__dirname, 'about.json');
const SIDEBAR_FILE = path.join(__dirname, 'sidebar.json');

// Note: Files must exist in the deployment
// Vercel filesystem is read-only, so we don't initialize files here

// Helper functions
function getPosts() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
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

function savePosts(posts) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
}

function getAbout() {
    const data = fs.readFileSync(ABOUT_FILE, 'utf8');
    return JSON.parse(data);
}

function saveAbout(content) {
    fs.writeFileSync(ABOUT_FILE, JSON.stringify({ content }, null, 2));
}

function getSidebar() {
    const data = fs.readFileSync(SIDEBAR_FILE, 'utf8');
    return JSON.parse(data);
}

function saveSidebar(topics) {
    fs.writeFileSync(SIDEBAR_FILE, JSON.stringify({ topics }, null, 2));
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
app.get('/', (req, res) => {
    const allPosts = getPosts();
    const posts = allPosts.filter(p => p.type === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
    const sidebar = getSidebar();
    res.render('index', { posts, sidebarTopics: sidebar.topics, getPreview });
});

// SS page - notes
app.get('/ss', (req, res) => {
    const allPosts = getPosts();
    const notes = allPosts.filter(p => p.type === 'note').sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('ss', { notes, getPreview });
});

// About page
app.get('/about', (req, res) => {
    const about = getAbout();
    res.render('about', { content: about.content });
});

// Individual essay page
app.get('/essay/:id', (req, res) => {
    const allPosts = getPosts();
    const post = allPosts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/');
    }
    res.render('single', { post, getPreview });
});

// Individual note page
app.get('/note/:id', (req, res) => {
    const allPosts = getPosts();
    const post = allPosts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/ss');
    }
    res.render('single', { post, getPreview });
});

// Archive page
app.get('/archive', (req, res) => {
    const allPosts = getPosts();
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
app.get('/admin', requireAuth, (req, res) => {
    const allPosts = getPosts().sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('admin', { posts: allPosts });
});

// Create new post
app.post('/admin/post', requireAuth, (req, res) => {
    const { title, content, type } = req.body;
    const posts = getPosts();
    const newPost = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        type: type || 'post', // 'post' or 'note'
        date: new Date().toISOString()
    };
    posts.push(newPost);
    savePosts(posts);
    res.redirect('/admin');
});

// Get about content for editing
app.get('/admin/about-content', requireAuth, (req, res) => {
    const about = getAbout();
    res.json(about);
});

// Save about content
app.post('/admin/about', requireAuth, (req, res) => {
    const { content } = req.body;
    saveAbout(content.trim());
    res.redirect('/admin');
});

// Get sidebar content for editing
app.get('/admin/sidebar-content', requireAuth, (req, res) => {
    const sidebar = getSidebar();
    res.json(sidebar);
});

// Save sidebar content
app.post('/admin/sidebar', requireAuth, (req, res) => {
    const { topics } = req.body;
    const topicsArray = topics.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    saveSidebar(topicsArray);
    res.redirect('/admin');
});

// Get post for editing
app.get('/admin/edit/:id', requireAuth, (req, res) => {
    const posts = getPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/admin');
    }
    res.json(post);
});

// Update post
app.post('/admin/update/:id', requireAuth, (req, res) => {
    const { title, content } = req.body;
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === req.params.id);
    if (postIndex !== -1) {
        posts[postIndex].title = title.trim();
        posts[postIndex].content = content.trim();
        savePosts(posts);
    }
    res.redirect('/admin');
});

// Delete post
app.post('/admin/delete/:id', requireAuth, (req, res) => {
    const posts = getPosts().filter(p => p.id !== req.params.id);
    savePosts(posts);
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
