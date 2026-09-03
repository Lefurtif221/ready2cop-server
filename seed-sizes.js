const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const existing = await sql`SELECT id FROM products WHERE id = 1`;
  if (existing.length === 0) {
    await sql`INSERT INTO products (id, name, price, category, image, stock, featured) VALUES (1, 'Air Max Revolution', 78500, 'sneakers', 'Chaussures-22.jpeg', 15, 1)`;
    console.log('Inserted Air Max Revolution');
    const sizes = [[38, 2], [39, 3], [40, 4], [41, 5], [42, 4], [43, 3], [44, 2]];
    for (const [sz, st] of sizes) {
      await sql`INSERT INTO product_sizes (product_id, size, stock) VALUES (1, ${sz}, ${st})`;
    }
    console.log('Inserted sizes for Air Max Revolution');
  } else {
    console.log('Air Max Revolution already exists');
    const szCount = await sql`SELECT COUNT(*)::int as c FROM product_sizes WHERE product_id = 1`;
    if (szCount[0].c === 0) {
      const sizes = [[38, 2], [39, 3], [40, 4], [41, 5], [42, 4], [43, 3], [44, 2]];
      for (const [sz, st] of sizes) {
        await sql`INSERT INTO product_sizes (product_id, size, stock) VALUES (1, ${sz}, ${st})`;
      }
      console.log('Inserted sizes for existing product');
    }
  }

  const all = await sql`SELECT p.id, p.name, COUNT(ps.id)::int as size_count FROM products p LEFT JOIN product_sizes ps ON ps.product_id = p.id GROUP BY p.id ORDER BY p.id`;
  console.log(JSON.stringify(all, null, 2));
})();
