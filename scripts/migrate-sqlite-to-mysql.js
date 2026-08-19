const path = require('node:path');
const mysql = require('mysql2/promise');
const { openDatabase } = require('../server/database');
const { readConfig } = require('../server/mysql-database');
const { statements } = require('../server/mysql-schema');

try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const tables = [
  'users', 'categories', 'products', 'wishlists', 'cart_items', 'orders',
  'order_items', 'payments', 'shipments', 'reviews', 'refund_requests',
  'articles', 'audit_logs', 'order_status_history', 'shipment_attempts',
];

const primaryKeys = {
  users: 'user_id', categories: 'category_id', products: 'product_id',
  orders: 'order_id', order_items: 'order_item_id', payments: 'payment_id',
  shipments: 'shipment_id', reviews: 'review_id', refund_requests: 'refund_id',
  articles: 'article_id', audit_logs: 'audit_id',
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
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [...tables].reverse()) {
      await connection.query(`DELETE FROM \`${table}\``);
    }

    for (const table of tables) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
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

