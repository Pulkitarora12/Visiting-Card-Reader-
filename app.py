import os
import shutil
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, Body, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ocr.reader import extract_raw_text
from database_manager import create_user, get_user_by_username, get_user_by_email

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
    success = create_user(data.username, data.email, hashed)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user account")
        
    return {"status": "success", "message": "User registered successfully"}

@app.post("/login")
async def login(data: LoginRequest):
    # Allow login by username or email
    user = get_user_by_username(data.username)
    if not user and "@" in data.username:
        user = get_user_by_email(data.username)
        
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username/email or password")
        
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
   