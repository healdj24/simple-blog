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
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
app.use(bodyParser.json({ limit: '100mb' }));
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

async function getShelfItems() {
    const result = await db.execute('SELECT * FROM shelf_items ORDER BY year DESC, created_at DESC');
    return result.rows;
}

// Extract first line as preview/subheading
function getPreview(content) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return '';

    // Get only the first line for uniform preview length
    return lines[0].trim();
}

// Format content with quote blocks (lines starting with |)
function formatContent(content) {
    const lines = content.split('\n');
    let formatted = '';
    let inQuote = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('|')) {
            // Quote line
            if (!inQuote) {
                formatted += '<blockquote class="quote-block">';
                inQuote = true;
            }
            formatted += line.trim().substring(1).trim() + '\n';
        } else {
            // Regular line
            if (inQuote) {
                formatted += '</blockquote>';
                inQuote = false;
            }
            formatted += line + '\n';
        }
    }

    // Close any open quote
    if (inQuote) {
        formatted += '</blockquote>';
    }

    return formatted;
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
// Main landing page - just kokedera image
app.get('/', (req, res) => {
    res.render('landing');
});

// Writing page - combines essays and notes
app.get('/writing', async (req, res) => {
    const allPosts = await getPosts();
    const notes = allPosts.filter(p => p.type === 'note').sort((a, b) => new Date(b.date) - new Date(a.date));
    const posts = allPosts.filter(p => p.type === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('writing', {
        notes,
        posts,
        getPreview,
        isAdmin: req.session.isAdmin || false
    });
});

// Redirect old routes to new writing page
app.get('/essays', (req, res) => {
    res.redirect('/writing');
});

app.get('/ss', (req, res) => {
    res.redirect('/writing');
});

// Misc page
app.get('/misc', (req, res) => {
    res.render('misc', { isAdmin: req.session.isAdmin || false });
});

// About page
app.get('/about', async (req, res) => {
    const about = await getAbout();
    res.render('about', { content: about.content, isAdmin: req.session.isAdmin || false });
});

// Shelf page
app.get('/shelf', async (req, res) => {
    try {
        const allItems = await getShelfItems();
        const books = allItems.filter(item => item.type === 'book');
        const movies = allItems.filter(item => item.type === 'movie');
        const essays = allItems.filter(item => item.type === 'essay');
        const about = await getAbout();
        res.render('shelf', { books, movies, essays, aboutContent: about.content || '', isAdmin: req.session.isAdmin || false });
    } catch (error) {
        console.error('Error loading shelf:', error);
        res.status(500).send('Internal Server Error: ' + error.message);
    }
});

// Individual essay page
app.get('/essay/:id', async (req, res) => {
    const allPosts = await getPosts();
    const post = allPosts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/');
    }
    res.render('single', { post, getPreview, formatContent, isAdmin: req.session.isAdmin || false });
});

// Individual note page
app.get('/note/:id', async (req, res) => {
    const allPosts = await getPosts();
    const post = allPosts.find(p => p.id === req.params.id);
    if (!post) {
        return res.redirect('/ss');
    }
    res.render('single', { post, getPreview, formatContent, isAdmin: req.session.isAdmin || false });
});

// Archive page
app.get('/archive', async (req, res) => {
    const allPosts = await getPosts();
    const posts = allPosts.filter(p => p.type === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
    res.render('archive', { posts, isAdmin: req.session.isAdmin || false });
});

// Admin login page
app.get('/admin/login', (req, res) => {
    if (req.session.isAdmin) {
        res.redirect('/writing');
    } else {
        res.render('login', { error: null });
    }
});

// Admin login handler (for traditional form)
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/writing');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

// API endpoint for modal login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Invalid credentials' });
    }
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

    // Redirect to writing page
    res.redirect('/writing');
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
    // Redirect back to the referrer (either /about or /shelf)
    const referrer = req.get('Referer') || '/about';
    if (referrer.includes('/shelf')) {
        res.redirect('/shelf');
    } else {
        res.redirect('/about');
    }
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
    res.redirect('/writing');
});

// Get post for editing
app.get('/admin/edit/:id', requireAuth, async (req, res) => {
    const result = await db.execute({
        sql: 'SELECT * FROM posts WHERE id = ?',
        args: [req.params.id]
    });
    const post = result.rows[0];
    if (!post) {
        return res.redirect('/writing');
    }
    res.json(post);
});

