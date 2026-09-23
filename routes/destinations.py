from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from database import get_db
from models import DestinationDB, PlaceDB
from schemas import Destination, Place

router = APIRouter(tags=["Destinations"])

@router.get("/destinations", response_model=list[Destination])
def get_destinations(
    db: Session = Depends(get_db)
):
    destinations = db.query(DestinationDB).all()

    return destinations

@router.get("/destinations/{name}", response_model=Destination)
def get_destination(
    name: str,
    db: Session = Depends(get_db)
):
    destination = db.query(DestinationDB).filter(
        func.lower(DestinationDB.name) == name.lower()
    ).first()

    if destination is None:
        raise HTTPException(
            status_code=404,
            detail="Destination not found"
        )

    return destination

@router.get("/destinations/{name}/places", response_model=list[Place])
def get_places_for_destination(
    name: str,
    category: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db)
):
    destination = db.query(DestinationDB).filter(
        func.lower(DestinationDB.name) == name.lower()
    ).first()

    if destination is None:
        raise HTTPException(
            status_code=404,
            detail="Destination not found"
        )

    query = db.query(PlaceDB).filter(
        PlaceDB.destination_id == destination.id
    )

    if category is not None:
        query = query.filter(
            func.lower(PlaceDB.category) == category.lower()
        )

    if search is not None:
        query = query.filter(
            or_(
                PlaceDB.name.ilike(f"%{search}%"),
                PlaceDB.description.ilike(f"%{search}%")
            )
        )

    places = query.all()

    return places