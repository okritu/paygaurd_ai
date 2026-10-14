USE payguard_ai;

DESCRIBE users;
DESCRIBE transactions;
USE payguard_ai;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE transactions
ADD COLUMN user_id INT NULL;
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_user
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE SET NULL;
CREATE INDEX idx_transactions_user_id
ON transactions(user_id);
DESCRIBE users;
SELECT id, name, email, created_at
FROM users;
SELECT transaction_id, transaction_type, amount,
       prediction, fraud_probability, risk_level, user_id
FROM transactions
ORDER BY id DESC
LIMIT 5;

DESCRIBE transactions;