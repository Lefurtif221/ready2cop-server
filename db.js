const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'sneakers',
      image TEXT DEFAULT 'Chaussures-22.jpeg',
      description TEXT DEFAULT '',
      stock INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT DEFAULT '',
      items JSONB NOT NULL DEFAULT '[]',
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const existing = await sql`SELECT id FROM users WHERE username = 'admin'`;
  if (existing.length === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('ready2cop2024', 10);
    await sql`INSERT INTO users (username, password, role) VALUES ('admin', ${hash}, 'admin')`;
    console.log('Admin user created: admin / ready2cop2024');
  }

  const productCount = await sql`SELECT COUNT(*)::int as count FROM products`;
  if (productCount[0].count === 0) {
    await sql`
      INSERT INTO products (name, price, category, image, stock, featured) VALUES
        ('Air Max Revolution', 78500, 'sneakers', 'Chaussures-22.jpeg', 15, 1),
        ('Classic Comfort', 54500, 'casual', 'Chaussures-22.jpeg', 20, 1),
        ('Ultra Sport Pro', 96800, 'sport', 'Chaussures-22.jpeg', 10, 1),
        ('Street Style Elite', 72600, 'sneakers', 'Chaussures-22.jpeg', 12, 1)
    `;
    console.log('Default products inserted');
  }
}

module.exports = { sql, initDB };
