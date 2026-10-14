import os
import sys
from pathlib import Path
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

# Setup directories and python sys.path
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import joblib
import numpy as np
import pandas as pd
import mysql.connector

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel, Field, field_validator


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="PayGaurd AI",
    description="AI-powered financial transaction fraud detection system",
    version="2.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================================================
# DATABASE
# =========================================================

from database import get_connection


# =========================================================
# JWT CONFIGURATION
# =========================================================

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "CHANGE_THIS_SECRET_IN_ENV"
)

JWT_ALGORITHM = "HS256"

TOKEN_EXPIRE_HOURS = 12

security = HTTPBearer()


# =========================================================
# MODEL CONFIGURATION
# =========================================================

def _resolve_model_file(filename: str) -> str:
    candidates = [
        PROJECT_ROOT / "models" / filename,
        BASE_DIR / ".." / "models" / filename,
        Path("models") / filename,
        Path("..") / "models" / filename,
        BASE_DIR / "models" / filename,
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())
    return str(PROJECT_ROOT / "models" / filename)

MODEL_PATH = _resolve_model_file("fraud_detection_model.pkl")
FEATURE_PATH = _resolve_model_file("model_features.pkl")


# =========================================================
# LOAD MACHINE LEARNING MODEL
# =========================================================

try:
    model = joblib.load(MODEL_PATH)
    model_features = joblib.load(FEATURE_PATH)

    MODEL_LOADED = True

    print("Machine learning model loaded successfully.")
    print("Model:", type(model).__name__)
    print("Loaded from:", MODEL_PATH)

except Exception as error:

    model = None
    model_features = []

    MODEL_LOADED = False

    print("WARNING: Model could not be loaded.")
    print("Error:", error)


# =========================================================
# PASSWORD HASHING
# =========================================================

def hash_password(
    password: str,
    salt: Optional[bytes] = None
) -> str:

    if salt is None:
        salt = secrets.token_bytes(16)

    iterations = 210_000

    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations
    )

    return (
        f"pbkdf2_sha256$"
        f"{iterations}$"
        f"{salt.hex()}$"
        f"{derived_key.hex()}"
    )


def verify_password(
    password: str,
    stored_password: str
) -> bool:

    try:

        algorithm, iterations, salt_hex, stored_hash = (
            stored_password.split("$")
        )

        if algorithm != "pbkdf2_sha256":
            return False

        salt = bytes.fromhex(salt_hex)

        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations)
        )

        return secrets.compare_digest(
            derived_key.hex(),
            stored_hash
        )

    except Exception:

        return False


# =========================================================
# JWT TOKEN
# =========================================================

def create_access_token(user_id: int, email: str):

    expire = datetime.now(timezone.utc) + timedelta(
        hours=TOKEN_EXPIRE_HOURS
    )

    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire
    }

    token = jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )

    return token


# =========================================================
# AUTHENTICATION DEPENDENCY
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = payload.get("sub")

        email = payload.get("email")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token."
            )

        return {
            "id": int(user_id),
            "email": email
        }

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token."
        )


# =========================================================
# PYDANTIC MODELS
# =========================================================

class RegisterInput(BaseModel):

    name: str = Field(
        ...,
        min_length=2,
        max_length=100
    )

    email: str = Field(
        ...,
        min_length=5,
        max_length=150
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=100
    )


class LoginInput(BaseModel):

    email: str = Field(
        ...,
        min_length=5,
        max_length=150
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=100
    )


class TransactionInput(BaseModel):

    step: int = Field(
        ...,
        ge=0
    )

    amount: float = Field(
        ...,
        ge=0
    )

    oldbalanceOrg: float = Field(
        ...,
        ge=0
    )

    newbalanceOrig: float = Field(
        ...,
        ge=0
    )

    oldbalanceDest: float = Field(
        ...,
        ge=0
    )

    newbalanceDest: float = Field(
        ...,
        ge=0
    )

    type: str

    @field_validator("type")
    @classmethod
    def validate_transaction_type(cls, value):

        allowed_types = [
            "CASH_IN",
            "CASH_OUT",
            "DEBIT",
            "PAYMENT",
            "TRANSFER"
        ]

        value = value.upper()

        if value not in allowed_types:

            raise ValueError(
                f"Transaction type must be one of: "
                f"{', '.join(allowed_types)}"
            )

        return value


