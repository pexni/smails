-- 用户的邮箱：GitHub 上已验证的主邮箱（登录时申请 user:email 权限读取）。每次登录都更新。
-- 之前登录的用户这一列是空的，下次登录时补上。
ALTER TABLE users ADD COLUMN email TEXT;
CREATE INDEX idx_users_email ON users (email);
