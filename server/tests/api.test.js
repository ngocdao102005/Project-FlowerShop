const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../server');

let application;
let baseUrl;

before(async () => {
  application = await startServer({
    port: 0,
    databasePath: ':memory:',
    secret: 'test-secret-with-enough-entropy',
    partnerApiKey: 'partner-test-key',
  });
  baseUrl = `http://127.0.0.1:${application.port}/api`;
});

after(async () => {
  await application.stop();
});

async function call(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = response.status === 204
    ? null
    : contentType.includes('json')
      ? await response.json()
      : await response.text();
  return { response, payload };
}

async function login(email, password) {
  const result = await call('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(result.response.status, 200);
  return result.payload;
}

test('health check and catalog search return seeded data', async () => {
  const health = await call('/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.status, 'healthy');

  const catalog = await call('/products?q=hồng&sort=price_asc');
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.payload.items.length >= 1);
  assert.ok(catalog.payload.items.every((item) => item.active === 1));

  const injectionAttempt = await call(`/products?q=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(injectionAttempt.response.status, 200);
  assert.equal(injectionAttempt.payload.items.length, 0);
});

test('registration validates passwords and stores authenticated profile', async () => {
  const weak = await call('/auth/register', {
    method: 'POST',
    body: {
      email: 'new@example.com',
      password: 'weak',
      full_name: 'Khách Mới',
    },
  });
  assert.equal(weak.response.status, 400);

  const registered = await call('/auth/register', {
    method: 'POST',
    body: {
      email: 'new@example.com',
      password: 'Strong123',
      full_name: 'Khách Mới',
      phone_number: '0911222333',
      address: '10 Đường Hoa, TP.HCM',
    },
  });
  assert.equal(registered.response.status, 201);
  assert.ok(registered.payload.token);
  assert.equal(registered.payload.user.email, 'new@example.com');
  assert.equal(Object.hasOwn(registered.payload.user, 'password_hash'), false);

  const me = await call('/me', { token: registered.payload.token });
  assert.equal(me.response.status, 200);
  assert.equal(me.payload.user.full_name, 'Khách Mới');
});

test('checkout recalculates price, enforces idempotency, and restores stock on cancellation', async () => {
  const session = await login('new@example.com', 'Strong123');
  const catalog = await call('/products?limit=1');
  const product = catalog.payload.items[0];
  const beforeStock = product.stock_quantity;

  const cart = await call('/cart', {
    method: 'POST',
    token: session.token,
    body: { product_id: product.product_id, quantity: 2 },
  });
  assert.equal(cart.response.status, 201);

  const body = {
    customer_name: 'Khách Mới',
    customer_phone: '0911222333',
    shipping_address: '10 Đường Hoa, TP.HCM',
    payment_method: 'CARD',
    gift_wrap: true,
    idempotency_key: 'checkout-test-001',
    items: [{ product_id: product.product_id, quantity: 2, price: 1 }],
  };
  const orderResult = await call('/orders', {
    method: 'POST',
    token: session.token,
    headers: { 'Idempotency-Key': 'checkout-test-001' },
    body,
  });
  assert.equal(orderResult.response.status, 201);
  assert.equal(orderResult.payload.order.total_amount, product.price * 2 + 50000);
  assert.equal(orderResult.payload.order.payment_status, 'Paid');

  const duplicate = await call('/orders', {
    method: 'POST',
    token: session.token,
    headers: { 'Idempotency-Key': 'checkout-test-001' },
    body,
  });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.payload.duplicate, true);
  assert.equal(duplicate.payload.order.order_id, orderResult.payload.order.order_id);

  const afterCheckout = await call(`/products/${product.product_id}`);
  assert.equal(afterCheckout.payload.item.stock_quantity, beforeStock - 2);

  const cancelled = await call(`/orders/${orderResult.payload.order.order_id}/cancel`, {
    method: 'POST',
    token: session.token,
    body: { reason: 'Thay đổi ngày nhận hoa' },
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.payload.order.status, 'Cancelled');
  assert.equal(cancelled.payload.order.payment_status, 'Refunded');

  const afterCancel = await call(`/products/${product.product_id}`);
  assert.equal(afterCancel.payload.item.stock_quantity, beforeStock);
});

test('role-based admin operations and review moderation work end to end', async () => {
  const customer = await login('lan@flowery.vn', 'Customer@123');
  const forbidden = await call('/admin/users', { token: customer.token });
  assert.equal(forbidden.response.status, 403);
  const forbiddenStockUpdate = await call('/admin/products/1/stock', {
    method: 'PATCH',
    token: customer.token,
    body: { stock_quantity: 20 },
  });
  assert.equal(forbiddenStockUpdate.response.status, 403);

  const review = await call('/products/1/reviews', {
    method: 'POST',
    token: customer.token,
    body: { rating: 5, comment: 'Hoa tươi, giao đúng giờ và đóng gói rất đẹp.' },
  });
  assert.equal(review.response.status, 201);

  const admin = await login('admin@flowery.vn', 'Admin@123');
  const createdCategory = await call('/admin/categories', {
    method: 'POST',
    token: admin.token,
    body: {
      name: 'Danh mục CRUD Test',
      slug: 'danh-muc-crud-test',
      description: 'Danh mục dùng để kiểm thử Windows App.',
    },
  });
  assert.equal(createdCategory.response.status, 201);
  assert.equal(createdCategory.payload.item.name, 'Danh mục CRUD Test');
  assert.equal(createdCategory.payload.item.product_count, 0);

  const categoryId = createdCategory.payload.item.category_id;
  const updatedCategory = await call(`/admin/categories/${categoryId}`, {
    method: 'PUT',
    token: admin.token,
    body: {
      name: 'Danh mục CRUD Đã Sửa',
      description: 'Nội dung đã cập nhật.',
    },
  });
  assert.equal(updatedCategory.response.status, 200);
  assert.equal(updatedCategory.payload.item.name, 'Danh mục CRUD Đã Sửa');

  const archivedCategory = await call(`/admin/categories/${categoryId}`, {
    method: 'DELETE',
    token: admin.token,
  });
  assert.equal(archivedCategory.response.status, 200);
  assert.equal(archivedCategory.payload.item.active, 0);

  const reactivatedCategory = await call(`/admin/categories/${categoryId}`, {
    method: 'PUT',
    token: admin.token,
    body: { active: true },
  });
  assert.equal(reactivatedCategory.response.status, 200);
  assert.equal(reactivatedCategory.payload.item.active, 1);

  const archivedAgain = await call(`/admin/categories/${categoryId}`, {
    method: 'DELETE',
    token: admin.token,
  });
  assert.equal(archivedAgain.response.status, 200);
  assert.equal(archivedAgain.payload.item.active, 0);

  const protectedCategory = await call('/admin/categories/1', {
    method: 'DELETE',
    token: admin.token,
  });
  assert.equal(protectedCategory.response.status, 409);

  const createdProduct = await call('/admin/products', {
    method: 'POST',
    token: admin.token,
    body: {
      category_id: 1,
      name: 'Hoa CRUD Test',
      slug: 'hoa-crud-test',
      price: 420000,
      description: 'Sản phẩm dùng để kiểm thử CRUD từ Windows App.',
      image_url: '',
      occasion: 'Chúc mừng',
      flower_type: 'Hoa hồng',
      color: 'Đỏ',
      stock_quantity: 12,
      active: true,
      editorial_review: 'Nội dung kiểm thử.',
    },
  });
  assert.equal(createdProduct.response.status, 201);
  assert.equal(createdProduct.payload.item.name, 'Hoa CRUD Test');

  const productId = createdProduct.payload.item.product_id;
  const updatedProduct = await call(`/admin/products/${productId}`, {
    method: 'PUT',
    token: admin.token,
    body: {
      name: 'Hoa CRUD Đã Sửa',
      price: 450000,
    },
  });
  assert.equal(updatedProduct.response.status, 200);
  assert.equal(updatedProduct.payload.item.name, 'Hoa CRUD Đã Sửa');
  assert.equal(updatedProduct.payload.item.stock_quantity, 12);

  const archivedProduct = await call(`/admin/products/${productId}`, {
    method: 'DELETE',
    token: admin.token,
  });
  assert.equal(archivedProduct.response.status, 200);
  assert.equal(archivedProduct.payload.success, true);

  const adminProducts = await call('/admin/products', { token: admin.token });
  const productAfterArchive = adminProducts.payload.items.find(
    (item) => item.product_id === productId,
  );
  assert.equal(productAfterArchive.active, 0);

  const productBeforeStockUpdate = await call('/products/1');
  const nextStock = productBeforeStockUpdate.payload.item.stock_quantity + 3;
  const stockUpdate = await call('/admin/products/1/stock', {
    method: 'PATCH',
    token: admin.token,
    body: { stock_quantity: nextStock },
  });
  assert.equal(stockUpdate.response.status, 200);
  assert.equal(stockUpdate.payload.item.stock_quantity, nextStock);

  const invalidStockUpdate = await call('/admin/products/1/stock', {
    method: 'PATCH',
    token: admin.token,
    body: { stock_quantity: -1 },
  });
  assert.equal(invalidStockUpdate.response.status, 400);

  const reviews = await call('/admin/reviews', { token: admin.token });
  assert.equal(reviews.response.status, 200);
  const pending = reviews.payload.items.find((item) => item.status === 'Pending');
  assert.ok(pending);

  const approved = await call(`/admin/reviews/${pending.review_id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { status: 'Approved' },
  });
  assert.equal(approved.response.status, 200);

  const product = await call('/products/1');
  assert.equal(product.response.status, 200);
  assert.ok(product.payload.reviews.some((item) => item.review_id === pending.review_id));

  const stats = await call('/admin/stats', { token: admin.token });
  assert.equal(stats.response.status, 200);
  assert.ok(stats.payload.stats.customers >= 2);
});

test('partner catalog is protected and exports valid XML', async () => {
  const unauthorized = await call('/partner/catalog.xml');
  assert.equal(unauthorized.response.status, 401);

  const authorized = await call('/partner/catalog.xml', {
    headers: { 'X-API-Key': 'partner-test-key' },
  });
  assert.equal(authorized.response.status, 200);
  assert.match(authorized.payload, /^<\?xml version="1\.0"/);
  assert.match(authorized.payload, /<catalog version="1\.0"/);
  assert.match(authorized.payload, /<product id="1">/);
});

test('warehouse, carrier and refund workflows enforce the documented state transitions', async () => {
  const admin = await login('admin@flowery.vn', 'Admin@123');
  const identities = [
    ['workflow-customer@example.com', 'Khách Workflow', 'customer'],
    ['workflow-warehouse@example.com', 'Kho Workflow', 'warehouse'],
    ['workflow-support@example.com', 'CSKH Workflow', 'staff'],
  ];

  const users = {};
  for (const [email, fullName, role] of identities) {
    const registered = await call('/auth/register', {
      method: 'POST',
      body: { email, password: 'Strong123', full_name: fullName },
    });
    assert.equal(registered.response.status, 201);
    users[role] = registered.payload.user;
    if (role !== 'customer') {
      const promoted = await call(`/admin/users/${registered.payload.user.user_id}`, {
        method: 'PATCH',
        token: admin.token,
        body: { role },
      });
      assert.equal(promoted.response.status, 200);
    }
  }

  const customer = await login('workflow-customer@example.com', 'Strong123');
  const warehouse = await login('workflow-warehouse@example.com', 'Strong123');
  const support = await login('workflow-support@example.com', 'Strong123');
  const catalog = await call('/products?limit=1');
  const product = catalog.payload.items[0];
  const checkout = await call('/orders', {
    method: 'POST',
    token: customer.token,
    headers: { 'Idempotency-Key': 'workflow-order-001' },
    body: {
      customer_name: 'Khách Workflow',
      customer_phone: '0909000111',
      shipping_address: '19 Đường Hoa, TP.HCM',
      payment_method: 'CARD',
      gift_wrap: false,
      items: [{ product_id: product.product_id, quantity: 1 }],
    },
  });
  assert.equal(checkout.response.status, 201);
  const orderId = checkout.payload.order.order_id;

  const staffCannotOperateWarehouse = await call(`/admin/orders/${orderId}`, {
    method: 'PATCH',
    token: support.token,
    body: { status: 'Preparing' },
  });
  assert.equal(staffCannotOperateWarehouse.response.status, 403);

  const invalidJump = await call(`/admin/orders/${orderId}`, {
    method: 'PATCH',
    token: warehouse.token,
    body: { status: 'Delivered' },
  });
  assert.equal(invalidJump.response.status, 409);

  const preparing = await call(`/admin/orders/${orderId}`, {
    method: 'PATCH',
    token: warehouse.token,
    body: { status: 'Preparing' },
  });
  assert.equal(preparing.response.status, 200);
  assert.equal(preparing.payload.order.status, 'Preparing');

  const missingTracking = await call(`/admin/orders/${orderId}`, {
    method: 'PATCH',
    token: warehouse.token,
    body: { status: 'Shipping' },
  });
  assert.equal(missingTracking.response.status, 400);

  const shipping = await call(`/admin/orders/${orderId}`, {
    method: 'PATCH',
    token: warehouse.token,
    body: { status: 'Shipping', carrier: 'Flowery Express', tracking_code: 'FLW-TEST-001' },
  });
  assert.equal(shipping.response.status, 200);
  assert.equal(shipping.payload.order.status, 'Shipping');

  const failedAttempt = await call('/integrations/shipments/FLW-TEST-001/events', {
    method: 'POST',
    headers: { 'X-API-Key': 'partner-test-key' },
    body: {
      event: 'DeliveryFailed',
      reason: 'Khách hàng chưa thể nhận hoa',
      retry_at: '2026-08-20T09:00:00Z',
    },
  });
  assert.equal(failedAttempt.response.status, 200);
  assert.equal(failedAttempt.payload.order.status, 'Shipping');

  const delivered = await call('/integrations/shipments/FLW-TEST-001/events', {
    method: 'POST',
    headers: { 'X-API-Key': 'partner-test-key' },
    body: { event: 'Delivered', proof_url: 'https://example.com/proof/FLW-TEST-001.jpg' },
  });
  assert.equal(delivered.response.status, 200);
  assert.equal(delivered.payload.order.status, 'Delivered');

  const refund = await call(`/orders/${orderId}/refunds`, {
    method: 'POST',
    token: customer.token,
    body: {
      reason: 'Hoa giao không đúng mẫu đã đặt trong đơn hàng.',
      evidence_url: 'https://example.com/evidence/refund-001.jpg',
    },
  });
  assert.equal(refund.response.status, 201);

  const refundList = await call('/admin/refunds', { token: support.token });
  assert.equal(refundList.response.status, 200);
  const pending = refundList.payload.items.find((item) => item.order_id === orderId);
  assert.ok(pending);

  const approved = await call(`/admin/refunds/${pending.refund_id}`, {
    method: 'PATCH',
    token: support.token,
    body: { status: 'Approved' },
  });
  assert.equal(approved.response.status, 200);

  const completed = await call(`/integrations/refunds/${pending.refund_id}/complete`, {
    method: 'POST',
    headers: { 'X-API-Key': 'partner-test-key' },
    body: { provider_reference: 'PAY-REF-001' },
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.payload.refund.status, 'Completed');
});
