import os
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

import shutil
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, Body, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ocr.reader import extract_raw_text
from database_manager import (
    create_user,
    get_user_by_username,
    get_user_by_email,
    get_pending_users,
    verify_user_in_db
)

# Auth configurations
SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey_change_in_production_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

security = HTTPBearer()

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)

class LoginRequest(BaseModel):
    username: str
    password: str

class VerifyUserRequest(BaseModel):
    username: str
    otp: str

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin privilege required"
        )
    return current_user

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "pulkitpulkitarr@gmail.com")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "pulkitpulkitarr@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def send_otp_to_admin(username: str, email: str, otp: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("SMTP_EMAIL or SMTP_PASSWORD is not set in environment variables.")
        return False
    
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_EMAIL
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = f"Accosoft OTP Verification - Approval required for user '{username}'"
        
        body = f"""Hello Admin,

A new user has registered on the Accosoft Solution Card Reader system and requires your approval.

User details:
- Username: {username}
- Email: {email}

Please log in to the admin panel and enter the following verification code to approve their account:

Verification Code (OTP): {otp}

Regards,
Accosoft Card Reader Team
"""
        msg.attach(MIMEText(body, "plain"))
        
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, ADMIN_EMAIL, msg.as_string())
        return True
    except Exception as e:
        print(f"Failed to send email to admin: {e}")
        return False

app = FastAPI()

# cross-origin resource sharing 
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Card reader API is running"}

@app.post("/signup")
async def signup(data: SignupRequest):
    # Check if username exists
    if get_user_by_username(data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")
    # Check if email exists
    if get_user_by_email(data.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")
        
    hashed = hash_password(data.password)
    otp = f"{random.randint(100000, 999999)}"
    
    success = create_user(data.username, data.email, hashed, otp)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user account")
        
    # Send OTP to admin
    email_sent = send_otp_to_admin(data.username, data.email, otp)
    if not email_sent:
        # Fallback for local testing/development: print to server console
        print("\n" + "="*80)
        print(f"DEVELOPER FALLBACK: EMAIL SENDING FAILED FOR USER '{data.username}'")
        print(f"VERIFICATION OTP IS: {otp}")
        print("="*80 + "\n")
        
        return {
            "status": "success", 
            "message": "Registration submitted! (Note: Email failed to send, but account was created. Check server console for verification OTP.)"
        }
        
    return {"status": "success", "message": "Registration submitted! Please ask your administrator to verify your account."}

@app.post("/login")
async def login(data: LoginRequest):
    # Allow login by username or email
    user = get_user_by_username(data.username)
    if not user and "@" in data.username:
        user = get_user_by_email(data.username)
        
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username/email or password")
        
    # Check if user is verified (admins are always verified or bypass)
    if not user.get("is_verified") and user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account is pending administrator approval."
        )
        
    token = create_access_token({
        "sub": user["username"],
        "email": user["email"],
        "role": user.get("role", "user")
    })
    
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "email": user["email"],
            "role": user.get("role", "user")
        }
    }

@app.post("/extract")
async def upload_card(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # ensure directory exists
    os.makedirs("data/samples", exist_ok=True)
    
    # save the file first 
    temp_path = f"data/samples/{file.filename}"
    with open(temp_path , "wb") as buffer:
        shutil.copyfileobj(file.file , buffer)
        
    # extract text from image 
    data = extract_raw_text(temp_path)

    # return json results for frontend to review/edit
    return {
        "filename": file.filename,
        "status": "success",
        "data": data
    }

# save to excel endpoint 
@app.post("/save")
async def save_data(payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """
    Receives edited data from React and saves to Excel.
    """
    try:
        from database_manager import save_to_mysql
        # The payload contains the edited data from your React form
        success = save_to_mysql(payload)
        
        if success:
            return {"status": "success", "message": "Data saved to DataBase"}
        else:
            return {"status": "error", "message": "Failed to write to Database"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/cards")
async def fetch_cards(current_user: dict = Depends(require_admin)):
    """Returns all saved cards to the frontend."""
    from database_manager import get_all_cards
    cards = get_all_cards()
    return {"status": "success", "data": cards}

@app.delete("/cards/{card_id}")
async def delete_card(card_id: int, current_user: dict = Depends(require_admin)):
    """Receives a delete request from React and removes the card."""
    from database_manager import delete_card_from_db
    success = delete_card_from_db(card_id)
    
    if success:
        return {"status": "success", "message": "Card deleted successfully"}
    return {"status": "error", "message": "Failed to delete card"}

@app.get("/download-all")
async def download_all_cards(current_user: dict = Depends(require_admin)):
    """Generates a full export and returns the file."""
    from database_manager import export_full_database
    file_path = export_full_database()
    
    if file_path and os.path.exists(file_path):
        return FileResponse(
            path=file_path, 
            filename="all_business_cards.csv",
            media_type="text/csv"
        )
    else:
        # Debugging: Print why it failed
        print(f"Download failed. File path was: {file_path}")
        return {"status": "error", "message": "File not found on server."}

@app.get("/admin/pending-users")
async def list_pending_users(current_user: dict = Depends(require_admin)):
    """Returns all pending users to the admin."""
    users = get_pending_users()
    return {"status": "success", "data": users}

@app.post("/admin/verify-user")
async def verify_pending_user(payload: VerifyUserRequest, current_user: dict = Depends(require_admin)):
    """Verifies a pending user with their OTP."""
    success = verify_user_in_db(payload.username, payload.otp)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP or user is already verified"
        )
    return {"status": "success", "message": f"User '{payload.username}' has been successfully verified."}
   