const test = require('node:test');
const assert = require('node:assert/strict');
const { columnMigrations, migrationStatements } = require('../mysql-schema');

// Hồi quy cho lỗi 1.6.0: database MySQL cũ có avatar_url NOT NULL nhưng không
// có default, khiến mọi câu lệnh tạo tài khoản bỏ qua cột này đều thất bại.
test('MySQL user migration provides a safe default for avatar_url', () => {
  const avatarColumn = columnMigrations.find(
    ([table, column]) => table === 'users' && column === 'avatar_url',
  );
  assert.ok(avatarColumn, 'avatar_url phải nằm trong danh sách migration');
  assert.match(avatarColumn[2], /DEFAULT\s*\(?'\s*'\)?/i);
  assert.ok(
    migrationStatements.some((sql) => (
      /ALTER TABLE users/i.test(sql)
      && /avatar_url/i.test(sql)
      && /DEFAULT/i.test(sql)
    )),
    'database hiện hữu phải được chuẩn hóa default của avatar_url',
  );
});
