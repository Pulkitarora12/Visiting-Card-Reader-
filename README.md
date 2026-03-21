# 📇 AI-Powered Business Card Reader

A Full-Stack Intelligent OCR application that transforms physical business cards into structured digital data. Built with **FastAPI**, **React**, and **Google Gemini 1.5 Flash**.

---

## 🚀 Key Features

* **Multi-Pass OCR:** Uses Tesseract with three different image preprocessing layers (Standard, Inverted, Dilated) to ensure maximum text accuracy.
* **Gemini AI Integration:** Leverages the `gemini-1.5-flash` multimodal model to clean raw OCR "garbage" and intelligently map fields like Owner, Company, and Address.
* **Dual-Source Input:** Upload an existing image file or capture a live photo directly from your webcam/mobile camera.
* **Relational Storage:** Seamlessly saves refined data into a **MySQL** database.
* **Data Export:** Export your entire contact database as a professional **.CSV** file for use in Excel or CRM tools.
* **Responsive UI:** A modern, "glassmorphism" inspired dashboard built with **Tailwind CSS**.

## 🛠️ Tech Stack

**Frontend:**
* React.js (Hooks, Refs, Context)
* Tailwind CSS (Styling & Animations)
* Axios (API Communication)
* React-Webcam (Camera Integration)

**Backend:**
* FastAPI (Asynchronous Python Framework)
* Pytesseract (OCR Engine)
* OpenCV (Image Processing & Perspective Transform)
* spaCy (Natural Language Processing)
* Google Generative AI (Gemini SDK)

**Database:**
* MySQL (Persistent Storage)
* Pandas (Data Manipulation & Export)

## 📦 Installation & Setup

### 1. Prerequisites
* Python 3.8+
* Node.js & npm
* MySQL Server
* [Tesseract OCR Engine](https://github.com/UB-Mannheim/tesseract/wiki) installed on your system.

### 2. Backend Setup
1. Clone the repository:
   ```bash
   git clone [https://github.com/Janitberwal/Visiting-Card-Reader-.git](https://github.com/Janitberwal/Visiting-Card-Reader-.git)
   cd Visiting-Card-Reader-

2.Create and activate a virtual environment:


Bash
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

3.Install dependencies:

Bash
pip install -r requirements.txt

4.Create a .env file in the root directory:

Code snippet
GEMINI_API_KEY=your_google_api_key_here


5. Frontend Setup
Navigate to the UI folder:

Bash
cd card-reader-ui

6.Install packages:

Bash
npm install

7.Start the React development server:

Bash
npm start

📸 Screenshots

<img width="1916" height="944" alt="image" src="https://github.com/user-attachments/assets/6ea57c77-ca9d-4a03-aedd-f620e8b6a837" />


<img width="1472" height="643" alt="image" src="https://github.com/user-attachments/assets/20af429a-a757-409c-8b1e-d03035f3bba0" />


<img width="1894" height="917" alt="image" src="https://github.com/user-attachments/assets/ed4a58f2-4f08-47dc-9671-4e01e639a8ae" />


<img width="1026" height="387" alt="image" src="https://github.com/user-attachments/assets/db87f279-9f12-485c-b14b-ce5ec64b900b" />


