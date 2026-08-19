const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./security');

function openDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (databasePath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone_number TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      default_message TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'staff', 'editor', 'warehouse', 'admin')),
      is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL CHECK (price >= 0),
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      occasion TEXT NOT NULL DEFAULT '',
      flower_type TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '',
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      editorial_review TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_search
      ON products(active, category_id, occasion, color, price);

    CREATE TABLE IF NOT EXISTS wishlists (
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      gift_message TEXT NOT NULL DEFAULT '',
      subtotal INTEGER NOT NULL,
      gift_wrap_fee INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'CARD', 'MOMO')),
      payment_status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
      status TEXT NOT NULL DEFAULT 'Confirmed'
        CHECK (status IN ('Confirmed', 'Preparing', 'Shipping', 'Delivered', 'Cancelled')),
      cancel_reason TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, idempotency_key)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_created
      ON orders(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS order_items (
      order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(product_id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_reference TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shipments (
      shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
      carrier TEXT NOT NULL DEFAULT 'Flowery Express',
      tracking_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Preparing',
      proof_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      review_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Rejected')),
      moderated_by INTEGER REFERENCES users(user_id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS refund_requests (
      refund_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      reason TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
      handled_by INTEGER REFERENCES users(user_id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id)
    );

    CREATE TABLE IF NOT EXISTS articles (
      article_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      request_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      actor_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'backoffice',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shipment_attempts (
      attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
      outcome TEXT NOT NULL CHECK (outcome IN ('DeliveryFailed', 'Delivered')),
      reason TEXT NOT NULL DEFAULT '',
      proof_url TEXT NOT NULL DEFAULT '',
      attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      retry_at TEXT NOT NULL DEFAULT ''
    );
  `);

  ensureColumn(db, 'refund_requests', 'evidence_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'refund_requests', 'rejection_reason', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'refund_requests', 'gateway_reference', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'shipments', 'handed_over_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'shipments', 'delivered_at', "TEXT NOT NULL DEFAULT ''");
}

function ensureColumn(db, table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all()
    .some((entry) => entry.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function seed(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users
        (email, password_hash, full_name, phone_number, address, default_message, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
      'admin@flowery.vn',
      hashPassword('Admin@123'),
      'Quản trị Flowery',
      '0900000001',
      '25 Nguyễn Huệ, Quận 1, TP.HCM',
      '',
      'admin',
    );
    insertUser.run(
      'lan@flowery.vn',
      hashPassword('Customer@123'),
      'Nguyễn Ngọc Lan',
      '0900000002',
      '18 Lê Lợi, Quận 1, TP.HCM',
      'Chúc bạn luôn rạng rỡ như những đóa hoa.',
      'customer',
    );
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
  if (categoryCount === 0) {
    const categories = [
      ['Hoa bó', 'hoa-bo', 'Những bó hoa thanh lịch cho mọi khoảnh khắc.'],
      ['Giỏ hoa', 'gio-hoa', 'Giỏ hoa sang trọng, phù hợp chúc mừng và khai trương.'],
      ['Hoa cưới', 'hoa-cuoi', 'Thiết kế tinh tế dành cho ngày trọng đại.'],
      ['Quà tặng', 'qua-tang', 'Hoa kết hợp cùng quà tặng được tuyển chọn.'],
    ];
    const insert = db.prepare(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
    );
    for (const category of categories) insert.run(...category);
  }

  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (productCount === 0) {
    const categoryIds = Object.fromEntries(
      db.prepare('SELECT slug, category_id FROM categories').all()
        .map((row) => [row.slug, row.category_id]),
    );
    const products = [
      ['Bình minh hồng', 'binh-minh-hong', 'hoa-bo', 490000, 'Bó hồng pastel dịu dàng, điểm baby trắng và lá bạc.', 'Sinh nhật', 'Hoa hồng', 'Hồng', 28, 'Tông hồng phấn tạo cảm giác ấm áp, phù hợp gửi tặng người thương.'],
      ['Nắng mật ong', 'nang-mat-ong', 'gio-hoa', 690000, 'Giỏ hướng dương và hồng vàng mang năng lượng tích cực.', 'Khai trương', 'Hướng dương', 'Vàng', 18, 'Một thiết kế rực rỡ, có chiều cao cân đối và nổi bật trong không gian sự kiện.'],
      ['Mây trắng dịu dàng', 'may-trang-diu-dang', 'hoa-bo', 560000, 'Cẩm tú cầu trắng phối cát tường và lá xanh thanh lịch.', 'Kỷ niệm', 'Cẩm tú cầu', 'Trắng', 21, 'Bảng màu tối giản giúp bó hoa phù hợp cả không gian hiện đại lẫn cổ điển.'],
      ['Lời yêu đỏ thắm', 'loi-yeu-do-tham', 'hoa-bo', 790000, 'Hai mươi bốn bông hồng đỏ nhập khẩu, gói giấy nhung đen.', 'Tình yêu', 'Hoa hồng', 'Đỏ', 15, 'Dáng bó tròn cổ điển làm nổi bật sắc đỏ sâu và thông điệp tình yêu mạnh mẽ.'],
      ['Vườn xuân', 'vuon-xuan', 'gio-hoa', 850000, 'Giỏ hoa nhiều tầng với hồng, đồng tiền và cẩm chướng.', 'Chúc mừng', 'Hoa hỗn hợp', 'Cam', 12, 'Cấu trúc đa tầng và chuyển sắc tự nhiên tạo cảm giác như một khu vườn thu nhỏ.'],
      ['Nàng thơ Lavender', 'nang-tho-lavender', 'hoa-bo', 620000, 'Bó baby tím phối hồng kem và ruy-băng lụa.', 'Sinh nhật', 'Baby', 'Tím', 24, 'Sắc tím nhẹ mang vẻ lãng mạn, trẻ trung và lên ảnh rất đẹp.'],
      ['Ngày chung đôi', 'ngay-chung-doi', 'hoa-cuoi', 980000, 'Hoa cưới dáng tròn từ mẫu đơn, hồng trắng và lan hồ điệp.', 'Đám cưới', 'Mẫu đơn', 'Trắng', 8, 'Dáng cầm gọn, cân đối và bền màu trong suốt buổi lễ.'],
      ['Bình yên xanh', 'binh-yen-xanh', 'hoa-bo', 540000, 'Cẩm tú cầu xanh phối cúc tana tạo cảm giác thư thái.', 'Cảm ơn', 'Cẩm tú cầu', 'Xanh', 17, 'Thiết kế thoáng với nhiều khoảng thở, thích hợp cho lời cảm ơn tinh tế.'],
      ['Hộp hoa & chocolate', 'hop-hoa-chocolate', 'qua-tang', 760000, 'Hộp hồng kem kèm chocolate thủ công 12 viên.', 'Sinh nhật', 'Hoa hồng', 'Kem', 20, 'Một lựa chọn quà tặng trọn vẹn, được đóng hộp chắc chắn để giao tận tay.'],
      ['Thịnh vượng', 'thinh-vuong', 'gio-hoa', 1250000, 'Giỏ hoa khai trương cỡ lớn với lan vàng và thiên điểu.', 'Khai trương', 'Hoa lan', 'Vàng', 7, 'Bố cục cao, sắc nét và đủ nổi bật cho sảnh doanh nghiệp hoặc cửa hàng mới.'],
    ];
    const insert = db.prepare(`
      INSERT INTO products
        (name, slug, category_id, price, description, image_url, occasion,
         flower_type, color, stock_quantity, editorial_review)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const product of products) {
      const [name, slug, categorySlug, price, description, occasion, flowerType, color, stock, review] = product;
      insert.run(
        name,
        slug,
        categoryIds[categorySlug],
        price,
        description,
        `/api/media/${slug}.svg`,
        occasion,
        flowerType,
        color,
        stock,
        review,
      );
    }
  }

  const articleCount = db.prepare('SELECT COUNT(*) AS count FROM articles').get().count;
  if (articleCount === 0) {
    const insert = db.prepare(`
      INSERT INTO articles (title, slug, summary, content)
      VALUES (?, ?, ?, ?)
    `);
    insert.run(
      'Chọn hoa sinh nhật theo tính cách',
      'chon-hoa-sinh-nhat',
      'Một vài gợi ý để món quà hoa kể đúng câu chuyện của người nhận.',
      'Người yêu sự tối giản thường hợp với cẩm tú cầu hoặc tulip đơn sắc. Với người nhiều năng lượng, hãy chọn hướng dương, đồng tiền và tông màu ấm.',
    );
    insert.run(
      'Giữ hoa tươi lâu tại nhà',
      'giu-hoa-tuoi-lau',
      'Ba bước đơn giản giúp bó hoa giữ được vẻ rạng rỡ.',
      'Cắt vát gốc hoa, thay nước sạch mỗi ngày và đặt bình ở nơi thoáng mát, tránh ánh nắng trực tiếp cũng như luồng gió điều hòa.',
    );
  }

  const orderCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  if (orderCount === 0) seedDeliveredOrder(db);
}

function seedDeliveredOrder(db) {
  const customer = db.prepare('SELECT user_id FROM users WHERE email = ?').get('lan@flowery.vn');
  const product = db.prepare('SELECT product_id, name, price FROM products ORDER BY product_id LIMIT 1').get();
  if (!customer || !product) return;
  const order = db.prepare(`
    INSERT INTO orders
      (order_number, user_id, customer_name, customer_phone, shipping_address,
       subtotal, gift_wrap_fee, total_amount, payment_method, payment_status, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'CARD', 'Paid', 'Delivered')
  `).run(
    'FLW-DEMO-001',
    customer.user_id,
    'Nguyễn Ngọc Lan',
    '0900000002',
    '18 Lê Lợi, Quận 1, TP.HCM',
    product.price,
    product.price,
  );
  const orderId = Number(order.lastInsertRowid);
  db.prepare(`
    INSERT INTO order_items
      (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(orderId, product.product_id, product.name, product.price, product.price);
  db.prepare(`
    INSERT INTO payments (order_id, provider, provider_reference, amount, status)
    VALUES (?, 'Flowery Sandbox', 'PAY-DEMO-001', ?, 'Paid')
  `).run(orderId, product.price);
  db.prepare(`
    INSERT INTO shipments (order_id, tracking_code, status, proof_url)
    VALUES (?, 'FLW-SHIP-DEMO', 'Delivered', '/api/media/delivery-proof.svg')
  `).run(orderId);
}

module.exports = { openDatabase };
