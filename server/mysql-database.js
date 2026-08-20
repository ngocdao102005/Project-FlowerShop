const path = require('node:path');
const {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
} = require('node:worker_threads');
const { columnMigrations, migrationStatements, statements } = require('./mysql-schema');

class MysqlDatabaseSync {
  // Adapter đồng bộ: chuyển yêu cầu SQL sang worker để API dùng chung cú pháp với SQLite.
  constructor(config) {
    const { port1, port2 } = new MessageChannel();
    this.port = port1;
    this.nextId = 1;
    this.worker = new Worker(path.join(__dirname, 'mysql-worker.js'), {
      workerData: { config, port: port2 },
      transferList: [port2],
    });
    this.request('init');
  }

  request(type, sql = '', params = []) {
    const id = this.nextId++;
    const signal = new SharedArrayBuffer(4);
    this.port.postMessage({ id, type, sql, params, signal });
    const result = Atomics.wait(new Int32Array(signal), 0, 0, 30000);
    if (result === 'timed-out') {
      throw new Error(`MySQL không phản hồi trong 30 giây (${type}).`);
    }
    const message = receiveMessageOnPort(this.port)?.message;
    if (!message || message.id !== id) throw new Error('Phản hồi MySQL không hợp lệ.');
    if (!message.ok) {
      const error = new Error(message.error.message);
      Object.assign(error, message.error);
      throw error;
    }
    return message.value;
  }

  prepare(sql) {
    return {
      all: (...params) => this.request('all', sql, params),
      get: (...params) => this.request('get', sql, params),
      run: (...params) => this.request('run', sql, params),
    };
  }

  exec(sql) {
    return this.request('run', sql);
  }

  close() {
    try {
      this.request('close');
    } finally {
      this.worker.terminate();
      this.port.close();
    }
  }
}

function readConfig(overrides = {}) {
  // Chỉ đọc thông tin kết nối từ tham số hoặc biến môi trường, không ghi/log mật khẩu.
  return {
    host: overrides.host || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(overrides.port || process.env.MYSQL_PORT || 3306),
    database: overrides.database || process.env.MYSQL_DATABASE || 'flowery',
    user: overrides.user || process.env.MYSQL_USER || '',
    password: overrides.password || process.env.MYSQL_PASSWORD || '',
    ssl: overrides.ssl ?? String(process.env.MYSQL_SSL || 'false').toLowerCase() === 'true',
  };
}

function openMysqlDatabase(overrides = {}) {
  // Kết nối, tạo bảng, bổ sung cột rồi mới chạy các migration chuẩn hóa dữ liệu cũ.
  try {
    require.resolve('mysql2/promise');
  } catch {
    throw new Error('Thiếu thư viện mysql2. Hãy chạy "npm ci" trong thư mục dự án rồi thử lại.');
  }
  const config = readConfig(overrides);
  if (!config.user || /^replace-with-/i.test(config.user)) {
    throw new Error('MYSQL_USER chưa được cấu hình trong tệp .env.');
  }
  if (!config.password || /^replace-with-/i.test(config.password)) {
    throw new Error('MYSQL_PASSWORD chưa được cấu hình trong tệp .env.');
  }
  const db = new MysqlDatabaseSync(config);
  for (const statement of statements) db.exec(statement);
  for (const [table, column, definition] of columnMigrations) {
    const exists = db.prepare(`
      SELECT 1 AS present FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1
    `).get(table, column);
    if (!exists) db.exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
  const reviewIndex = db.prepare(`
    SELECT 1 AS present FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'
      AND INDEX_NAME = 'uq_reviews_order_item' LIMIT 1
  `).get();
  if (!reviewIndex) db.exec('CREATE UNIQUE INDEX uq_reviews_order_item ON reviews(order_item_id)');
  for (const statement of migrationStatements) db.exec(statement);
  return db;
}

module.exports = { openMysqlDatabase, readConfig };

