const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone_number VARCHAR(30) NOT NULL DEFAULT '',
    address VARCHAR(500) NOT NULL DEFAULT '',
    default_message VARCHAR(500) NOT NULL DEFAULT '',
    avatar_url MEDIUMTEXT NOT NULL DEFAULT (''),
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT chk_users_role CHECK (role IN ('customer', 'staff', 'editor', 'admin')),
    CONSTRAINT chk_users_locked CHECK (is_locked IN (0, 1)),
    CONSTRAINT chk_users_change_password CHECK (must_change_password IN (0, 1))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS categories (
    category_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_categories_name (name),
    UNIQUE KEY uq_categories_slug (slug),
    CONSTRAINT chk_categories_active CHECK (active IN (0, 1))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS products (
    product_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id INT UNSIGNED NULL,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    price INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(1000) NOT NULL DEFAULT '',
    occasion VARCHAR(120) NOT NULL DEFAULT '',
    flower_type VARCHAR(120) NOT NULL DEFAULT '',
    color VARCHAR(80) NOT NULL DEFAULT '',
    stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    editorial_review TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_search (active, category_id, occasion, color, price),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id)
      REFERENCES categories(category_id) ON DELETE SET NULL,
    CONSTRAINT chk_products_active CHECK (active IN (0, 1))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS wishlists (
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_wishlists_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS cart_items (
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity TINYINT UNSIGNED NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    CONSTRAINT chk_cart_quantity CHECK (quantity BETWEEN 1 AND 99)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS orders (
    order_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(80) NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    shipping_address VARCHAR(500) NOT NULL,
    gift_message VARCHAR(500) NOT NULL DEFAULT '',
    subtotal INT UNSIGNED NOT NULL,
    gift_wrap_fee INT UNSIGNED NOT NULL DEFAULT 0,
    total_amount INT UNSIGNED NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    cancel_reason VARCHAR(500) NOT NULL DEFAULT '',
    idempotency_key VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id),
    UNIQUE KEY uq_orders_number (order_number),
    UNIQUE KEY uq_orders_idempotency (user_id, idempotency_key),
    KEY idx_orders_user_created (user_id, created_at DESC),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT chk_orders_payment_method CHECK (payment_method IN ('COD', 'CARD', 'MOMO')),
    CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
    CONSTRAINT chk_orders_status CHECK (status IN ('Confirmed', 'Preparing', 'Shipping', 'Delivered', 'Cancelled'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NULL,
    product_name VARCHAR(180) NOT NULL,
    unit_price INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total INT UNSIGNED NOT NULL,
    PRIMARY KEY (order_item_id),
    KEY idx_order_items_order (order_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS payments (
    payment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id INT UNSIGNED NOT NULL,
    provider VARCHAR(120) NOT NULL,
    provider_reference VARCHAR(180) NOT NULL,
    amount INT UNSIGNED NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (payment_id),
    KEY idx_payments_order (order_id),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS shipments (
    shipment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id INT UNSIGNED NOT NULL,
    carrier VARCHAR(120) NOT NULL DEFAULT 'Flowery Express',
    tracking_code VARCHAR(180) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Preparing',
    proof_url VARCHAR(1000) NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    handed_over_at VARCHAR(30) NOT NULL DEFAULT '',
    delivered_at VARCHAR(30) NOT NULL DEFAULT '',
    PRIMARY KEY (shipment_id),
    UNIQUE KEY uq_shipments_order (order_id),
    UNIQUE KEY uq_shipments_tracking (tracking_code),
    CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS reviews (
    review_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    order_item_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    moderated_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id),
    UNIQUE KEY uq_reviews_order_item (order_item_id),
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_moderator FOREIGN KEY (moderated_by) REFERENCES users(user_id),
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_reviews_status CHECK (status IN ('Pending', 'Approved', 'Rejected'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS refund_requests (
    refund_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    reason TEXT NOT NULL,
    amount INT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    handled_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    evidence_url VARCHAR(1000) NOT NULL DEFAULT '',
    rejection_reason VARCHAR(500) NOT NULL DEFAULT '',
    gateway_reference VARCHAR(180) NOT NULL DEFAULT '',
    PRIMARY KEY (refund_id),
    UNIQUE KEY uq_refunds_order (order_id),
    CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_refunds_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_refunds_handler FOREIGN KEY (handled_by) REFERENCES users(user_id),
    CONSTRAINT chk_refunds_status CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS articles (
    article_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    author_id INT UNSIGNED NULL,
    title VARCHAR(240) NOT NULL,
    slug VARCHAR(260) NOT NULL,
    summary TEXT NOT NULL,
    content LONGTEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft',
    published TINYINT(1) NOT NULL DEFAULT 0,
    source_filename VARCHAR(500) NOT NULL DEFAULT '',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    published_at VARCHAR(30) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (article_id),
    UNIQUE KEY uq_articles_slug (slug),
    CONSTRAINT fk_articles_author FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_articles_status CHECK (status IN ('Draft', 'InReview', 'Published', 'Archived')),
    CONSTRAINT chk_articles_published CHECK (published IN (0, 1))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS media_assets (
    media_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    article_id INT UNSIGNED NULL,
    file_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    data_url LONGTEXT NOT NULL,
    checksum CHAR(64) NOT NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (media_id),
    UNIQUE KEY uq_media_article_checksum (article_id, checksum),
    CONSTRAINT fk_media_article FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE,
    CONSTRAINT fk_media_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS article_product_links (
    article_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (article_id, product_id),
    CONSTRAINT fk_article_links_article FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE,
    CONSTRAINT fk_article_links_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id INT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(100) NOT NULL DEFAULT '',
    request_id VARCHAR(100) NOT NULL,
    metadata LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    KEY idx_audit_actor (actor_user_id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS order_status_history (
    history_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id INT UNSIGNED NOT NULL,
    from_status VARCHAR(30) NOT NULL,
    to_status VARCHAR(30) NOT NULL,
    actor_user_id INT UNSIGNED NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'backoffice',
    note VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (history_id),
    KEY idx_order_history_order (order_id, created_at),
    CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS shipment_attempts (
    attempt_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id INT UNSIGNED NOT NULL,
    outcome VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    proof_url VARCHAR(1000) NOT NULL DEFAULT '',
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retry_at VARCHAR(30) NOT NULL DEFAULT '',
    PRIMARY KEY (attempt_id),
    KEY idx_attempts_shipment (shipment_id, attempted_at),
    CONSTRAINT fk_attempts_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    CONSTRAINT chk_attempts_outcome CHECK (outcome IN ('DeliveryFailed', 'Delivered'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
];

const columnMigrations = [
  ['users', 'avatar_url', `MEDIUMTEXT NOT NULL`],
  ['users', 'must_change_password', `TINYINT(1) NOT NULL DEFAULT 0`],
  ['reviews', 'order_item_id', `INT UNSIGNED NULL`],
  ['articles', 'author_id', `INT UNSIGNED NULL`],
  ['articles', 'status', `VARCHAR(20) NOT NULL DEFAULT 'Published'`],
  ['articles', 'source_filename', `VARCHAR(500) NOT NULL DEFAULT ''`],
  ['articles', 'version', `INT UNSIGNED NOT NULL DEFAULT 1`],
  ['articles', 'published_at', `VARCHAR(30) NOT NULL DEFAULT ''`],
  ['articles', 'updated_at', `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`],
];

const migrationStatements = [
  `UPDATE users SET role = 'staff' WHERE role = 'warehouse'`,
  `UPDATE articles SET status = IF(published = 1, 'Published', 'Draft'),
     published_at = IF(published = 1 AND published_at = '', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s'), published_at)`,
];

module.exports = { columnMigrations, migrationStatements, statements };
