
import os
from pathlib import Path
import mysql.connector
from dotenv import load_dotenv

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Load MySQL settings from .env file (try backend/.env, project root .env, and cwd)
load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

def get_connection():
    connection = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE", "payguard_ai")
    )
    return connection


# Test the database connection
if __name__ == "__main__":
    try:
        connection = get_connection()

        if connection.is_connected():
            print("MySQL connection successful!")
            print("Database: payguard_ai")

        connection.close()

    except mysql.connector.Error as error:
        print("MySQL connection failed.")
        print("Error:", error)