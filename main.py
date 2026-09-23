from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
from models import DestinationDB, PlaceDB
from routes import destinations, trips, stays
from chat.routes import chat
import auth

app = FastAPI(
    title="Travel Planner API",
    description="API for discovering destinations, creating trips, and building personalized itineraries.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(destinations.router)
app.include_router(trips.router)
app.include_router(auth.router)
app.include_router(stays.router)
app.include_router(chat.router)

@app.get("/")
def home():
    return {"message": "Welcome to Travel Planner API"}