const crypto = require('node:crypto');

// Băm mật khẩu bằng scrypt và salt ngẫu nhiên; database không lưu mật khẩu gốc.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function signToken(payload, secret, expiresInSeconds = 60 * 60 * 12) {
  // Token có thời hạn và chữ ký HMAC để phát hiện dữ liệu bị sửa.
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  let provided;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

module.exports = {
  escapeXml,
  hashPassword,
  isStrongPassword,
  normalizeEmail,
  signToken,
  verifyPassword,
  verifyToken,
};
