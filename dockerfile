# Use an official Python runtime as a parent image
FROM python:3.10-slim

# 1. Install System Dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Set the working directory
WORKDIR /app

# 3. Copy only requirements first
COPY requirements.txt .

# 4. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Download the spaCy model
RUN python -m spacy download en_core_web_sm

# 6. Copy the rest of your application code
COPY . .

# 7. Create data directory for uploads and exports
RUN mkdir -p data/samples && chmod 777 data/samples

# 8. Expose the port
EXPOSE 8000

# 9. Command to run the application
# Using --proxy-headers is recommended if you later put this behind Nginx
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]