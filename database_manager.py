import mysql.connector
from mysql.connector import Error
import pandas as pd
import os

#  CREDENTIALS FOR YOUR LOCAL SETUP
db_config = {
    'host': 'localhost',
    'user': 'root',       # Usually 'root' for local dev
    'password': 'password', # Your MySQL password
    'database': 'visiting_cards_db'
}

def create_database_and_table():
    """Initializes the database and table on startup."""
    try:
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password']
        )
        cursor = conn.cursor()
        
        # Create DB
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")
        conn.database = db_config['database']
        
        # Create Table matching your React state structure
        create_table_query = """
        CREATE TABLE IF NOT EXISTS cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_name VARCHAR(255),
            company_name VARCHAR(255),
            emails TEXT,
            phone_numbers TEXT,
            address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        cursor.execute(create_table_query)
        conn.commit()
        print("Database and table verified/created.")
    except Error as e:
        print(f"Error initializing database: {e}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# Run initialization when the file loads
create_database_and_table()

def save_to_mysql(result_json):
    """Inserts the extracted card data into the MySQL table."""
    try:
        print("DEBUG: save_to_mysql CALLED with:", result_json)

        # Ensure emails and phones are strings, not lists, before saving
        emails = ", ".join(result_json.get("emails", [])) if isinstance(result_json.get("emails"), list) else result_json.get("emails", "")
        phones = ", ".join(result_json.get("phone_numbers", [])) if isinstance(result_json.get("phone_numbers"), list) else result_json.get("phone_numbers", "")

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        insert_query = """
        INSERT INTO cards (owner_name, company_name, emails, phone_numbers, address)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        data_tuple = (
            result_json.get("primary_owner", ""),
            result_json.get("primary_company", ""),
            emails,
            phones,
            result_json.get("address", "")
        )

        cursor.execute(insert_query, data_tuple)
        conn.commit()
        print("Data successfully committed to MySQL.")
        return True

    except Error as e:
        print(f"MySQL Insert Error: {e}")
        return False
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

def get_all_cards():
    """Fetches all saved cards from the MySQL database."""
    try:
        conn = mysql.connector.connect(**db_config)
        # dictionary=True makes it return JSON-friendly objects instead of raw tuples
        cursor = conn.cursor(dictionary=True) 
        
        cursor.execute("SELECT * FROM cards ORDER BY created_at DESC")
        records = cursor.fetchall()
        return records
    except Error as e:
        print(f"Error fetching data: {e}")
        return []
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
# function to delete particular card 
def delete_card_from_db(card_id):
    """Deletes a specific card from the MySQL database by ID."""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM cards WHERE id = %s", (card_id,))
        conn.commit()
        
        return True
    except Error as e:
        print(f"Error deleting card: {e}")
        return False
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

def export_full_database(file_path="data/samples/full_database_export.csv"): # Change to a folder that already exists
    """Fetches all records and saves them to a CSV file."""
    try:
        conn = mysql.connector.connect(**db_config)
        query = "SELECT owner_name, company_name, emails, phone_numbers, address, created_at FROM cards"
        df = pd.read_sql(query, conn)
        
        # This part is critical: Ensure the directory exists
        folder = os.path.dirname(file_path)
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
        
        # Save to CSV
        df.to_csv(file_path, index=False)
        print(f"File created successfully at: {os.path.abspath(file_path)}")
        return os.path.abspath(file_path) # Return absolute path to avoid FastAPI confusion
    except Exception as e:
        print(f"Error exporting database: {e}")
        return None
    finally:
        if 'conn' in locals() and conn.is_connected():
            conn.close()