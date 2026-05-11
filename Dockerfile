FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend . 
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy requirements
COPY backend/requirements.txt .

# Install dependencies with uv
RUN uv pip install --system -r requirements.txt

# Copy backend code
COPY backend .

# Copy frontend static build
COPY --from=frontend-builder /app/frontend/out ./static

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
