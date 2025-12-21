const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();

// Production Turso client
const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Local SQLite
const localDb = new sqlite3.Database('./blog.db');

async function syncData() {
  try {
    console.log('Fetching data from Turso production...');

    // Get all data from production
    const shelfItems = await tursoClient.execute('SELECT * FROM shelf_items');
    const settings = await tursoClient.execute('SELECT * FROM settings');
    const posts = await tursoClient.execute('SELECT * FROM posts');

    console.log(`Found ${shelfItems.rows.length} shelf items, ${settings.rows.length} settings, ${posts.rows.length} posts`);

    // Clear local data
    console.log('Clearing local database...');
    localDb.run('DELETE FROM shelf_items');
    localDb.run('DELETE FROM settings');
    localDb.run('DELETE FROM posts');

    // Wait a bit for deletes to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Insert shelf items
    console.log('Importing shelf items...');
    for (const item of shelfItems.rows) {
      await new Promise((resolve, reject) => {
        localDb.run(
          'INSERT INTO shelf_items (id, type, title, author, source, url, cover_url, year, badge, review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.id, item.type, item.title, item.author, item.source, item.url, item.cover_url, item.year, item.badge, item.review, item.created_at],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    // Insert settings
    console.log('Importing settings...');
    for (const setting of settings.rows) {
      await new Promise((resolve, reject) => {
        localDb.run(
          'INSERT INTO settings (key, value) VALUES (?, ?)',
          [setting.key, setting.value],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    // Insert posts
    console.log('Importing posts...');
    for (const post of posts.rows) {
      await new Promise((resolve, reject) => {
        localDb.run(
          'INSERT INTO posts (id, title, content, type, date, status) VALUES (?, ?, ?, ?, ?, ?)',
          [post.id, post.title, post.content, post.type, post.date, post.status || 'published'],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    console.log('✓ Sync complete!');
    localDb.close();
    process.exit(0);
  } catch (error) {
    console.error('Error syncing data:', error);
    process.exit(1);
  }
}

syncData();
