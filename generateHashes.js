const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

// Connect to Supabase using DATABASE_URL or fallback to local
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const users = [
  { username: 'superadmin', password: 'Irakoze@2025', role: 'superadmin' },
  { username: 'admin', password: 'AdObby@2025', role: 'admin' }
];

(async () => {
  try {
    // 1. Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table "users" ensured.');

    // 2. Insert users
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [user.username, hashedPassword, user.role]
      );
      console.log(`✅ Inserted/skipped: ${user.username}`);
    }

    console.log('✅ All users seeded.');
  } catch (err) {
    console.error('❌ Error seeding users:', err.message);
  } finally {
    await pool.end();
  }
})();
