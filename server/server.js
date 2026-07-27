const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { openDatabase } = require('./database');
const {
  escapeXml,
  hashPassword,
  isStrongPassword,
  normalizeEmail,
  signToken,
  verifyPassword,
  verifyToken,
} = require('./security');

try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new HttpError(413, 'Dữ liệu gửi lên quá lớn.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Dữ liệu JSON không hợp lệ.');
  }
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function positiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function publicUser(row) {
  return {
    user_id: row.user_id,
    email: row.email,
    full_name: row.full_name,
    phone_number: row.phone_number,
    address: row.address,
    default_message: row.default_message,
    role: row.role,
    is_locked: Boolean(row.is_locked),
    created_at: row.created_at,
  };
}

function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler) {
      routes.push({ method, pattern, handler });
    },
    async dispatch(ctx) {
      for (const route of routes) {
        if (route.method !== ctx.req.method) continue;
        const match = ctx.url.pathname.match(route.pattern);
        if (match) return route.handler(ctx, ...match.slice(1));
      }
      return false;
    },
  };
}

function generateSecret(secretPath) {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(secretPath, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

function audit(db, ctx, action, entityType, entityId = '', metadata = {}) {
  db.prepare(`
    INSERT INTO audit_logs
      (actor_user_id, action, entity_type, entity_id, request_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ctx.user?.user_id ?? null,
    action,
    entityType,
    String(entityId),
    ctx.requestId,
    JSON.stringify(metadata),
  );
}

function requireUser(ctx, roles = null) {
  if (!ctx.user) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.');
  if (roles && !roles.includes(ctx.user.role)) {
    throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.');
  }
  return ctx.user;
}

function productSelect() {
  return `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug,
      COALESCE((
        SELECT ROUND(AVG(r.rating), 1)
        FROM reviews r
        WHERE r.product_id = p.product_id AND r.status = 'Approved'
      ), 0) AS average_rating,
      (
        SELECT COUNT(*)
        FROM reviews r
        WHERE r.product_id = p.product_id AND r.status = 'Approved'
      ) AS review_count
    FROM products p
    LEFT JOIN categories c ON c.category_id = p.category_id
  `;
}

function getOrder(db, orderId, userId = null) {
  const params = [orderId];
  let condition = 'o.order_id = ?';
  if (userId) {
    condition += ' AND o.user_id = ?';
    params.push(userId);
  }
  const order = db.prepare(`
    SELECT o.*, s.carrier, s.tracking_code, s.status AS shipment_status, s.proof_url,
      rr.refund_id, rr.status AS refund_status
    FROM orders o
    LEFT JOIN shipments s ON s.order_id = o.order_id
    LEFT JOIN refund_requests rr ON rr.order_id = o.order_id
    WHERE ${condition}
  `).get(...params);
  if (!order) return null;
  order.items = db.prepare(`
    SELECT order_item_id, product_id, product_name, unit_price, quantity, line_total
    FROM order_items WHERE order_id = ? ORDER BY order_item_id
  `).all(orderId);
  return order;
}

function registerRoutes(router, db, config) {
  const { secret, partnerApiKey } = config;
  const customerRoles = ['customer', 'staff', 'editor', 'warehouse', 'admin'];
  const adminRoles = ['admin'];
  const operationsRoles = ['staff', 'warehouse', 'admin'];
  const contentRoles = ['editor', 'admin'];

  router.add('GET', /^\/api\/health$/, async (ctx) => {
    const database = db.prepare('SELECT 1 AS ok').get();
    json(ctx.res, 200, {
      status: database.ok === 1 ? 'healthy' : 'degraded',
      service: 'flowery-api',
      timestamp: new Date().toISOString(),
      request_id: ctx.requestId,
    });
    return true;
  });

  router.add('POST', /^\/api\/auth\/register$/, async (ctx) => {
    const body = await readBody(ctx.req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const fullName = cleanText(body.full_name, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Email không hợp lệ.');
    }
    if (!isStrongPassword(password)) {
      throw new HttpError(400, 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.');
    }
    if (fullName.length < 2) throw new HttpError(400, 'Vui lòng nhập họ tên.');
    try {
      const result = db.prepare(`
        INSERT INTO users
          (email, password_hash, full_name, phone_number, address, default_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        email,
        hashPassword(password),
        fullName,
        cleanText(body.phone_number, 30),
        cleanText(body.address, 300),
        cleanText(body.default_message, 300),
      );
      const user = db.prepare('SELECT * FROM users WHERE user_id = ?')
        .get(Number(result.lastInsertRowid));
      ctx.user = user;
      audit(db, ctx, 'REGISTER', 'user', user.user_id);
      json(ctx.res, 201, {
        token: signToken({ sub: user.user_id, role: user.role }, secret),
        user: publicUser(user),
      });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw new HttpError(409, 'Email đã được sử dụng.');
      }
      throw error;
    }
    return true;
  });

  router.add('POST', /^\/api\/auth\/login$/, async (ctx) => {
    const body = await readBody(ctx.req);
    const email = normalizeEmail(body.email);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) {
      throw new HttpError(401, 'Email hoặc mật khẩu không đúng.');
    }
    if (user.is_locked) throw new HttpError(403, 'Tài khoản đã bị khóa.');
    ctx.user = user;
    audit(db, ctx, 'LOGIN', 'user', user.user_id);
    json(ctx.res, 200, {
      token: signToken({ sub: user.user_id, role: user.role }, secret),
      user: publicUser(user),
    });
    return true;
  });

  router.add('GET', /^\/api\/me$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    json(ctx.res, 200, { user: publicUser(user) });
    return true;
  });

  router.add('PATCH', /^\/api\/me$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    const body = await readBody(ctx.req);
    const fullName = cleanText(body.full_name ?? user.full_name, 120);
    if (fullName.length < 2) throw new HttpError(400, 'Họ tên không hợp lệ.');
    db.prepare(`
      UPDATE users SET
        full_name = ?, phone_number = ?, address = ?, default_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      fullName,
      cleanText(body.phone_number ?? user.phone_number, 30),
      cleanText(body.address ?? user.address, 300),
      cleanText(body.default_message ?? user.default_message, 300),
      user.user_id,
    );
    const updated = db.prepare('SELECT * FROM users WHERE user_id = ?').get(user.user_id);
    audit(db, ctx, 'UPDATE_PROFILE', 'user', user.user_id);
    json(ctx.res, 200, { user: publicUser(updated) });
    return true;
  });

  router.add('GET', /^\/api\/categories$/, async (ctx) => {
    const items = db.prepare(`
      SELECT c.*, COUNT(p.product_id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.category_id AND p.active = 1
      WHERE c.active = 1
      GROUP BY c.category_id
      ORDER BY c.name
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('GET', /^\/api\/products$/, async (ctx) => {
    const search = cleanText(ctx.url.searchParams.get('q'), 100);
    const category = cleanText(ctx.url.searchParams.get('category'), 80);
    const occasion = cleanText(ctx.url.searchParams.get('occasion'), 80);
    const color = cleanText(ctx.url.searchParams.get('color'), 50);
    const minPrice = positiveInteger(ctx.url.searchParams.get('minPrice'), 0);
    const maxPrice = positiveInteger(ctx.url.searchParams.get('maxPrice'), 100000000);
    const page = Math.min(positiveInteger(ctx.url.searchParams.get('page'), 1), 10000);
    const limit = Math.min(positiveInteger(ctx.url.searchParams.get('limit'), 12), 48);
    const sort = ctx.url.searchParams.get('sort') || 'featured';
    const conditions = ['p.active = 1'];
    const params = [];

    if (search) {
      conditions.push(`(
        p.name LIKE ? OR p.description LIKE ? OR p.flower_type LIKE ? OR p.occasion LIKE ?
      )`);
      const value = `%${search}%`;
      params.push(value, value, value, value);
    }
    if (category) {
      conditions.push('(c.slug = ? OR CAST(c.category_id AS TEXT) = ?)');
      params.push(category, category);
    }
    if (occasion) {
      conditions.push('p.occasion = ?');
      params.push(occasion);
    }
    if (color) {
      conditions.push('p.color = ?');
      params.push(color);
    }
    conditions.push('p.price BETWEEN ? AND ?');
    params.push(minPrice, maxPrice);

    const orderBy = {
      featured: 'p.created_at DESC, p.product_id',
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
      rating: 'average_rating DESC, review_count DESC',
      name: 'p.name COLLATE NOCASE ASC',
    }[sort] || 'p.created_at DESC, p.product_id';

    const where = conditions.join(' AND ');
    const total = db.prepare(`
      SELECT COUNT(*) AS count
      FROM products p LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE ${where}
    `).get(...params).count;
    const items = db.prepare(`
      ${productSelect()}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit);
    const filters = {
      occasions: db.prepare(`
        SELECT DISTINCT occasion FROM products
        WHERE active = 1 AND occasion <> '' ORDER BY occasion
      `).all().map((row) => row.occasion),
      colors: db.prepare(`
        SELECT DISTINCT color FROM products
        WHERE active = 1 AND color <> '' ORDER BY color
      `).all().map((row) => row.color),
    };
    json(ctx.res, 200, {
      items,
      filters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
    return true;
  });

  router.add('GET', /^\/api\/products\/(\d+)$/, async (ctx, rawId) => {
    const productId = positiveInteger(rawId);
    const item = db.prepare(`
      ${productSelect()}
      WHERE p.product_id = ? AND p.active = 1
    `).get(productId);
    if (!item) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    const reviews = db.prepare(`
      SELECT r.review_id, r.rating, r.comment, r.created_at, u.full_name
      FROM reviews r JOIN users u ON u.user_id = r.user_id
      WHERE r.product_id = ? AND r.status = 'Approved'
      ORDER BY r.created_at DESC
    `).all(productId);
    const related = db.prepare(`
      ${productSelect()}
      WHERE p.active = 1 AND p.product_id <> ?
        AND (p.category_id = ? OR p.occasion = ? OR p.color = ?)
      ORDER BY
        CASE WHEN p.category_id = ? THEN 0 ELSE 1 END,
        p.product_id DESC
      LIMIT 4
    `).all(productId, item.category_id, item.occasion, item.color, item.category_id);
    json(ctx.res, 200, { item, reviews, related });
    return true;
  });

  router.add('GET', /^\/api\/articles$/, async (ctx) => {
    const items = db.prepare(`
      SELECT article_id, title, slug, summary, content, created_at
      FROM articles WHERE published = 1 ORDER BY created_at DESC
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('GET', /^\/api\/wishlist$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    const items = db.prepare(`
      ${productSelect()}
      JOIN wishlists w ON w.product_id = p.product_id
      WHERE w.user_id = ? AND p.active = 1
      ORDER BY w.created_at DESC
    `).all(user.user_id);
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('POST', /^\/api\/wishlist\/(\d+)$/, async (ctx, rawProductId) => {
    const user = requireUser(ctx, customerRoles);
    const productId = positiveInteger(rawProductId);
    const product = db.prepare('SELECT product_id FROM products WHERE product_id = ? AND active = 1')
      .get(productId);
    if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    db.prepare(`
      INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)
      ON CONFLICT(user_id, product_id) DO NOTHING
    `).run(user.user_id, productId);
    json(ctx.res, 201, { success: true });
    return true;
  });

  router.add('DELETE', /^\/api\/wishlist\/(\d+)$/, async (ctx, rawProductId) => {
    const user = requireUser(ctx, customerRoles);
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
      .run(user.user_id, positiveInteger(rawProductId));
    ctx.res.writeHead(204);
    ctx.res.end();
    return true;
  });

  router.add('GET', /^\/api\/cart$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    const items = db.prepare(`
      SELECT p.*, c.quantity, (p.price * c.quantity) AS line_total
      FROM cart_items c JOIN products p ON p.product_id = c.product_id
      WHERE c.user_id = ? AND p.active = 1
      ORDER BY c.updated_at DESC
    `).all(user.user_id);
    json(ctx.res, 200, {
      items,
      subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
    });
    return true;
  });

  router.add('POST', /^\/api\/cart$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    const body = await readBody(ctx.req);
    const productId = positiveInteger(body.product_id);
    const quantity = Math.min(positiveInteger(body.quantity, 1), 99);
    const product = db.prepare(`
      SELECT product_id, stock_quantity FROM products
      WHERE product_id = ? AND active = 1
    `).get(productId);
    if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    if (quantity > product.stock_quantity) throw new HttpError(409, 'Số lượng vượt quá tồn kho.');
    db.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        quantity = MIN(excluded.quantity + cart_items.quantity, 99),
        updated_at = CURRENT_TIMESTAMP
    `).run(user.user_id, productId, quantity);
    json(ctx.res, 201, { success: true });
    return true;
  });

  router.add('PATCH', /^\/api\/cart\/(\d+)$/, async (ctx, rawProductId) => {
    const user = requireUser(ctx, customerRoles);
    const productId = positiveInteger(rawProductId);
    const body = await readBody(ctx.req);
    const quantity = Math.min(positiveInteger(body.quantity, 1), 99);
    const product = db.prepare('SELECT stock_quantity FROM products WHERE product_id = ?')
      .get(productId);
    if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    if (quantity > product.stock_quantity) throw new HttpError(409, 'Số lượng vượt quá tồn kho.');
    const result = db.prepare(`
      UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND product_id = ?
    `).run(quantity, user.user_id, productId);
    if (result.changes === 0) throw new HttpError(404, 'Sản phẩm không có trong giỏ.');
    json(ctx.res, 200, { success: true });
    return true;
  });

  router.add('DELETE', /^\/api\/cart\/(\d+)$/, async (ctx, rawProductId) => {
    const user = requireUser(ctx, customerRoles);
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?')
      .run(user.user_id, positiveInteger(rawProductId));
    ctx.res.writeHead(204);
    ctx.res.end();
    return true;
  });

  router.add('POST', /^\/api\/orders$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    const body = await readBody(ctx.req);
    const idempotencyKey = cleanText(
      ctx.req.headers['idempotency-key'] || body.idempotency_key || crypto.randomUUID(),
      100,
    );
    const existing = db.prepare(`
      SELECT order_id FROM orders WHERE user_id = ? AND idempotency_key = ?
    `).get(user.user_id, idempotencyKey);
    if (existing) {
      json(ctx.res, 200, { order: getOrder(db, existing.order_id, user.user_id), duplicate: true });
      return true;
    }

    const requestedItems = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : db.prepare('SELECT product_id, quantity FROM cart_items WHERE user_id = ?')
        .all(user.user_id);
    if (requestedItems.length === 0) throw new HttpError(400, 'Giỏ hàng đang trống.');

    const customerName = cleanText(body.customer_name || user.full_name, 120);
    const customerPhone = cleanText(body.customer_phone || user.phone_number, 30);
    const shippingAddress = cleanText(body.shipping_address || user.address, 300);
    if (!customerName || !customerPhone || shippingAddress.length < 8) {
      throw new HttpError(400, 'Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ giao hàng.');
    }
    const paymentMethod = ['COD', 'CARD', 'MOMO'].includes(body.payment_method)
      ? body.payment_method
      : 'COD';
    const giftWrapFee = body.gift_wrap ? 50000 : 0;

    let orderId;
    db.exec('BEGIN IMMEDIATE');
    try {
      const normalizedItems = [];
      let subtotal = 0;
      for (const rawItem of requestedItems) {
        const productId = positiveInteger(rawItem.product_id);
        const quantity = Math.min(positiveInteger(rawItem.quantity ?? rawItem.qty, 1), 99);
        const product = db.prepare(`
          SELECT product_id, name, price, stock_quantity
          FROM products WHERE product_id = ? AND active = 1
        `).get(productId);
        if (!product) throw new HttpError(404, `Sản phẩm #${productId} không còn kinh doanh.`);
        if (product.stock_quantity < quantity) {
          throw new HttpError(409, `${product.name} chỉ còn ${product.stock_quantity} sản phẩm.`);
        }
        normalizedItems.push({ ...product, quantity });
        subtotal += product.price * quantity;
      }

      const total = subtotal + giftWrapFee;
      const orderNumber = `FLW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const paid = paymentMethod !== 'COD';
      const result = db.prepare(`
        INSERT INTO orders
          (order_number, user_id, customer_name, customer_phone, shipping_address,
           gift_message, subtotal, gift_wrap_fee, total_amount, payment_method,
           payment_status, status, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?)
      `).run(
        orderNumber,
        user.user_id,
        customerName,
        customerPhone,
        shippingAddress,
        cleanText(body.gift_message || user.default_message, 300),
        subtotal,
        giftWrapFee,
        total,
        paymentMethod,
        paid ? 'Paid' : 'Pending',
        idempotencyKey,
      );
      orderId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO order_items
          (order_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const updateStock = db.prepare(`
        UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ? AND stock_quantity >= ?
      `);
      for (const item of normalizedItems) {
        const stockResult = updateStock.run(item.quantity, item.product_id, item.quantity);
        if (stockResult.changes !== 1) throw new HttpError(409, `Tồn kho ${item.name} vừa thay đổi.`);
        insertItem.run(
          orderId,
          item.product_id,
          item.name,
          item.price,
          item.quantity,
          item.price * item.quantity,
        );
      }
      db.prepare(`
        INSERT INTO payments (order_id, provider, provider_reference, amount, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        orderId,
        paid ? 'Flowery Payment Sandbox' : 'Cash on delivery',
        paid ? `PAY-${crypto.randomUUID()}` : `COD-${orderNumber}`,
        total,
        paid ? 'Paid' : 'Pending',
      );
      db.prepare(`
        INSERT INTO shipments (order_id, tracking_code, status)
        VALUES (?, ?, 'Preparing')
      `).run(orderId, `SHIP-${orderNumber}`);
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(user.user_id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    audit(db, ctx, 'CREATE_ORDER', 'order', orderId, { payment_method: paymentMethod });
    json(ctx.res, 201, { order: getOrder(db, orderId, user.user_id) });
    return true;
  });

  router.add('GET', /^\/api\/orders\/mine$/, async (ctx) => {
    const user = requireUser(ctx, customerRoles);
    const rows = db.prepare(`
      SELECT order_id FROM orders WHERE user_id = ? ORDER BY created_at DESC, order_id DESC
    `).all(user.user_id);
    json(ctx.res, 200, { items: rows.map((row) => getOrder(db, row.order_id, user.user_id)) });
    return true;
  });

  router.add('GET', /^\/api\/orders\/(\d+)$/, async (ctx, rawOrderId) => {
    const user = requireUser(ctx, customerRoles);
    const order = getOrder(db, positiveInteger(rawOrderId), user.user_id);
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
    json(ctx.res, 200, { order });
    return true;
  });

  router.add('POST', /^\/api\/orders\/(\d+)\/cancel$/, async (ctx, rawOrderId) => {
    const user = requireUser(ctx, customerRoles);
    const orderId = positiveInteger(rawOrderId);
    const body = await readBody(ctx.req);
    db.exec('BEGIN IMMEDIATE');
    try {
      const order = db.prepare(`
        SELECT * FROM orders WHERE order_id = ? AND user_id = ?
      `).get(orderId, user.user_id);
      if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
      if (!['Confirmed', 'Preparing'].includes(order.status)) {
        throw new HttpError(409, 'Đơn đã giao cho đơn vị vận chuyển nên không thể hủy.');
      }
      const items = db.prepare(`
        SELECT product_id, quantity FROM order_items WHERE order_id = ?
      `).all(orderId);
      for (const item of items) {
        if (item.product_id) {
          db.prepare(`
            UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?
          `).run(item.quantity, item.product_id);
        }
      }
      db.prepare(`
        UPDATE orders SET
          status = 'Cancelled', cancel_reason = ?,
          payment_status = CASE WHEN payment_status = 'Paid' THEN 'Refunded' ELSE payment_status END,
          updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).run(cleanText(body.reason || 'Khách hàng yêu cầu hủy', 300), orderId);
      db.prepare(`
        UPDATE shipments SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).run(orderId);
      if (order.payment_status === 'Paid') {
        db.prepare(`
          INSERT OR IGNORE INTO refund_requests
            (order_id, user_id, reason, amount, status)
          VALUES (?, ?, ?, ?, 'Completed')
        `).run(orderId, user.user_id, 'Hoàn tiền tự động khi hủy trước lúc giao', order.total_amount);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    audit(db, ctx, 'CANCEL_ORDER', 'order', orderId);
    json(ctx.res, 200, { order: getOrder(db, orderId, user.user_id) });
    return true;
  });

  router.add('POST', /^\/api\/orders\/(\d+)\/refunds$/, async (ctx, rawOrderId) => {
    const user = requireUser(ctx, customerRoles);
    const orderId = positiveInteger(rawOrderId);
    const body = await readBody(ctx.req);
    const order = db.prepare(`
      SELECT * FROM orders WHERE order_id = ? AND user_id = ?
    `).get(orderId, user.user_id);
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
    if (order.status !== 'Delivered') {
      throw new HttpError(409, 'Chỉ có thể yêu cầu hoàn tiền cho đơn đã giao.');
    }
    const reason = cleanText(body.reason, 500);
    if (reason.length < 10) throw new HttpError(400, 'Vui lòng mô tả lý do hoàn tiền.');
    try {
      const result = db.prepare(`
        INSERT INTO refund_requests (order_id, user_id, reason, amount)
        VALUES (?, ?, ?, ?)
      `).run(orderId, user.user_id, reason, order.total_amount);
      audit(db, ctx, 'REQUEST_REFUND', 'refund', Number(result.lastInsertRowid));
      json(ctx.res, 201, { success: true });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw new HttpError(409, 'Đơn này đã có yêu cầu hoàn tiền.');
      }
      throw error;
    }
    return true;
  });

  router.add('POST', /^\/api\/products\/(\d+)\/reviews$/, async (ctx, rawProductId) => {
    const user = requireUser(ctx, customerRoles);
    const productId = positiveInteger(rawProductId);
    const body = await readBody(ctx.req);
    const rating = positiveInteger(body.rating);
    const comment = cleanText(body.comment, 1000);
    if (!rating || rating > 5 || comment.length < 5) {
      throw new HttpError(400, 'Đánh giá cần từ 1-5 sao và nội dung ít nhất 5 ký tự.');
    }
    const purchased = db.prepare(`
      SELECT 1
      FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
      WHERE o.user_id = ? AND o.status = 'Delivered' AND oi.product_id = ?
      LIMIT 1
    `).get(user.user_id, productId);
    if (!purchased) throw new HttpError(403, 'Bạn chỉ có thể đánh giá sản phẩm đã nhận.');
    try {
      const result = db.prepare(`
        INSERT INTO reviews (user_id, product_id, rating, comment)
        VALUES (?, ?, ?, ?)
      `).run(user.user_id, productId, rating, comment);
      audit(db, ctx, 'CREATE_REVIEW', 'review', Number(result.lastInsertRowid));
      json(ctx.res, 201, { message: 'Đánh giá đã được gửi và đang chờ duyệt.' });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw new HttpError(409, 'Bạn đã đánh giá sản phẩm này.');
      }
      throw error;
    }
    return true;
  });

  registerAdminRoutes(router, db, {
    adminRoles,
    operationsRoles,
    contentRoles,
  });

  router.add('GET', /^\/api\/partner\/catalog(?:\.xml)?$/, async (ctx) => {
    const key = ctx.req.headers['x-api-key'] || ctx.url.searchParams.get('key');
    if (key !== partnerApiKey) throw new HttpError(401, 'Partner API key không hợp lệ.');
    const items = db.prepare(`
      SELECT p.product_id, p.name, p.slug, p.price, p.description, p.image_url,
        p.occasion, p.flower_type, p.color, p.stock_quantity,
        c.name AS category_name
      FROM products p LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE p.active = 1 ORDER BY p.product_id
    `).all();
    if (ctx.url.pathname.endsWith('.xml')) {
      const rows = items.map((item) => `
  <product id="${item.product_id}">
    <name>${escapeXml(item.name)}</name>
    <slug>${escapeXml(item.slug)}</slug>
    <category>${escapeXml(item.category_name)}</category>
    <price currency="VND">${item.price}</price>
    <stock>${item.stock_quantity}</stock>
    <image>${escapeXml(item.image_url)}</image>
  </product>`).join('');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog version="1.0" generatedAt="${new Date().toISOString()}">${rows}
</catalog>`;
      text(ctx.res, 200, xml, 'application/xml; charset=utf-8');
    } else {
      json(ctx.res, 200, {
        version: '1.0',
        generated_at: new Date().toISOString(),
        items,
      });
    }
    return true;
  });

  router.add('GET', /^\/api\/media\/([a-z0-9-]+)\.svg$/, async (ctx, slug) => {
    text(ctx.res, 200, createFlowerSvg(slug, db), 'image/svg+xml; charset=utf-8');
    return true;
  });
}

function registerAdminRoutes(router, db, roles) {
  const { adminRoles, operationsRoles, contentRoles } = roles;

  router.add('GET', /^\/api\/admin\/stats$/, async (ctx) => {
    requireUser(ctx, ['staff', 'editor', 'warehouse', 'admin']);
    const stats = {
      revenue: db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) AS value FROM orders
        WHERE status <> 'Cancelled'
      `).get().value,
      orders: db.prepare('SELECT COUNT(*) AS value FROM orders').get().value,
      pending_orders: db.prepare(`
        SELECT COUNT(*) AS value FROM orders WHERE status IN ('Confirmed', 'Preparing')
      `).get().value,
      customers: db.prepare(`
        SELECT COUNT(*) AS value FROM users WHERE role = 'customer'
      `).get().value,
      low_stock: db.prepare(`
        SELECT COUNT(*) AS value FROM products WHERE active = 1 AND stock_quantity <= 10
      `).get().value,
      pending_reviews: db.prepare(`
        SELECT COUNT(*) AS value FROM reviews WHERE status = 'Pending'
      `).get().value,
    };
    json(ctx.res, 200, { stats });
    return true;
  });

  router.add('GET', /^\/api\/admin\/products$/, async (ctx) => {
    requireUser(ctx, ['staff', 'editor', 'warehouse', 'admin']);
    const items = db.prepare(`
      ${productSelect()}
      ORDER BY p.active DESC, p.updated_at DESC, p.product_id DESC
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('PATCH', /^\/api\/admin\/products\/(\d+)\/stock$/, async (ctx, rawProductId) => {
    requireUser(ctx, operationsRoles);
    const productId = positiveInteger(rawProductId);
    const existing = db.prepare('SELECT product_id, stock_quantity FROM products WHERE product_id = ?')
      .get(productId);
    if (!existing) throw new HttpError(404, 'Không tìm thấy sản phẩm.');

    const body = await readBody(ctx.req);
    const stock = Number(body.stock_quantity);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      throw new HttpError(400, 'Tồn kho phải là số nguyên từ 0 đến 1.000.000.');
    }

    db.prepare(`
      UPDATE products
      SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `).run(stock, productId);
    audit(db, ctx, 'UPDATE_PRODUCT_STOCK', 'product', productId, {
      from: existing.stock_quantity,
      to: stock,
    });
    json(ctx.res, 200, {
      item: db.prepare(`${productSelect()} WHERE p.product_id = ?`).get(productId),
    });
    return true;
  });

  router.add('POST', /^\/api\/admin\/products$/, async (ctx) => {
    requireUser(ctx, contentRoles);
    const body = await readBody(ctx.req);
    const product = validateProduct(body);
    try {
      const result = db.prepare(`
        INSERT INTO products
          (category_id, name, slug, price, description, image_url, occasion,
           flower_type, color, stock_quantity, active, editorial_review)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product.category_id,
        product.name,
        product.slug,
        product.price,
        product.description,
        product.image_url || `/api/media/${product.slug}.svg`,
        product.occasion,
        product.flower_type,
        product.color,
        product.stock_quantity,
        product.active,
        product.editorial_review,
      );
      const id = Number(result.lastInsertRowid);
      audit(db, ctx, 'CREATE_PRODUCT', 'product', id);
      json(ctx.res, 201, { item: db.prepare(`${productSelect()} WHERE p.product_id = ?`).get(id) });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw new HttpError(409, 'Slug sản phẩm đã tồn tại.');
      }
      throw error;
    }
    return true;
  });

  router.add('PUT', /^\/api\/admin\/products\/(\d+)$/, async (ctx, rawProductId) => {
    requireUser(ctx, contentRoles);
    const productId = positiveInteger(rawProductId);
    const existing = db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
    if (!existing) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    const body = await readBody(ctx.req);
    const product = validateProduct({ ...existing, ...body });
    db.prepare(`
      UPDATE products SET
        category_id = ?, name = ?, slug = ?, price = ?, description = ?,
        image_url = ?, occasion = ?, flower_type = ?, color = ?,
        stock_quantity = ?, active = ?, editorial_review = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `).run(
      product.category_id,
      product.name,
      product.slug,
      product.price,
      product.description,
      product.image_url || `/api/media/${product.slug}.svg`,
      product.occasion,
      product.flower_type,
      product.color,
      product.stock_quantity,
      product.active,
      product.editorial_review,
      productId,
    );
    audit(db, ctx, 'UPDATE_PRODUCT', 'product', productId);
    json(ctx.res, 200, { item: db.prepare(`${productSelect()} WHERE p.product_id = ?`).get(productId) });
    return true;
  });

  router.add('DELETE', /^\/api\/admin\/products\/(\d+)$/, async (ctx, rawProductId) => {
    requireUser(ctx, contentRoles);
    const productId = positiveInteger(rawProductId);
    const result = db.prepare(`
      UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?
    `).run(productId);
    if (result.changes === 0) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    audit(db, ctx, 'ARCHIVE_PRODUCT', 'product', productId);
    json(ctx.res, 200, { success: true });
    return true;
  });

  router.add('GET', /^\/api\/admin\/categories$/, async (ctx) => {
    requireUser(ctx, ['staff', 'editor', 'warehouse', 'admin']);
    const items = db.prepare(`
      SELECT c.*, COUNT(p.product_id) AS product_count
      FROM categories c LEFT JOIN products p ON p.category_id = c.category_id
      GROUP BY c.category_id ORDER BY c.name
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('POST', /^\/api\/admin\/categories$/, async (ctx) => {
    requireUser(ctx, contentRoles);
    const body = await readBody(ctx.req);
    const name = cleanText(body.name, 100);
    const slug = slugify(body.slug || name);
    if (name.length < 2 || !slug) throw new HttpError(400, 'Danh mục không hợp lệ.');
    const result = db.prepare(`
      INSERT INTO categories (name, slug, description)
      VALUES (?, ?, ?)
    `).run(name, slug, cleanText(body.description, 500));
    const id = Number(result.lastInsertRowid);
    audit(db, ctx, 'CREATE_CATEGORY', 'category', id);
    json(ctx.res, 201, {
      success: true,
      category_id: id,
      item: getAdminCategory(db, id),
    });
    return true;
  });

  router.add('PUT', /^\/api\/admin\/categories\/(\d+)$/, async (ctx, rawCategoryId) => {
    requireUser(ctx, contentRoles);
    const categoryId = positiveInteger(rawCategoryId);
    const body = await readBody(ctx.req);
    const existing = db.prepare('SELECT * FROM categories WHERE category_id = ?').get(categoryId);
    if (!existing) throw new HttpError(404, 'Không tìm thấy danh mục.');
    const name = cleanText(body.name ?? existing.name, 100);
    const slug = slugify(body.slug ?? existing.slug);
    db.prepare(`
      UPDATE categories SET name = ?, slug = ?, description = ?, active = ?
      WHERE category_id = ?
    `).run(
      name,
      slug,
      cleanText(body.description ?? existing.description, 500),
      body.active === false || body.active === 0 ? 0 : 1,
      categoryId,
    );
    audit(db, ctx, 'UPDATE_CATEGORY', 'category', categoryId);
    json(ctx.res, 200, { success: true, item: getAdminCategory(db, categoryId) });
    return true;
  });

  router.add('DELETE', /^\/api\/admin\/categories\/(\d+)$/, async (ctx, rawCategoryId) => {
    requireUser(ctx, contentRoles);
    const categoryId = positiveInteger(rawCategoryId);
    const existing = db.prepare('SELECT * FROM categories WHERE category_id = ?').get(categoryId);
    if (!existing) throw new HttpError(404, 'Không tìm thấy danh mục.');

    const activeProducts = db.prepare(`
      SELECT COUNT(*) AS value
      FROM products
      WHERE category_id = ? AND active = 1
    `).get(categoryId).value;
    if (activeProducts > 0) {
      throw new HttpError(
        409,
        `Danh mục đang có ${activeProducts} sản phẩm hoạt động. Hãy chuyển hoặc ngừng bán sản phẩm trước.`,
      );
    }

    db.prepare('UPDATE categories SET active = 0 WHERE category_id = ?').run(categoryId);
    audit(db, ctx, 'ARCHIVE_CATEGORY', 'category', categoryId);
    json(ctx.res, 200, { success: true, item: getAdminCategory(db, categoryId) });
    return true;
  });

  router.add('GET', /^\/api\/admin\/orders$/, async (ctx) => {
    requireUser(ctx, operationsRoles);
    const rows = db.prepare(`
      SELECT order_id FROM orders ORDER BY created_at DESC, order_id DESC LIMIT 200
    `).all();
    json(ctx.res, 200, { items: rows.map((row) => getOrder(db, row.order_id)) });
    return true;
  });

  router.add('PATCH', /^\/api\/admin\/orders\/(\d+)$/, async (ctx, rawOrderId) => {
    requireUser(ctx, operationsRoles);
    const orderId = positiveInteger(rawOrderId);
    const body = await readBody(ctx.req);
    const status = cleanText(body.status, 30);
    const allowed = ['Confirmed', 'Preparing', 'Shipping', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) throw new HttpError(400, 'Trạng thái không hợp lệ.');
    const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
    if (order.status === 'Cancelled' || order.status === 'Delivered') {
      throw new HttpError(409, 'Đơn đã ở trạng thái kết thúc.');
    }
    db.prepare(`
      UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
    `).run(status, orderId);
    db.prepare(`
      UPDATE shipments SET status = ?, proof_url = COALESCE(NULLIF(?, ''), proof_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(status, cleanText(body.proof_url, 500), orderId);
    audit(db, ctx, 'UPDATE_ORDER_STATUS', 'order', orderId, { from: order.status, to: status });
    json(ctx.res, 200, { order: getOrder(db, orderId) });
    return true;
  });

  router.add('GET', /^\/api\/admin\/reviews$/, async (ctx) => {
    requireUser(ctx, ['staff', 'editor', 'admin']);
    const items = db.prepare(`
      SELECT r.*, u.full_name, u.email, p.name AS product_name
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      JOIN products p ON p.product_id = r.product_id
      ORDER BY CASE r.status WHEN 'Pending' THEN 0 ELSE 1 END, r.created_at DESC
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('PATCH', /^\/api\/admin\/reviews\/(\d+)$/, async (ctx, rawReviewId) => {
    const user = requireUser(ctx, ['staff', 'editor', 'admin']);
    const reviewId = positiveInteger(rawReviewId);
    const body = await readBody(ctx.req);
    const status = cleanText(body.status, 20);
    if (!['Approved', 'Rejected'].includes(status)) {
      throw new HttpError(400, 'Trạng thái đánh giá không hợp lệ.');
    }
    const result = db.prepare(`
      UPDATE reviews SET status = ?, moderated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE review_id = ?
    `).run(status, user.user_id, reviewId);
    if (result.changes === 0) throw new HttpError(404, 'Không tìm thấy đánh giá.');
    audit(db, ctx, 'MODERATE_REVIEW', 'review', reviewId, { status });
    json(ctx.res, 200, { success: true });
    return true;
  });

  router.add('GET', /^\/api\/admin\/users$/, async (ctx) => {
    requireUser(ctx, adminRoles);
    const items = db.prepare(`
      SELECT user_id, email, full_name, phone_number, address, role, is_locked, created_at
      FROM users ORDER BY created_at DESC, user_id DESC
    `).all();
    json(ctx.res, 200, { items: items.map((item) => ({ ...item, is_locked: Boolean(item.is_locked) })) });
    return true;
  });

  router.add('PATCH', /^\/api\/admin\/users\/(\d+)$/, async (ctx, rawUserId) => {
    const actor = requireUser(ctx, adminRoles);
    const userId = positiveInteger(rawUserId);
    const body = await readBody(ctx.req);
    if (userId === actor.user_id && body.is_locked === true) {
      throw new HttpError(409, 'Bạn không thể tự khóa tài khoản đang dùng.');
    }
    const target = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    if (!target) throw new HttpError(404, 'Không tìm thấy người dùng.');
    const role = body.role && ['customer', 'staff', 'editor', 'warehouse', 'admin'].includes(body.role)
      ? body.role
      : target.role;
    const locked = body.is_locked === undefined ? target.is_locked : (body.is_locked ? 1 : 0);
    db.prepare(`
      UPDATE users SET role = ?, is_locked = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(role, locked, userId);
    audit(db, ctx, 'UPDATE_USER_ACCESS', 'user', userId, { role, is_locked: Boolean(locked) });
    json(ctx.res, 200, { success: true });
    return true;
  });

  router.add('GET', /^\/api\/admin\/refunds$/, async (ctx) => {
    requireUser(ctx, operationsRoles);
    const items = db.prepare(`
      SELECT rr.*, o.order_number, o.payment_status, u.full_name, u.email
      FROM refund_requests rr
      JOIN orders o ON o.order_id = rr.order_id
      JOIN users u ON u.user_id = rr.user_id
      ORDER BY CASE rr.status WHEN 'Pending' THEN 0 ELSE 1 END, rr.created_at DESC
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });

  router.add('PATCH', /^\/api\/admin\/refunds\/(\d+)$/, async (ctx, rawRefundId) => {
    const user = requireUser(ctx, operationsRoles);
    const refundId = positiveInteger(rawRefundId);
    const body = await readBody(ctx.req);
    const status = cleanText(body.status, 20);
    if (!['Approved', 'Rejected', 'Completed'].includes(status)) {
      throw new HttpError(400, 'Trạng thái hoàn tiền không hợp lệ.');
    }
    const refund = db.prepare('SELECT * FROM refund_requests WHERE refund_id = ?').get(refundId);
    if (!refund) throw new HttpError(404, 'Không tìm thấy yêu cầu.');
    db.prepare(`
      UPDATE refund_requests SET status = ?, handled_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE refund_id = ?
    `).run(status, user.user_id, refundId);
    if (status === 'Completed') {
      db.prepare(`
        UPDATE orders SET payment_status = 'Refunded', updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).run(refund.order_id);
    }
    audit(db, ctx, 'UPDATE_REFUND', 'refund', refundId, { status });
    json(ctx.res, 200, { success: true });
    return true;
  });

  router.add('GET', /^\/api\/admin\/audit$/, async (ctx) => {
    requireUser(ctx, adminRoles);
    const items = db.prepare(`
      SELECT a.*, u.email AS actor_email
      FROM audit_logs a LEFT JOIN users u ON u.user_id = a.actor_user_id
      ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 200
    `).all();
    json(ctx.res, 200, { items });
    return true;
  });
}

function validateProduct(body) {
  const name = cleanText(body.name, 140);
  const slug = slugify(body.slug || name);
  const price = positiveInteger(body.price, 0);
  const stock = Number.parseInt(body.stock_quantity, 10);
  if (name.length < 2 || !slug) throw new HttpError(400, 'Tên sản phẩm không hợp lệ.');
  if (!Number.isInteger(price) || price < 1000) throw new HttpError(400, 'Giá sản phẩm không hợp lệ.');
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Tồn kho không hợp lệ.');
  return {
    category_id: positiveInteger(body.category_id),
    name,
    slug,
    price,
    description: cleanText(body.description, 2000),
    image_url: cleanText(body.image_url, 500),
    occasion: cleanText(body.occasion, 80),
    flower_type: cleanText(body.flower_type, 80),
    color: cleanText(body.color, 50),
    stock_quantity: stock,
    active: body.active === false || body.active === 0 ? 0 : 1,
    editorial_review: cleanText(body.editorial_review, 1500),
  };
}

function getAdminCategory(db, categoryId) {
  return db.prepare(`
    SELECT c.*, COUNT(p.product_id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.category_id
    WHERE c.category_id = ?
    GROUP BY c.category_id
  `).get(categoryId);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function createFlowerSvg(slug, db) {
  if (slug === 'delivery-proof') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4e7dc"/><stop offset="1" stop-color="#dbe8dd"/></linearGradient></defs>
      <rect width="800" height="520" rx="36" fill="url(#bg)"/>
      <rect x="210" y="110" width="380" height="300" rx="28" fill="#fffaf5" stroke="#315c4a" stroke-width="8"/>
      <path d="M250 350l95-105 75 70 55-55 75 90" fill="none" stroke="#d76d5d" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="495" cy="190" r="34" fill="#e8b35c"/>
      <text x="400" y="465" text-anchor="middle" font-family="Arial" font-size="28" fill="#315c4a">Ảnh bàn giao mẫu</text>
    </svg>`;
  }
  const product = db.prepare('SELECT name, color FROM products WHERE slug = ?').get(slug);
  const name = product?.name || 'Flowery';
  const palette = {
    'Hồng': ['#ef9c9c', '#f8d7da', '#c75565'],
    'Vàng': ['#f3c969', '#ffe5a3', '#d99c2b'],
    'Trắng': ['#fffdf8', '#e7dfd1', '#b7c9b1'],
    'Đỏ': ['#c84655', '#ef7783', '#8f2935'],
    'Cam': ['#e98b4a', '#f7c075', '#be5b35'],
    'Tím': ['#9b78b5', '#d4bddf', '#71518d'],
    'Xanh': ['#77a9b5', '#c3dde0', '#4f7f8a'],
    'Kem': ['#f2d6b3', '#fff1da', '#c99b6a'],
  };
  const [primary, soft, deep] = palette[product?.color] || ['#d9828b', '#f6cbd0', '#9d505c'];
  const hash = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rotate = (hash % 17) - 8;
  const petals = Array.from({ length: 9 }, (_, index) => {
    const angle = index * 40;
    return `<ellipse cx="400" cy="178" rx="48" ry="104" fill="${index % 2 ? primary : soft}" transform="rotate(${angle} 400 260)" opacity=".96"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700" role="img" aria-label="${escapeXml(name)}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf3"/><stop offset="1" stop-color="${soft}"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#315c4a" flood-opacity=".18"/></filter>
    </defs>
    <rect width="900" height="700" fill="url(#background)"/>
    <circle cx="115" cy="104" r="68" fill="#fff" opacity=".3"/>
    <circle cx="790" cy="560" r="110" fill="#fff" opacity=".22"/>
    <g transform="rotate(${rotate} 450 350)" filter="url(#shadow)">
      <path d="M380 330 C350 455 330 520 285 625 M465 335 C470 465 485 545 520 640 M540 330 C590 455 620 530 665 610" fill="none" stroke="#557b64" stroke-width="22" stroke-linecap="round"/>
      <path d="M350 470c-88-52-120 30-30 70 58 26 83-28 30-70M520 475c92-50 120 38 29 71-62 22-80-32-29-71" fill="#6f9d7c"/>
      <g transform="translate(28 8)">${petals}<circle cx="400" cy="260" r="58" fill="${deep}"/><circle cx="400" cy="260" r="30" fill="#f6cf78"/></g>
    </g>
    <rect x="92" y="582" width="716" height="78" rx="39" fill="#fffaf6" opacity=".92"/>
    <text x="450" y="632" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#263e34">${escapeXml(name)}</text>
  </svg>`;
}

function serveStatic(req, res, pathname, staticDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!fs.existsSync(staticDir)) return false;
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(staticDir, normalized);
  if (!filePath.startsWith(path.resolve(staticDir))) return false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(staticDir, 'index.html');
  }
  if (!fs.existsSync(filePath)) return false;
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  }[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(filePath).pipe(res);
  return true;
}

function createApplication(options = {}) {
  const root = path.resolve(__dirname, '..');
  const databasePath = options.databasePath
    || process.env.DATABASE_PATH
    || path.join(__dirname, 'data', 'flowery.db');
  const secretPath = path.join(__dirname, 'data', 'app.secret');
  const secret = options.secret || generateSecret(secretPath);
  const partnerApiKey = options.partnerApiKey || process.env.PARTNER_API_KEY || 'demo-partner-key';
  const staticDir = options.staticDir || path.join(root, 'client', 'dist');
  const db = openDatabase(databasePath);
  const router = createRouter();
  const rateLimits = new Map();
  registerRoutes(router, db, { secret, partnerApiKey });

  const handler = async (req, res) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'");
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    if (req.headers.origin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,Idempotency-Key,X-API-Key,X-Request-Id',
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const ip = req.socket.remoteAddress || 'unknown';
    const limitKey = `${ip}:${url.pathname.startsWith('/api/auth/') ? 'auth' : 'api'}`;
    const limit = url.pathname.startsWith('/api/auth/') ? 20 : 300;
    const windowMs = 60_000;
    const now = Date.now();
    const bucket = rateLimits.get(limitKey);
    if (!bucket || bucket.resetAt <= now) {
      rateLimits.set(limitKey, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > limit) {
        json(res, 429, { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', request_id: requestId });
        return;
      }
    }

    let user = null;
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Bearer ')) {
      const payload = verifyToken(authorization.slice(7), secret);
      if (payload?.sub) {
        const candidate = db.prepare('SELECT * FROM users WHERE user_id = ?').get(payload.sub);
        if (candidate && !candidate.is_locked) user = candidate;
      }
    }
    const ctx = { req, res, url, requestId, user };
    try {
      if (url.pathname.startsWith('/api/')) {
        const handled = await router.dispatch(ctx);
        if (!handled) throw new HttpError(404, 'API không tồn tại.');
        return;
      }
      if (serveStatic(req, res, url.pathname, staticDir)) return;
      json(res, 503, {
        error: 'Frontend chưa được build. Hãy chạy "npm run build".',
        api: '/api/health',
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) console.error(`[${requestId}]`, error);
      if (!res.headersSent) {
        json(res, status, {
          error: error instanceof HttpError ? error.message : 'Hệ thống gặp lỗi. Vui lòng thử lại.',
          details: error instanceof HttpError ? error.details : undefined,
          request_id: requestId,
        });
      } else {
        res.destroy();
      }
    }
  };

  return {
    db,
    handler,
    close() {
      db.close();
    },
  };
}

function startServer(options = {}) {
  const app = createApplication(options);
  const server = http.createServer(app.handler);
  const port = options.port ?? Number(process.env.PORT || 5000);
  const host = options.host || process.env.HOST || '127.0.0.1';
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        ...app,
        server,
        port: typeof address === 'object' && address ? address.port : port,
        host,
        async stop() {
          await new Promise((done, fail) => server.close((error) => error ? fail(error) : done()));
          app.close();
        },
      });
    });
  });
}

if (require.main === module) {
  startServer()
    .then(({ host, port }) => {
      console.log(`Flowery API đang chạy tại http://${host}:${port}`);
    })
    .catch((error) => {
      console.error('Không thể khởi động Flowery API:', error);
      process.exit(1);
    });
}

module.exports = { createApplication, startServer };
