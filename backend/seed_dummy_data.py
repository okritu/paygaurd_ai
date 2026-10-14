
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so imports work regardless of working directory
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uuid
from datetime import datetime, timedelta
from database import get_connection

DUMMY_TRANSACTIONS = [
    {
        "step": 1,
        "transaction_type": "PAYMENT",
        "amount": 250.00,
        "oldbalanceOrg": 5000.00,
        "newbalanceOrig": 4750.00,
        "oldbalanceDest": 1200.00,
        "newbalanceDest": 1450.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 1.20,
        "risk_score": 1.20,
        "risk_level": "LOW",
        "days_ago": 7,
    },
    {
        "step": 5,
        "transaction_type": "CASH_OUT",
        "amount": 185000.00,
        "oldbalanceOrg": 185000.00,
        "newbalanceOrig": 0.00,
        "oldbalanceDest": 0.00,
        "newbalanceDest": 185000.00,
        "prediction": "FRAUD",
        "fraud_probability": 94.50,
        "risk_score": 94.50,
        "risk_level": "HIGH",
        "days_ago": 6,
    },
    {
        "step": 12,
        "transaction_type": "TRANSFER",
        "amount": 42000.00,
        "oldbalanceOrg": 50000.00,
        "newbalanceOrig": 8000.00,
        "oldbalanceDest": 10000.00,
        "newbalanceDest": 52000.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 45.30,
        "risk_score": 45.30,
        "risk_level": "MEDIUM",
        "days_ago": 5,
    },
    {
        "step": 18,
        "transaction_type": "PAYMENT",
        "amount": 1250.00,
        "oldbalanceOrg": 8000.00,
        "newbalanceOrig": 6750.00,
        "oldbalanceDest": 3400.00,
        "newbalanceDest": 4650.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 2.10,
        "risk_score": 2.10,
        "risk_level": "LOW",
        "days_ago": 4,
    },
    {
        "step": 24,
        "transaction_type": "TRANSFER",
        "amount": 310000.00,
        "oldbalanceOrg": 310000.00,
        "newbalanceOrig": 0.00,
        "oldbalanceDest": 500.00,
        "newbalanceDest": 310500.00,
        "prediction": "FRAUD",
        "fraud_probability": 97.80,
        "risk_score": 97.80,
        "risk_level": "HIGH",
        "days_ago": 3,
    },
    {
        "step": 30,
        "transaction_type": "CASH_IN",
        "amount": 15000.00,
        "oldbalanceOrg": 6750.00,
        "newbalanceOrig": 21750.00,
        "oldbalanceDest": 50000.00,
        "newbalanceDest": 35000.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 0.50,
        "risk_score": 0.50,
        "risk_level": "LOW",
        "days_ago": 3,
    },
    {
        "step": 36,
        "transaction_type": "DEBIT",
        "amount": 4500.00,
        "oldbalanceOrg": 21750.00,
        "newbalanceOrig": 17250.00,
        "oldbalanceDest": 12000.00,
        "newbalanceDest": 16500.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 4.20,
        "risk_score": 4.20,
        "risk_level": "LOW",
        "days_ago": 2,
    },
    {
        "step": 42,
        "transaction_type": "CASH_OUT",
        "amount": 240000.00,
        "oldbalanceOrg": 240000.00,
        "newbalanceOrig": 0.00,
        "oldbalanceDest": 2000.00,
        "newbalanceDest": 242000.00,
        "prediction": "FRAUD",
        "fraud_probability": 98.90,
        "risk_score": 98.90,
        "risk_level": "HIGH",
        "days_ago": 2,
    },
    {
        "step": 48,
        "transaction_type": "PAYMENT",
        "amount": 890.00,
        "oldbalanceOrg": 17250.00,
        "newbalanceOrig": 16360.00,
        "oldbalanceDest": 4650.00,
        "newbalanceDest": 5540.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 1.10,
        "risk_score": 1.10,
        "risk_level": "LOW",
        "days_ago": 1,
    },
    {
        "step": 52,
        "transaction_type": "TRANSFER",
        "amount": 68000.00,
        "oldbalanceOrg": 100000.00,
        "newbalanceOrig": 32000.00,
        "oldbalanceDest": 15000.00,
        "newbalanceDest": 83000.00,
        "prediction": "NOT FRAUD",
        "fraud_probability": 48.90,
        "risk_score": 48.90,
        "risk_level": "MEDIUM",
        "days_ago": 0,
    }
]

def seed_data(user_id=1):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # 1. Update existing null user_id transactions to assigned user_id
        cursor.execute("UPDATE transactions SET user_id = %s WHERE user_id IS NULL", (user_id,))
        updated_rows = cursor.rowcount

        # 2. Check current count for this user
        cursor.execute("SELECT COUNT(*) as cnt FROM transactions WHERE user_id = %s", (user_id,))
        count = cursor.fetchone()["cnt"]

        inserted = 0
        now = datetime.now()
        for idx, tx in enumerate(DUMMY_TRANSACTIONS):
            tx_id = f"PG-DEMO-{(idx + 1):03d}"
            # Check if this tx_id exists
            cursor.execute("SELECT id FROM transactions WHERE transaction_id = %s", (tx_id,))
            if cursor.fetchone():
                continue

            ts = (now - timedelta(days=tx["days_ago"], hours=idx*2)).strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute(
                """
                INSERT INTO transactions
                (
                    transaction_id,
                    timestamp,
                    step,
                    transaction_type,
                    amount,
                    oldbalanceOrg,
                    newbalanceOrig,
                    oldbalanceDest,
                    newbalanceDest,
                    prediction,
                    fraud_probability,
                    risk_score,
                    risk_level,
                    user_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    tx_id,
                    ts,
                    tx["step"],
                    tx["transaction_type"],
                    tx["amount"],
                    tx["oldbalanceOrg"],
                    tx["newbalanceOrig"],
                    tx["oldbalanceDest"],
                    tx["newbalanceDest"],
                    tx["prediction"],
                    tx["fraud_probability"],
                    tx["risk_score"],
                    tx["risk_level"],
                    user_id
                )
            )
            inserted += 1

        connection.commit()
        print(f"Seed complete. Updated {updated_rows} NULL transactions, inserted {inserted} new dummy transactions.")

    except Exception as e:
        print("Seeding error:", e)
        if connection:
            connection.rollback()
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == "__main__":
    user_id_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    seed_data(user_id_arg)
