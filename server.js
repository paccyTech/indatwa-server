const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Set allowed frontend origins
const allowedOrigins = [
  'https://indatwa-cient.vercel.app',
  'https://indatwaevents.com',
  'https://www.indatwaevents.com'
];

// ✅ Configure CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ✅ Handle preflight OPTIONS requests
app.options('*', cors());

app.use(express.json());

// ✅ Connect to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(client => {
    console.log('✅ Connected to Supabase PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('❌ Error connecting to PostgreSQL:', err.message);
  });

// ✅ LOGIN route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ CREATE booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      name, email, phone, service, eventType,
      date, time, location, guests, duration, notes
    } = req.body;

    const query = `
      INSERT INTO bookings (
        name, email, phone, service, event_type,
        event_date, event_time, location,
        guests, duration, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `;

    const values = [
      name, email, phone, service, eventType,
      date, time, location, guests, duration, notes
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Booking creation error:', err.message);
    res.status(500).json({ message: 'Booking creation failed. Please try again.' });
  }
});

// ✅ READ all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch bookings error:', err.message);
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
});

// ✅ READ single booking
app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch booking error:', err.message);
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
});

// ✅ UPDATE booking
app.put('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, email, phone, service, eventType,
    date, time, location, guests, duration, notes
  } = req.body;

  try {
    const query = `
      UPDATE bookings SET
        name = $1,
        email = $2,
        phone = $3,
        service = $4,
        event_type = $5,
        event_date = $6,
        event_time = $7,
        location = $8,
        guests = $9,
        duration = $10,
        notes = $11
      WHERE id = $12 RETURNING *
    `;

    const values = [
      name, email, phone, service, eventType,
      date, time, location, guests, duration, notes, id
    ];

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update booking error:', err.message);
    res.status(500).json({ message: 'Failed to update booking.' });
  }
});

// ✅ DELETE booking
app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Delete booking error:', err.message);
    res.status(500).json({ message: 'Failed to delete booking.' });
  }
});

// ✅ GET all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch users error:', err.message);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// ✅ CREATE user
app.post('/api/users', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, username, role, created_at',
      [username, password_hash, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create user error:', err.message);
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

// ✅ UPDATE user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({ message: 'Username and role are required.' });
  }

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const usernameTaken = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
    if (usernameTaken.rows.length > 0) {
      return res.status(409).json({ message: 'Username already taken by another user.' });
    }

    let password_hash = existingUser.rows[0].password_hash;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE users SET username = $1, password_hash = $2, role = $3 WHERE id = $4 RETURNING id, username, role, created_at`,
      [username, password_hash, role, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ message: 'Failed to update user.' });
  }
});

// ✅ DELETE user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


//New changes please