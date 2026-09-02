const express = require('express');
const multer = require('multer');
const path = require('path');
const { sql } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public: get all products (with sizes)
router.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;
    let products;
    if (category && category !== 'all') {
      products = await sql`SELECT * FROM products WHERE category = ${category} ORDER BY created_at DESC`;
    } else if (featured === '1') {
      products = await sql`SELECT * FROM products WHERE featured = 1 ORDER BY created_at DESC`;
    } else {
      products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
    }
    const sizes = await sql`SELECT * FROM product_sizes ORDER BY size`;
    const sizeMap = {};
    sizes.forEach(s => {
      if (!sizeMap[s.product_id]) sizeMap[s.product_id] = [];
      sizeMap[s.product_id].push({ size: s.size, stock: s.stock });
    });
    const result = products.map(p => ({ ...p, sizes: sizeMap[p.id] || [] }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Public: get single product (with sizes)
router.get('/:id', async (req, res) => {
  try {
    const products = await sql`SELECT * FROM products WHERE id = ${parseInt(req.params.id)}`;
    if (products.length === 0) return res.status(404).json({ error: 'Produit non trouve' });
    const sizes = await sql`SELECT * FROM product_sizes WHERE product_id = ${parseInt(req.params.id)} ORDER BY size`;
    res.json({ ...products[0], sizes: sizes.map(s => ({ size: s.size, stock: s.stock })) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: create product
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, stock, featured, sizes } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Nom et prix requis' });
    const image = req.file ? req.file.filename : 'Chaussures-22.jpeg';
    const result = await sql`
      INSERT INTO products (name, price, category, image, description, stock, featured)
      VALUES (${name}, ${parseInt(price)}, ${category || 'sneakers'}, ${image}, ${description || ''}, ${parseInt(stock) || 0}, ${parseInt(featured) || 0})
      RETURNING *
    `;
    const product = result[0];
    if (sizes) {
      const parsed = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      for (const s of parsed) {
        await sql`INSERT INTO product_sizes (product_id, size, stock) VALUES (${product.id}, ${s.size}, ${s.stock || 0})`;
      }
    }
    const allSizes = await sql`SELECT size, stock FROM product_sizes WHERE product_id = ${product.id} ORDER BY size`;
    res.status(201).json({ ...product, sizes: allSizes });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: update product
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const existing = await sql`SELECT * FROM products WHERE id = ${parseInt(req.params.id)}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Produit non trouve' });
    const { name, price, category, description, stock, featured, sizes } = req.body;
    const image = req.file ? req.file.filename : existing[0].image;
    const result = await sql`
      UPDATE products SET
        name = ${name || existing[0].name},
        price = ${parseInt(price) || existing[0].price},
        category = ${category || existing[0].category},
        image = ${image},
        description = ${description !== undefined ? description : existing[0].description},
        stock = ${stock !== undefined ? parseInt(stock) : existing[0].stock},
        featured = ${featured !== undefined ? parseInt(featured) : existing[0].featured}
      WHERE id = ${parseInt(req.params.id)}
      RETURNING *
    `;
    if (sizes) {
      const parsed = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      await sql`DELETE FROM product_sizes WHERE product_id = ${parseInt(req.params.id)}`;
      for (const s of parsed) {
        await sql`INSERT INTO product_sizes (product_id, size, stock) VALUES (${parseInt(req.params.id)}, ${s.size}, ${s.stock || 0})`;
      }
    }
    const allSizes = await sql`SELECT size, stock FROM product_sizes WHERE product_id = ${parseInt(req.params.id)} ORDER BY size`;
    res.json({ ...result[0], sizes: allSizes });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: delete product
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await sql`SELECT * FROM products WHERE id = ${parseInt(req.params.id)}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Produit non trouve' });
    await sql`DELETE FROM products WHERE id = ${parseInt(req.params.id)}`;
    res.json({ message: 'Produit supprime' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