// Update post
app.post('/admin/update/:id', requireAuth, async (req, res) => {
    const { title, content, type } = req.body;
    await db.execute({
        sql: 'UPDATE posts SET title = ?, content = ? WHERE id = ?',
        args: [title.trim(), content.trim(), req.params.id]
    });

    // Redirect to writing page
    res.redirect('/writing');
});

// Delete post
app.post('/admin/delete/:id', requireAuth, async (req, res) => {
    await db.execute({
        sql: 'DELETE FROM posts WHERE id = ?',
        args: [req.params.id]
    });

    // Redirect to writing page
    res.redirect('/writing');
});

// Add shelf item
app.post('/admin/shelf/add', requireAuth, async (req, res) => {
    const { type, title, author, source, url, cover_url, year, badge, review } = req.body;
    const newItem = {
        id: Date.now().toString(),
        type: type.trim(),
        title: title.trim(),
        author: author ? author.trim() : null,
        source: source ? source.trim() : null,
        url: url ? url.trim() : null,
        cover_url: cover_url ? cover_url.trim() : null,
        year: year ? parseInt(year) : null,
        badge: badge ? badge.trim() : null,
        review: review ? review.trim() : null,
        created_at: new Date().toISOString()
    };
    await db.execute({
        sql: 'INSERT INTO shelf_items (id, type, title, author, source, url, cover_url, year, badge, review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [newItem.id, newItem.type, newItem.title, newItem.author, newItem.source, newItem.url, newItem.cover_url, newItem.year, newItem.badge, newItem.review, newItem.created_at]
    });
    res.redirect('/shelf');
});

// Update shelf item
app.post('/admin/shelf/update/:id', requireAuth, async (req, res) => {
    const { type, title, author, source, url, cover_url, year, badge, review } = req.body;
    await db.execute({
        sql: 'UPDATE shelf_items SET type = ?, title = ?, author = ?, source = ?, url = ?, cover_url = ?, year = ?, badge = ?, review = ? WHERE id = ?',
        args: [
            type.trim(),
            title.trim(),
            author ? author.trim() : null,
            source ? source.trim() : null,
            url ? url.trim() : null,
            cover_url ? cover_url.trim() : null,
            year ? parseInt(year) : null,
            badge ? badge.trim() : null,
            review ? review.trim() : null,
            req.params.id
        ]
    });
    res.redirect('/shelf');
});

// Delete shelf item
app.post('/admin/shelf/delete/:id', requireAuth, async (req, res) => {
    await db.execute({
        sql: 'DELETE FROM shelf_items WHERE id = ?',
        args: [req.params.id]
    });
    res.redirect('/shelf');
});

// Update favorites
app.post('/admin/shelf/favorites', requireAuth, async (req, res) => {
    const { type, favorites } = req.body;

    // First, clear all ❤ badges for this type
    await db.execute({
        sql: 'UPDATE shelf_items SET badge = NULL WHERE type = ? AND badge = ?',
        args: [type, '❤']
    });

    // Then set ❤ badge for selected items
    if (favorites) {
        const favoriteIds = Array.isArray(favorites) ? favorites : [favorites];
        for (const id of favoriteIds) {
            await db.execute({
                sql: 'UPDATE shelf_items SET badge = ? WHERE id = ?',
                args: ['❤', id]
            });
        }
    }

    res.redirect('/shelf');
});

// Update must-reads
app.post('/admin/shelf/must-reads', requireAuth, async (req, res) => {
    const { type, must_reads } = req.body;

    // First, clear all ★ badges for this type
    await db.execute({
        sql: 'UPDATE shelf_items SET badge = NULL WHERE type = ? AND badge = ?',
        args: [type, '★']
    });

    // Then set ★ badge for selected items
    if (must_reads) {
        const mustReadIds = Array.isArray(must_reads) ? must_reads : [must_reads];
        for (const id of mustReadIds) {
            await db.execute({
                sql: 'UPDATE shelf_items SET badge = ? WHERE id = ?',
                args: ['★', id]
            });
        }
    }

    res.redirect('/shelf');
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