# =========================================================
# FEATURE ENGINEERING
# =========================================================

def create_features(transaction: TransactionInput):

    amount = transaction.amount

    old_balance_org = transaction.oldbalanceOrg

    new_balance_orig = transaction.newbalanceOrig

    old_balance_dest = transaction.oldbalanceDest

    new_balance_dest = transaction.newbalanceDest

    # -----------------------------------------
    # Hour
    # -----------------------------------------

    hour = transaction.step % 24

    # -----------------------------------------
    # Night transaction
    # -----------------------------------------

    is_night = 1 if hour < 6 or hour >= 22 else 0

    # -----------------------------------------
    # Balance changes
    # -----------------------------------------

    balance_change_orig = (
        old_balance_org - new_balance_orig
    )

    balance_change_dest = (
        new_balance_dest - old_balance_dest
    )

    # -----------------------------------------
    # Balance errors
    # -----------------------------------------

    orig_balance_error = abs(
        old_balance_org
        - amount
        - new_balance_orig
    )

    # -----------------------------------------
    # Large transaction
    # -----------------------------------------

    is_large_amount = (
        1 if amount >= 100000 else 0
    )

    # -----------------------------------------
    # Log amount
    # -----------------------------------------

    log_amount = np.log1p(amount)

    # -----------------------------------------
    # Transaction type encoding
    # -----------------------------------------

    type_cash_out = (
        1 if transaction.type == "CASH_OUT"
        else 0
    )

    type_debit = (
        1 if transaction.type == "DEBIT"
        else 0
    )

    type_payment = (
        1 if transaction.type == "PAYMENT"
        else 0
    )

    type_transfer = (
        1 if transaction.type == "TRANSFER"
        else 0
    )

    # -----------------------------------------
    # Feature dictionary
    # -----------------------------------------

    features = {
        "step": transaction.step,

        "amount": amount,

        "oldbalanceOrg": old_balance_org,

        "newbalanceOrig": new_balance_orig,

        "oldbalanceDest": old_balance_dest,

        "newbalanceDest": new_balance_dest,

        "hour": hour,

        "is_night": is_night,

        "balance_change_orig": balance_change_orig,

        "balance_change_dest": balance_change_dest,

        "orig_balance_error": orig_balance_error,

        "is_large_amount": is_large_amount,

        "log_amount": log_amount,

        "type_CASH_OUT": type_cash_out,

        "type_DEBIT": type_debit,

        "type_PAYMENT": type_payment,

        "type_TRANSFER": type_transfer
    }

    dataframe = pd.DataFrame(
        [features]
    )

    # Ensure exact feature order
    if model_features:

        dataframe = dataframe.reindex(
            columns=model_features,
            fill_value=0
        )

    return dataframe


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "message": "PayGaurd AI API is running",
        "version": "2.0.0",
        "model_loaded": MODEL_LOADED,
        "authentication": True
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():

    database_status = False

    try:

        connection = get_connection()

        if connection.is_connected():

            database_status = True

        connection.close()

    except Exception:

        database_status = False

    return {
        "status": "healthy",
        "model_loaded": MODEL_LOADED,
        "model": (
            type(model).__name__
            if model is not None
            else None
        ),
        "database_connected": database_status
    }


# =========================================================
# REGISTER
# =========================================================

@app.post("/auth/register")
def register(user: RegisterInput):

    connection = None
    cursor = None

    try:

        email = user.email.strip().lower()

        name = user.name.strip()

        if not name:

            raise HTTPException(
                status_code=400,
                detail="Name cannot be empty."
            )

        connection = get_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        # Check whether email already exists

        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:

            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists."
            )

        password_hash = hash_password(
            user.password
        )

        cursor.execute(
            """
            INSERT INTO users
            (
                name,
                email,
                password_hash
            )
            VALUES
            (
                %s,
                %s,
                %s
            )
            """,
            (
                name,
                email,
                password_hash
            )
        )

        connection.commit()

        return {
            "message": "Account created successfully.",
            "email": email
        }

    except HTTPException:

        raise

    except mysql.connector.Error as error:

        if connection:
            connection.rollback()

        print("Registration database error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to create account."
        )

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# =========================================================
# LOGIN
# =========================================================

