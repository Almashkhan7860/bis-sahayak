# Backend container for Koyeb deployment
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code (includes data/ and faiss_index/
# as long as they aren't excluded in .dockerignore)
COPY . .

# Koyeb sets the PORT environment variable at runtime; default to 8000
# for local `docker run` testing.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
