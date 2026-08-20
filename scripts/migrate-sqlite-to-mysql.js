const path = require('node:path');
const mysql = require('mysql2/promise');
const { openDatabase } = require('../server/database');
const { readConfig } = require('../server/mysql-database');
const { columnMigrations, migrationStatements, statements } = require('../server/mysql-schema');

try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const tables = [
  'users', 'categories', 'products', 'wishlists', 'cart_items', 'orders',
  'order_items', 'payments', 'shipments', 'reviews', 'refund_requests',
  'articles', 'media_assets', 'article_product_links', 'audit_logs',
  'order_status_history', 'shipment_attempts',
];

const primaryKeys = {
  users: 'user_id', categories: 'category_id', products: 'product_id',
  orders: 'order_id', order_items: 'order_item_id', payments: 'payment_id',
  shipments: 'shipment_id', reviews: 'review_id', refund_requests: 'refund_id',
  articles: 'article_id', audit_logs: 'audit_id',
  media_assets: 'media_id',
  order_status_history: 'history_id', shipment_attempts: 'attempt_id',
};

async function migrate() {
  const sqlitePath = path.resolve(
    __dirname, '..', process.env.DATABASE_PATH || 'server/data/flowery.db',
  );
  const sqlite = openDatabase(sqlitePath, { client: 'sqlite' });
  const config = readConfig();
  const connection = await mysql.createConnection({
    ...config,
    ssl: config.ssl ? {} : undefined,
    charset: 'utf8mb4',
    timezone: '+07:00',
    dateStrings: true,
  });

  try {
    for (const statement of statements) await connection.query(statement);
    for (const [table, column, definition] of columnMigrations) {
      const [[exists]] = await connection.query(`
        SELECT 1 AS present FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1
      `, [table, column]);
      if (!exists) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
    const [[reviewIndex]] = await connection.query(`
      SELECT 1 AS present FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'
        AND INDEX_NAME = 'uq_reviews_order_item' LIMIT 1
    `);
    if (!reviewIndex) {
      await connection.query('CREATE UNIQUE INDEX uq_reviews_order_item ON reviews(order_item_id)');
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [...tables].reverse()) {
      await connection.query(`DELETE FROM \`${table}\``);
    }

    for (const table of tables) {
      let rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (table === 'reviews') {
        rows = rows.map((row) => {
          if (row.order_item_id) return row;
          const orderItem = sqlite.prepare(`
            SELECT oi.order_item_id FROM order_items oi
            JOIN orders o ON o.order_id = oi.order_id
            WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'Delivered'
            ORDER BY o.created_at DESC, oi.order_item_id DESC LIMIT 1
          `).get(row.user_id, row.product_id);
          if (!orderItem) {
            throw new Error(`Không tìm được OrderItem cho review ${row.review_id}.`);
          }
          return { ...row, order_item_id: orderItem.order_item_id };
        });
      }
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const identifiers = columns.map((column) => `\`${column}\``).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO \`${table}\` (${identifiers}) VALUES (${placeholders})`;
        for (const row of rows) {
          await connection.query(sql, columns.map((column) => row[column]));
        }
      }
      console.log(`${table}: ${rows.length} bản ghi`);
    }

    for (const [table, primaryKey] of Object.entries(primaryKeys)) {
      const [[row]] = await connection.query(
        `SELECT COALESCE(MAX(\`${primaryKey}\`), 0) + 1 AS next_id FROM \`${table}\``,
      );
      await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${Number(row.next_id)}`);
    }
    for (const statement of migrationStatements) await connection.query(statement);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`Đã chuyển dữ liệu ${sqlitePath} sang MySQL ${config.database}@${config.host}:${config.port}.`);
  } finally {
    sqlite.close();
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error('Di chuyển dữ liệu thất bại:', error);
  process.exitCode = 1;
});
