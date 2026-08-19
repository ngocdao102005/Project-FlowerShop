const path = require('node:path');
const {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
} = require('node:worker_threads');
const { statements } = require('./mysql-schema');

class MysqlDatabaseSync {
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
  return {
    host: overrides.host || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(overrides.port || process.env.MYSQL_PORT || 3306),
    database: overrides.database || process.env.MYSQL_DATABASE || 'flowery',
    user: overrides.user || process.env.MYSQL_USER || 'flowery_app',
    password: overrides.password || process.env.MYSQL_PASSWORD || '',
    ssl: overrides.ssl ?? String(process.env.MYSQL_SSL || 'false').toLowerCase() === 'true',
  };
}

function openMysqlDatabase(overrides = {}) {
  const db = new MysqlDatabaseSync(readConfig(overrides));
  for (const statement of statements) db.exec(statement);
  return db;
}

module.exports = { openMysqlDatabase, readConfig };

