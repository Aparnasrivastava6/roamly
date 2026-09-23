# Roamly — Personal Travel Planner

Roamly is a full-stack personal travel planning application built with FastAPI, React, SQLite, and SQLAlchemy. It helps users discover destinations and places, create trips, build day-wise itineraries, manage budgets and preferences, search for stays, and interact with an AI-powered travel assistant.

## Features

### Travel Planning
- Browse destinations and places
- Search places by category and description
- Create and manage personalized trips
- Set trip duration and budget
- Add trip preferences
- Build day-wise itineraries
- Add, remove, and move places between itinerary days

### Authentication
- User registration and login
- Password hashing with `pwdlib`
- JWT-based authentication
- User-specific trip access

### AI Travel Assistant
The Roamly assistant can:
- Answer travel-related questions
- Use saved trips as conversation context
- Maintain conversation history
- Read itinerary, budget, duration, preferences, destination, and place data
- Add places to trips
- Remove places from trips
- Move places between itinerary days
- Rename trips
- Update trip budgets
- Update trip duration

The assistant uses OpenRouter through the OpenAI Python SDK interface.

### Accommodation Search
- Search for stays through StayingAPI
- Retrieve asynchronous stay-search job results

### Database & Migrations
- SQLite for local development
- SQLAlchemy ORM
- Foreign-key relationships
- Alembic database migrations

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | SQLite |
| ORM | SQLAlchemy |
| Validation | Pydantic |
| Authentication | JWT, pwdlib |
| Migrations | Alembic |
| AI | OpenRouter, OpenAI Python SDK |
| External API | StayingAPI |

## Project Structure

```text
Roamly/
├── Frontend/
│   ├── src/
│   │   ├── Chatbot.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
│
├── alembic/
│   ├── versions/
│   │   ├── 89482a63bda1_add_image_url_to_destinations.py
│   │   ├── a81274947341_add_budget_to_trips.py
│   │   ├── b64c792a87c2_add_trip_preferences.py
│   │   └── e3dbfa29910a_initial_migration.py
│   ├── env.py
│   ├── README
│   └── script.py.mako
│
├── chat/
│   ├── routes/
│   │   ├── __init__.py
│   │   └── chat.py
│   ├── chatbot.py
│   └── schemas.py
│
├── routes/
│   ├── __init__.py
│   ├── destinations.py
│   ├── stays.py
│   └── trips.py
│
├── .gitignore
├── City.csv
├── TravelPlanner_Places_Clean.csv
├── alembic.ini
├── auth.py
├── check_database.py
├── database.py
├── import_data.py
├── inspect_data.py
├── main.py
├── models.py
├── requirements.txt
├── schemas.py
├── test_job.py
└── test_staying_api.py
```

> `TravelPlanner.db`, `.env`, `.venv/`, `node_modules/`, `__pycache__/`, and compiled Python files should remain excluded through `.gitignore`.

## Database Design

Roamly uses SQLite with SQLAlchemy ORM.

Core entities include:

- `users`
- `destinations`
- `places`
- `trips`
- `trip_places`
- `trip_preferences`

Key relationships:

```text
users
  │
  └── trips
        │
        ├── destinations
        ├── trip_preferences
        └── trip_places
              │
              └── places
```

`trip_places` acts as the junction table between trips and places and stores `day_number` for the itinerary.

## API Overview

The backend is built with FastAPI.

### General

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | API welcome message |

### Destinations & Places

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/destinations` | Retrieve destinations |
| GET | `/destinations/{name}` | Retrieve a destination |
| GET | `/destinations/{name}/places` | Retrieve places for a destination |
| GET | `/destinations/{name}/places?category=...` | Filter places by category |
| GET | `/destinations/{name}/places?search=...` | Search places |

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/register` | Register a user |
| POST | `/login` | Authenticate and receive a JWT |

### Stays

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/stays/search` | Search accommodation data |
| GET | `/stays/jobs/{job_id}` | Retrieve a stay-search job result |

### AI Assistant

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/chat` | Send a message to the Roamly travel assistant |

