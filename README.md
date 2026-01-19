# IRT Wizard

A web-based application for Item Response Theory (IRT) analysis, designed for air-gapped deployment with adaptive UI based on user competency levels.

## Features

- **IRT Models**: 1PL (Rasch), 2PL, 3PL dichotomous models
- **Adaptive UI**: Three user modes (Researcher, Educator, Student) with tailored explanations
- **Air-gapped Ready**: No external network dependencies required
- **Data Import**: CSV and TSV file upload or URL fetch
- **Visualizations**: Item Characteristic Curves, Information Functions, Ability Distributions
- **Export Options**: CSV, Excel, PDF reports (summary or detailed)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Running with Docker Compose

```bash
# Clone and navigate to the project
cd irt-wizard

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# MLflow UI: http://localhost:5000
```

### Local Development

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   React      │    │   FastAPI    │    │     PostgreSQL       │  │
│  │   Frontend   │───▶│   Backend    │───▶│     Database         │  │
│  │   (Nginx)    │    │   (Uvicorn)  │    │                      │  │
│  │   :3000      │    │   :8000      │    │   :5432              │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────────┘  │
│                             │                                       │
│                      ┌──────┴───────┐                              │
│                      │              │                              │
│               ┌──────▼──────┐ ┌─────▼──────┐                       │
│               │   MLflow    │ │ SeaweedFS  │                       │
│               │   Server    │ │ S3 Gateway │                       │
│               │   :5000     │ │ :8333      │                       │
│               └─────────────┘ └────────────┘                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## User Modes

| Feature | Student | Educator | Researcher |
|---------|---------|----------|------------|
| Model selection | Icons + simple names | Cards with explanations | Full control |
| Parameter display | Simplified labels | Standard labels | Technical + SE |
| Advanced options | Hidden | Collapsed | Visible |
| Tooltips | Always shown | On hover | Minimal |
| Fit statistics | Basic (good/bad) | Standard metrics | All diagnostics |
| Export formats | PDF only | PDF + CSV | All formats |

## API Documentation

Once the backend is running, access the interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
irt-wizard/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── api/v1/         # API endpoints
│   │   ├── core/           # IRT engine
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/            # API client
│       ├── components/     # React components
│       ├── hooks/          # Custom hooks
│       └── store/          # Zustand stores
└── infrastructure/
    ├── mlflow/
    └── seaweedfs/
```

## Testing

### Backend Tests

```bash
cd backend
pytest -v
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python 3.11+ |
| Frontend | React 18, Vite, TypeScript |
| Database | PostgreSQL 15 |
| File Storage | SeaweedFS (S3-compatible) |
| ML Tracking | MLflow |
| IRT Engine | girth |
| Visualization | Recharts |
| State Management | XState (wizard), Zustand (global) |

## License

MIT
