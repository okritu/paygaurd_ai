CREATE DATABASE payguard_ai;

USE payguard_ai;
SHOW DATABASES;


CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(20) NOT NULL UNIQUE,
    timestamp DATETIME NOT NULL,
    step INT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    oldbalanceOrg DECIMAL(18, 2) NOT NULL,
    newbalanceOrig DECIMAL(18, 2) NOT NULL,
    oldbalanceDest DECIMAL(18, 2) NOT NULL,
    newbalanceDest DECIMAL(18, 2) NOT NULL,
    prediction VARCHAR(20) NOT NULL,
    fraud_probability DECIMAL(6, 2) NOT NULL,
    risk_score DECIMAL(6, 2) NOT NULL,
    risk_level VARCHAR(10) NOT NULL
);
SHOW TABLES;


SELECT *
FROM transactions
ORDER BY id DESC;


SELECT transaction_id, timestamp, transaction_type,
       amount, prediction, fraud_probability, risk_level
FROM transactions
ORDER BY id DESC
LIMIT 10;