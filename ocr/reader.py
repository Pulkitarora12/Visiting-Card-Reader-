import pytesseract
from PIL import Image
import re
import cv2
import numpy as np
import spacy
import google.generativeai as genai
import json
import sys
import os
from dotenv import load_dotenv
import platform

load_dotenv()  # load the env file

api_key = os.getenv("GEMINI_API_KEY")

# load the nlp
nlp = spacy.load("en_core_web_sm")

# AI setup
if not api_key:
    print("Error: GEMINI_API_KEY not found in .env file!")
else:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')

#pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# Smart Tesseract Path Handling
if platform.system() == "Windows":
    # Use your local Windows path
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:
    pass

# function order points to arrange all 4 points in order
def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # top-left
    rect[2] = pts[np.argmax(s)]  # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left
    return rect

# function to do four point transform -> flatten to 2D
def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (maxWidth, maxHeight))

def preprocess_for_ocr(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
    return thresh

# image - preprocessing for good ocr
def get_image_variants(card_img):
    variants = []
    gray = cv2.cvtColor(card_img, cv2.COLOR_BGR2GRAY)
    img_scaled = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    # pass1 : standard adaptive threshold
    denoised = cv2.bilateralFilter(img_scaled, 9, 75, 75)
    thresh_std = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    variants.append(thresh_std)
    # Pass 2 : Inverted for dark background cards
    thresh_inv = cv2.bitwise_not(thresh_std)
    variants.append(thresh_inv)
    # Pass 3: Dilation (Thickness of fonts)
    kernel = np.ones((2, 2), np.uint8)
    dilated = cv2.dilate(thresh_std, kernel, iterations=1)
    variants.append(dilated)
    return variants

# canny edge detection, to detect the edges of card
def find_card_contours(image_path):
    img = cv2.imread(image_path)
    # resize
    orig = img.copy()
    ratio = img.shape[0] / 500.0
    img = cv2.resize(img, (int(img.shape[1] / ratio), 500))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # canny edge detection
    edged = cv2.Canny(blurred, 75, 200)
    # make lines and the rectangle polygon
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        # if it has 4 contour points we found card
        if len(approx) == 4:
            return approx.reshape(4, 2) * ratio
    return None

# two helper functions to find owner and company
def clean_name(text):
    text = re.sub(r'\d{3,}', '', text)  # remove phone-like numbers
    text = re.sub(r'[^A-Za-z ]', '', text)  # remove symbols
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def pick_primary_owner(persons, lines):
    # 1️ Highest priority: Prop / Proprietor / Owner lines
    for line in lines:
        low = line.lower()
        if "prop." in low or "proprietor" in low or "owner" in low:
            name = clean_name(line)
            if len(name.split()) >= 2:
                return name
    # 2️ Fallback: spaCy PERSON entities (cleaned)
    clean_persons = []
    for p in persons:
        p_clean = clean_name(p)
        if len(p_clean.split()) >= 2:
            clean_persons.append(p_clean)
    # 3️ Choose longest meaningful name
    return max(clean_persons, key=len, default="")

def pick_primary_company(lines, orgs):
    company_keywords = [
        "sales", "electrical", "electronics", "services",
        "solutions", "repair", "traders", "enterprises",
        "industries", "systems"
    ]
    for line in lines:
        low = line.lower()
        if any(x in low for x in ["floor", "near", "plot", "road", "sector"]):
            continue
        if any(k in low for k in company_keywords):
            return line.strip()
    return orgs[0] if orgs else ""

def extract_raw_text(image_path):
    try:
        original_img = cv2.imread(image_path)
        corners = find_card_contours(image_path)
        if corners is not None:
            card_img = four_point_transform(original_img, corners)
        else:
            card_img = original_img

        # 3 layer ocr
        variants = get_image_variants(card_img)
        all_text_results = []
        for i, v_img in enumerate(variants):
            pil_img = Image.fromarray(v_img)
            psm = 11 if i == 2 else 3
            custom_config = f'--oem 3 --psm {psm}'
            text_pass = pytesseract.image_to_string(pil_img, config=custom_config)
            if text_pass.strip():
                all_text_results.append(f"--- PASS {i + 1} ---\n{text_pass.strip()}\n")

        # combine all passes for llm
        text = "\n\n".join(all_text_results)
        lines = [line.strip() for line in text.split('\n') if line.strip()]

        doc = nlp(text)
        # look for name and organization
        persons = [ent.text for ent in doc.ents if ent.label_ == 'PERSON' and len(ent.text) > 3]
        orgs = [ent.text for ent in doc.ents if ent.label_ == 'ORG']

        # rules
        email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
        phone_pattern = r'(\+?\d[\d\s\-]{8,}\d)'
        pin_pattern = r'\b\d{6}\b'

        emails = list(set(re.findall(email_pattern, text)))
        phones = list(set(
            re.sub(r'[^\d+]', '', p)
            for p in re.findall(phone_pattern, text)
            if len(re.sub(r'[^\d]', '', p)) >= 10
        ))

        address_keywords = ['Street', 'St', 'Road', 'Rd', 'Ave', 'Floor', 'Block', 'City', 'Sector',
                            'pin', 'Zip', 'District', 'State', 'Country', 'Lane', 'Nagar', 'Building',
                            'Opposite', 'Near', 'Behind']
        address_parts = [l for l in lines if any(key.lower() in l.lower() for key in address_keywords)]
        address = " ".join(address_parts) if address_parts else "check raw content"

        primary_owner = pick_primary_owner(persons, lines)
        primary_company = pick_primary_company(lines, orgs)

        data = {
            "primary_owner": primary_owner,
            "primary_company": primary_company,
            "potential_names": list(set(persons)),
            "company_names": list(set(orgs)),
            "emails": emails,
            "phone_numbers": phones,
            "address": address,
            "raw_garbage": text.strip()
        }

        # now polish (hybrid approach)
        print("Refining data with LLM...")
        final_refined_data = redefine_with_llm(data, image_path)
        if final_refined_data:
            final_refined_data["debug_raw"] = text.strip()

            #call database manager to save to excel
            try:
                sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

                from database_manager import save_to_mysql
                save_to_mysql(final_refined_data)

                print("Successfully saved to DataBase")
            except Exception as save_err:
                print(f"Error calling database manager : {save_err}")

            return final_refined_data
        return data  # fallback if llm fails
    except Exception as e:
        return f"Error: {str(e)}"


def redefine_with_llm(extracted_facts, original_image_path):
    import json
    from PIL import Image

    # Normalize phone numbers and emails first
    def normalize_phone(phone_list):
        clean_phones = []
        for p in phone_list:
            p_clean = re.sub(r'[^\d+]', '', p)
            if p_clean:
                clean_phones.append(p_clean)
        return clean_phones

    def normalize_emails(email_list):
        clean_emails = []
        for e in email_list:
            e_clean = e.strip().replace(" ", "").replace(",", "")
            if e_clean:
                clean_emails.append(e_clean)
        return clean_emails

    phones = normalize_phone(extracted_facts.get('phone_numbers', []))
    emails = normalize_emails(extracted_facts.get('emails', []))

    prompt = f"""
    You are a highly accurate business card parser.
    IMPORTANT: The 'RAW OCR TEXT' below contains results from THREE different OCR passes (Standard, Inverted, and Dilated).
    Some passes may have captured text that others missed.
    Your goal is to compare all passes against the ORIGINAL card image to extract **100% correct structured information**.
    Rules:
    1. MULTI-PASS OCR is your primary text source. If PASS 1 is empty, PASS 2 or 3 likely has the data.
    2. Trust the IMAGE: If OCR says '9B76' but the image clearly shows '9876', use the image data.
    3. KEEP the primary owner_name unless it is clearly incorrect.
    4. KEEP the primary company_name unless it is clearly incorrect.
    5. Phone Numbers: Combine broken segments. Fix 'O' to '0' or 'I' to '1' if seen in OCR.
    6. Ignore: Religious slogans like 'JAI MATA DI' , marketing taglines, or "Om/786" symbols.
    7. Do NOT invent information. If a field is missing, return "".
    Input Data:
    --------------------------------
    3-LAYER RAW OCR TEXT:
    {extracted_facts['raw_garbage']}
    --------------------------------
    LOCAL EXTRACTION HINTS (Normalized):
    PRIMARY RULE-BASED EXTRACTION (MOST TRUSTED):
    - owner_name: "{extracted_facts.get('primary_owner', '')}"
    - company_name: "{extracted_facts.get('primary_company', '')}"
    SUPPORTING OCR CANDIDATES (USE ONLY IF PRIMARY IS WRONG):
    - Other detected names: {extracted_facts['potential_names']}
    - Other detected companies: {extracted_facts['company_names']}
    - Email Candidates: {emails}
    - Phone Candidates: {phones}
    Task:
    Extract owner_name, company_name, emails, phone_numbers, and address.
    Output ONLY valid JSON:
    {{
      "primary_owner": "",
      "primary_company": "",
      "emails": [],
      "phone_numbers": [],
      "address": ""
    }}
    """

    try:
        img = Image.open(original_image_path)
        response = model.generate_content(
            [prompt, img],
            generation_config={"temperature": 0.1}
        )
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(clean_json)
        if not result.get("phone_numbers"):
            result["phone_numbers"] = phones
        if not result.get("emails"):
            result["emails"] = emails
        return result
    except:
        return None
