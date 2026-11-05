-- 邮件元数据。原文在 R2，对象 key 就是 id。只增不删（smail.pw 同样的结构：每封约 250 字节）。
CREATE TABLE messages (
	id TEXT PRIMARY KEY,
	-- 收件地址的本地部分（@ 前面），统一小写。
	address TEXT NOT NULL,
	from_addr TEXT NOT NULL,
	from_name TEXT NOT NULL,
	subject TEXT NOT NULL,
	received_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_address_time ON messages (address, received_at DESC);
