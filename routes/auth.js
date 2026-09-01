const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../db');
const { auth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username et password requis' });
  }
  try {
    const users = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = users[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const users = await sql`SELECT id, username, role FROM users WHERE id = ${req.user.id}`;
    if (users.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });
    res.json(users[0]);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
