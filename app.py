from fastapi import FastAPI, UploadFile, File, Body # Added Body here
from fastapi.responses import FileResponse          # Added FileResponse here
from ocr.reader import extract_raw_text
import os
import shutil
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

# cross-origin resource sharing 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Card reader API is running"}

@app.post("/extract")
async def upload_card(file: UploadFile = File(...)):
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
async def save_data(payload: dict = Body(...)):
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
async def fetch_cards():
    """Returns all saved cards to the frontend."""
    from database_manager import get_all_cards
    cards = get_all_cards()
    return {"status": "success", "data": cards}

@app.delete("/cards/{card_id}")
async def delete_card(card_id: int):
    """Receives a delete request from React and removes the card."""
    from database_manager import delete_card_from_db
    success = delete_card_from_db(card_id)
    
    if success:
        return {"status": "success", "message": "Card deleted successfully"}
    return {"status": "error", "message": "Failed to delete card"}

@app.get("/download-all")
async def download_all_cards():
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
   