@app.post("/auth/login")
def login(user: LoginInput):

    connection = None
    cursor = None

    try:

        email = user.email.strip().lower()

        connection = get_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                password_hash
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        database_user = cursor.fetchone()

        if not database_user:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password."
            )

        password_valid = verify_password(
            user.password,
            database_user["password_hash"]
        )

        if not password_valid:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password."
            )

        token = create_access_token(
            database_user["id"],
            database_user["email"]
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": database_user["id"],
                "name": database_user["name"],
                "email": database_user["email"]
            }
        }

    except HTTPException:

        raise

    except mysql.connector.Error as error:

        print("Login database error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to login."
        )

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/auth/me")
def current_user(
    user=Depends(get_current_user)
):

    connection = None
    cursor = None

    try:

        connection = get_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                created_at
            FROM users
            WHERE id = %s
            """,
            (user["id"],)
        )

        database_user = cursor.fetchone()

        if not database_user:

            raise HTTPException(
                status_code=404,
                detail="User not found."
            )

        return {
            "id": database_user["id"],
            "name": database_user["name"],
            "email": database_user["email"],
            "created_at": database_user["created_at"]
        }

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# =========================================================
# PREDICT FRAUD
# =========================================================

@app.post("/predict")
def predict_transaction(
    transaction: TransactionInput,
    user=Depends(get_current_user)
):

    if not MODEL_LOADED or model is None:

        raise HTTPException(
            status_code=500,
            detail="Machine learning model is not available."
        )

    try:

        # -----------------------------------------
        # Create ML features
        # -----------------------------------------

        features = create_features(
            transaction
        )

        # -----------------------------------------
        # Prediction
        # -----------------------------------------

        prediction = model.predict(
            features
        )[0]

        # -----------------------------------------
        # Probability
        # -----------------------------------------

        if hasattr(
            model,
            "predict_proba"
        ):

            probabilities = model.predict_proba(
                features
            )[0]

            classes = list(
                model.classes_
            )

            if 1 in classes:

                fraud_index = classes.index(1)

                fraud_probability = float(
                    probabilities[fraud_index]
                )

            else:

                fraud_probability = 0.0

        else:

            fraud_probability = (
                1.0
                if int(prediction) == 1
                else 0.0
            )

        fraud_percentage = round(
            fraud_probability * 100,
            2
        )

        # -----------------------------------------
        # Prediction label
        # -----------------------------------------

        is_fraud = int(prediction) == 1

        prediction_label = (
            "FRAUD"
            if is_fraud
            else "NOT FRAUD"
        )

        # -----------------------------------------
        # Risk level
        # -----------------------------------------

        if fraud_percentage >= 70:

            risk_level = "HIGH"

        elif fraud_percentage >= 40:

            risk_level = "MEDIUM"

        else:

            risk_level = "LOW"

        # -----------------------------------------
        # Risk score
        # -----------------------------------------

        risk_score = fraud_percentage

        # -----------------------------------------
        # Transaction ID
        # -----------------------------------------

        transaction_id = (
            "PG-"
            + uuid.uuid4()
            .hex[:8]
            .upper()
        )

        # -----------------------------------------
        # Timestamp
        # -----------------------------------------

        timestamp = datetime.now(
            timezone.utc
        ).strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        # -----------------------------------------
        # Save transaction
        # -----------------------------------------

        connection = None
        cursor = None

        try:

            connection = get_connection()

            cursor = connection.cursor()

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
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    transaction_id,
                    timestamp,
                    transaction.step,
                    transaction.type,
                    transaction.amount,
                    transaction.oldbalanceOrg,
                    transaction.newbalanceOrig,
                    transaction.oldbalanceDest,
                    transaction.newbalanceDest,
                    prediction_label,
                    fraud_percentage,
                    risk_score,
                    risk_level,
                    user["id"]
                )
            )

            connection.commit()

        except mysql.connector.Error as database_error:

            print(
                "Transaction database error:",
                database_error
            )

            raise HTTPException(
                status_code=500,
                detail="Prediction completed, but transaction could not be saved."
            )

        finally:

            if cursor:
                cursor.close()

            if connection:
                connection.close()

        # -----------------------------------------
        # Response
        # -----------------------------------------

        return {
            "transaction_id": transaction_id,

            "timestamp": timestamp,

            "prediction": prediction_label,

            "is_fraud": is_fraud,

            "fraud_probability": fraud_percentage,

            "risk_score": risk_score,

            "risk_level": risk_level,

            "transaction_type": transaction.type,

            "amount": transaction.amount,

            "model": type(model).__name__
        }

    except HTTPException:

        raise

    except Exception as error:

        print(
            "Prediction error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to process transaction."
        )


# =========================================================
# TRANSACTION HISTORY
# =========================================================

@app.get("/transactions")
def get_transactions(
    user=Depends(get_current_user)
):

    connection = None
    cursor = None

    try:

        connection = get_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                transaction_id,
                timestamp,
                step,
                transaction_type,
                amount,
                prediction,
                fraud_probability,
                risk_score,
                risk_level
            FROM transactions
            WHERE user_id = %s
            ORDER BY id DESC
            LIMIT 100
            """,
            (user["id"],)
        )

        transactions = cursor.fetchall()

        # If user has 0 transactions, auto-seed dummy data for user
        if not transactions:
            try:
                from seed_dummy_data import seed_data
                seed_data(user["id"])
                cursor.execute(
                    """
                    SELECT
                        transaction_id,
                        timestamp,
                        step,
                        transaction_type,
                        amount,
                        prediction,
                        fraud_probability,
                        risk_score,
                        risk_level
                    FROM transactions
                    WHERE user_id = %s
                    ORDER BY id DESC
                    LIMIT 100
                    """,
                    (user["id"],)
                )
                transactions = cursor.fetchall()
            except Exception as seed_err:
                print("Auto seed error:", seed_err)

        for transaction in transactions:

            if transaction.get("timestamp"):

                transaction["timestamp"] = (
                    transaction["timestamp"]
                    .strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )
                    if hasattr(
                        transaction["timestamp"],
                        "strftime"
                    )
                    else str(
                        transaction["timestamp"]
                    )
                )

            if transaction.get("amount") is not None:

                transaction["amount"] = float(
                    transaction["amount"]
                )

            if transaction.get(
                "fraud_probability"
            ) is not None:

                transaction[
                    "fraud_probability"
                ] = float(
                    transaction[
                        "fraud_probability"
                    ]
                )

            if transaction.get(
                "risk_score"
            ) is not None:

                transaction["risk_score"] = float(
                    transaction["risk_score"]
                )

        return {
            "transactions": transactions,
            "count": len(transactions)
        }

    except mysql.connector.Error as error:

        print(
            "Transaction history error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load transaction history."
        )

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# =========================================================
# SEED DUMMY DATA ENDPOINT
# =========================================================

@app.post("/transactions/seed")
def seed_transactions(
    user=Depends(get_current_user)
):
    try:
        from seed_dummy_data import seed_data
        seed_data(user["id"])
        return {"message": "Dummy transactions seeded successfully."}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to seed dummy data: {str(error)}"
        )



# =========================================================
# STARTUP MESSAGE
# =========================================================

@app.on_event("startup")
def startup_event():

    print("=" * 60)
    print("PAYGAURD AI BACKEND")
    print("=" * 60)
    print(
        "Model loaded:",
        MODEL_LOADED
    )
    print(
        "Authentication:",
        "Enabled"
    )
    print(
        "API:",
        "http://127.0.0.1:8000"
    )
    print(
        "Swagger:",
        "http://127.0.0.1:8000/docs"
    )
    print("=" * 60)