Trip-related routes are available through the trips router for creating, retrieving, updating, and managing trips, itineraries, and preferences.

For the complete interactive API reference, run the backend and open:

```text
http://127.0.0.1:8000/docs
```

## Prerequisites

Install:

- Python 3.10+
- Node.js and npm
- Git

API credentials are required for the external services used by Roamly.

## Installation

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Roamly
```

### 2. Create a Python virtual environment

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

### 3. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your_secret_key
OPENROUTER_API_KEY=your_openrouter_api_key
STAYINGAPI_KEY=your_stayingapi_key
```

Never commit `.env` to GitHub.

### 5. Prepare the database

Apply migrations:

```bash
alembic upgrade head
```

To import the provided destination and place data:

```bash
python import_data.py
```

### 6. Start the backend

```bash
uvicorn main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Interactive documentation:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

Open a second terminal:

```bash
cd Frontend
npm install
npm run dev
```

Vite will display the frontend URL in the terminal.

## Environment Variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Signs JWT access tokens |
| `OPENROUTER_API_KEY` | Connects the AI assistant to OpenRouter |
| `STAYINGAPI_KEY` | Connects the accommodation search integration |

Keep all secret values out of source control.

## Authentication Flow

1. A user registers through `/register`.
2. The password is hashed before storage.
3. The user logs in through `/login`.
4. The backend returns a JWT access token.
5. The frontend stores the token.
6. Authenticated requests send `Authorization: Bearer <token>`.
7. Protected endpoints use the authenticated user to retrieve user-specific trips.

## AI Assistant Architecture

```text
User message
     ↓
React Chatbot
     ↓
POST /chat
     ↓
JWT authentication
     ↓
Identify user, trip, and place
     ↓
Rule-based action detection
     ↓
SQLAlchemy database operation
     ↓
Action result
     ↓
OpenRouter AI
     ↓
Natural-language response
     ↓
React UI refresh
```

Supported trip actions include:

- Add a place to a specific day
- Remove a place
- Move a place to another day
- Rename a trip
- Change a trip budget
- Change trip duration

Database modifications are performed by the backend rather than being directly executed by the AI model.

## Database Migrations

Alembic tracks schema changes.

Current migrations include:

1. Initial database schema
2. Trip preferences
3. Trip budget
4. Destination image URLs

Apply migrations with:

```bash
alembic upgrade head
```

Check the current migration with:

```bash
alembic current
```

## Data

Roamly uses CSV files for destination and place data:

- `City.csv` — destination information
- `TravelPlanner_Places_Clean.csv` — place information

The import script loads the supplied data into the database.

## Security Notes

For local development, Roamly uses environment variables and JWT authentication.

Before public deployment, consider:

- Restricting CORS origins
- Using a strong production secret key
- Secure token storage
- HTTPS
- Production-grade database configuration
- Rate limiting
- Monitoring external API usage
- Automated security testing

## Development

Start the backend:

```bash
uvicorn main:app --reload
```

Start the frontend:

```bash
cd Frontend
npm run dev
```

FastAPI documentation:

```text
http://127.0.0.1:8000/docs
```

## Project Status

**Status: Complete**

Roamly currently provides:

- Full-stack travel planning
- User authentication
- Destination and place discovery
- Trip and itinerary management
- Budget and preference management
- Accommodation search integration
- AI-powered travel assistance
- Chat-based itinerary modifications

## Future Improvements

Potential future development areas include:

- More travel-data integrations
- Richer accommodation information
- Transportation recommendations
- Advanced itinerary optimization
- Improved chatbot intent recognition
- Production deployment
- Automated testing
- More granular authorization and validation
- Further responsive UI improvements

## Author

**Aparna Srivastava**

B.Tech — Computer Science & Engineering (AI/ML)

## License

This project currently does not specify an open-source license.

If you intend to publish Roamly as an open-source project, add an appropriate license before distributing it.
