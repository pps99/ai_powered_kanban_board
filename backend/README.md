# Backend - Project Management MVP

FastAPI backend for the Kanban board application.

## Setup

### Local Development (without Docker)

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Server runs at http://127.0.0.1:8000

## Docker

### Build

```bash
docker build -t pm-mvp:latest .
```

### Run

```bash
docker run -d \
  --name pm-mvp-container \
  -p 8000:8000 \
  pm-mvp:latest
```

Access at http://localhost:8000

### Using Scripts

```bash
# Mac/Linux
./scripts/start-mac.sh      # or start-linux.sh
./scripts/stop-mac.sh       # or stop-linux.sh

# Windows
scripts\start-pc.cmd
scripts\stop-pc.cmd
```

## API Endpoints

### Health Check
- **GET** `/health` - Returns `{ "status": "ok" }`

### Static Files
- **GET** `/` - Serves `backend/static/index.html` (hello world demo)

## Structure

```
backend/
├── main.py              # FastAPI app, routes, middleware
├── requirements.txt     # Python dependencies
└── static/
    └── index.html       # Hello world static page
```

## Technology Stack

- **FastAPI** - Web framework
- **Uvicorn** - ASGI server
- **Python 3.12** - Runtime
- **uv** - Package manager (in Docker)

## Notes

- CORS is enabled for all origins (development only)
- Routes are served via APIRouter to ensure proper precedence
- Static files mount last to prevent catching API routes
- Health endpoint returns 200 OK with JSON response
