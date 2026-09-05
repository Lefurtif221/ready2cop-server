const express = require('express');
const { sql } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Public: create order (from checkout)
router.post('/', async (req, res) => {
  const { customer_name, customer_phone, customer_address, customer_note, items, total } = req.body;
  if (!customer_name || !customer_phone || !items || !items.length) {
    return res.status(400).json({ error: 'Nom, telephone et articles requis' });
  }
  try {
    const result = await sql`
      INSERT INTO orders (customer_name, customer_phone, customer_address, items, total, note, status)
      VALUES (${customer_name}, ${customer_phone}, ${customer_address || ''}, ${JSON.stringify(items)}, ${total || 0}, ${customer_note || ''}, 'pending')
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: get all orders
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    let orders;
    if (status) {
      orders = await sql`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC`;
    } else {
      orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    }
    const parsed = orders.map(o => ({ ...o, items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const orders = await sql`SELECT * FROM orders WHERE id = ${parseInt(req.params.id)}`;
    if (orders.length === 0) return res.status(404).json({ error: 'Commande non trouvee' });
    const order = orders[0];
    order.items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: update order status
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, note } = req.body;
    const existing = await sql`SELECT * FROM orders WHERE id = ${parseInt(req.params.id)}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Commande non trouvee' });

    const oldStatus = existing[0].status;
    const newStatus = status || oldStatus;
    const items = typeof existing[0].items === 'string' ? JSON.parse(existing[0].items) : existing[0].items;

    // Si on passe a "delivered" : decrementer le stock
    if (newStatus === 'delivered' && oldStatus !== 'delivered') {
      for (const item of items) {
        if (item.size && item.id) {
          await sql`UPDATE product_sizes SET stock = GREATEST(0, stock - ${item.quantity || 1}) WHERE product_id = ${item.id} AND size = ${item.size}`;
        }
      }
    }

    // Si on quitte "delivered" (ex: annulation) : restaurer le stock
    if (oldStatus === 'delivered' && newStatus !== 'delivered') {
      for (const item of items) {
        if (item.size && item.id) {
          await sql`UPDATE product_sizes SET stock = stock + ${item.quantity || 1} WHERE product_id = ${item.id} AND size = ${item.size}`;
        }
      }
    }

    const result = await sql`
      UPDATE orders SET
        status = ${newStatus},
        note = ${note !== undefined ? note : existing[0].note}
      WHERE id = ${parseInt(req.params.id)}
      RETURNING *
    `;
    const order = result[0];
    order.items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: delete order
router.delete('/:id', auth, async (req, res) => {
  try {
    await sql`DELETE FROM orders WHERE id = ${parseInt(req.params.id)}`;
    res.json({ message: 'Commande supprimee' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: stats
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalOrders = await sql`SELECT COUNT(*)::int as count FROM orders`;
    const totalRevenue = await sql`SELECT COALESCE(SUM(total), 0)::int as sum FROM orders WHERE status != 'cancelled'`;
    const pendingOrders = await sql`SELECT COUNT(*)::int as count FROM orders WHERE status = 'pending'`;
    const totalProducts = await sql`SELECT COUNT(*)::int as count FROM products`;
    const recentOrders = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 5`;

    // Top products from order items
    const allOrders = await sql`SELECT items FROM orders WHERE status != 'cancelled'`;
    const productCount = {};
    allOrders.forEach(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      items.forEach(item => {
        const name = item.name || `Produit #${item.id}`;
        productCount[name] = (productCount[name] || 0) + (item.quantity || item.qty || 1);
      });
    });
    const topProducts = Object.entries(productCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Orders by status
    const statusCounts = await sql`SELECT status, COUNT(*)::int as count FROM orders GROUP BY status`;
    const ordersByStatus = {};
    statusCounts.forEach(s => { ordersByStatus[s.status] = s.count; });

    res.json({
      totalOrders: totalOrders[0].count,
      totalRevenue: totalRevenue[0].sum,
      pendingOrders: pendingOrders[0].count,
      totalProducts: totalProducts[0].count,
      recentOrders: recentOrders.map(o => ({ ...o, items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items })),
      topProducts,
      ordersByStatus,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
