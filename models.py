from sqlalchemy import Column, Integer, String, ForeignKey, Float
from database import Base

class DestinationDB(Base):
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    best_time = Column(String)
    description = Column(String)
    image_url = Column(String)

class PlaceDB(Base):
    __tablename__ = "places"

    id = Column(Integer, primary_key=True)
    source_id = Column(Integer)
    name = Column(String)
    city = Column(String)
    state = Column(String)
    address = Column(String)
    latitude = Column(String)
    longitude = Column(String)
    rating = Column(String)
    reviews_count = Column(Integer)
    description = Column(String)
    image_url = Column(String)
    category = Column(String)
    source_url = Column(String)
    destination_id = Column(Integer,ForeignKey("destinations.id"))

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class TripDB(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    user_id = Column(Integer,ForeignKey("users.id"))
    destination_id = Column(Integer,ForeignKey("destinations.id"))
    total_days = Column(Integer)
    budget = Column(Float)

class TripPlaceDB(Base):
    __tablename__ = "trip_places"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer,ForeignKey("trips.id"))
    place_id = Column(Integer,ForeignKey("places.id"))
    day_number = Column(Integer)

class TripPreferenceDB(Base):
    __tablename__ ="trip_preferences"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer,ForeignKey("trips.id"))
    preference=Column(String)

    

