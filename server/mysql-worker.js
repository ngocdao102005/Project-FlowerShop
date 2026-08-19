const { parentPort, workerData } = require('node:worker_threads');
const mysql = require('mysql2/promise');

const port = workerData.port;
let connection;

function normalizeSql(input) {
  let sql = String(input).trim();
  if (/^BEGIN IMMEDIATE;?$/i.test(sql)) return 'START TRANSACTION';
  sql = sql.replace(/COLLATE\s+NOCASE/gi, 'COLLATE utf8mb4_0900_ai_ci');
  sql = sql.replace(/CAST\(([^)]+)\s+AS\s+TEXT\)/gi, 'CAST($1 AS CHAR)');
  sql = sql.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT IGNORE');
  sql = sql.replace(
    /ON\s+CONFLICT\s*\(user_id,\s*product_id\)\s+DO\s+NOTHING/gi,
    'ON DUPLICATE KEY UPDATE user_id = user_id',
  );
  sql = sql.replace(
    /ON\s+CONFLICT\s*\(user_id,\s*product_id\)\s+DO\s+UPDATE\s+SET\s+quantity\s*=\s*MIN\(excluded\.quantity\s*\+\s*cart_items\.quantity,\s*99\),\s*updated_at\s*=\s*CURRENT_TIMESTAMP/gi,
    'ON DUPLICATE KEY UPDATE quantity = LEAST(VALUES(quantity) + quantity, 99), updated_at = CURRENT_TIMESTAMP',
  );
  return sql;
}

function serializeError(error) {
  return {
    message: error.message,
    code: error.code,
    errno: error.errno,
    sqlState: error.sqlState,
    sqlMessage: error.sqlMessage,
    stack: error.stack,
  };
}

async function handle(message) {
  const signal = new Int32Array(message.signal);
  try {
    let value;
    if (message.type === 'init') {
      connection = await mysql.createConnection({
        host: workerData.config.host,
        port: workerData.config.port,
        user: workerData.config.user,
        password: workerData.config.password,
        database: workerData.config.database,
        ssl: workerData.config.ssl ? {} : undefined,
        charset: 'utf8mb4',
        timezone: '+07:00',
        supportBigNumbers: true,
        dateStrings: true,
      });
      value = { connected: true };
    } else if (message.type === 'close') {
      if (connection) await connection.end();
      value = { closed: true };
    } else {
      // `query` vẫn escape tham số qua mysql2 nhưng tương thích tốt hơn với
      // LIMIT/OFFSET dạng placeholder trên MySQL 8.4 so với prepared statement.
      const [rows] = await connection.query(normalizeSql(message.sql), message.params || []);
      if (message.type === 'all') value = rows;
      else if (message.type === 'get') value = Array.isArray(rows) ? rows[0] : undefined;
      else {
        value = {
          lastInsertRowid: Number(rows.insertId || 0),
          changes: Number(rows.affectedRows || 0),
        };
      }
    }
    port.postMessage({ id: message.id, ok: true, value });
  } catch (error) {
    port.postMessage({ id: message.id, ok: false, error: serializeError(error) });
  } finally {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  }
}

port.on('message', (message) => {
  handle(message);
});

