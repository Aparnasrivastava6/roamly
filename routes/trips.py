from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import TripDB, TripPlaceDB, PlaceDB, DestinationDB, UserDB, TripPreferenceDB
from schemas import Trip,TripPlace,TripUpdate,TripResponse,TripDetailsResponse,ItineraryDay,TripPreference,TripPlaceUpdate
from auth import get_current_user


router = APIRouter(tags=["Trips"])

@router.post("/trips", response_model=TripResponse)
def create_trip(
    trip: Trip,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_destination = db.query(DestinationDB).filter(
        DestinationDB.id == trip.destination_id
    ).first()

    if existing_destination is None:
        raise HTTPException(
            status_code=404,
            detail="Destination not found"
        )

    new_trip = TripDB(
        name=trip.name,
        user_id=current_user.id,
        destination_id=trip.destination_id,
        total_days=trip.total_days,
        budget=trip.budget
    )

    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)

    return new_trip


@router.get("/my-trips", response_model=list[TripResponse])
def get_trips(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    trips = db.query(TripDB).filter(
        TripDB.user_id == current_user.id
    ).all()

    return trips


@router.post("/trip-places", response_model=TripPlace)
def add_place_to_trip(
    trip_place: TripPlace,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_place = db.query(PlaceDB).filter(
        PlaceDB.id == trip_place.place_id
    ).first()

    if existing_place is None:
        raise HTTPException(
            status_code=404,
            detail="Place not found"
        )

    existing_trip = db.query(TripDB).filter(
        TripDB.id == trip_place.trip_id
    ).first()

    if existing_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != existing_trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    if existing_trip.destination_id != existing_place.destination_id:
        raise HTTPException(
            status_code=400,
            detail="Place does not belong to this trip's destination"
        )

    existing_trip_place = db.query(TripPlaceDB).filter(
        TripPlaceDB.trip_id == trip_place.trip_id,
        TripPlaceDB.place_id == trip_place.place_id
    ).first()

    if existing_trip_place is not None:
        raise HTTPException(
            status_code=409,
            detail="Place already exists in this trip"
        )

    if trip_place.day_number > existing_trip.total_days:
        raise HTTPException(
            status_code=400,
            detail="Day number exceeds the total number of days in this trip"
        )

    new_trip_place = TripPlaceDB(
        trip_id=trip_place.trip_id,
        place_id=trip_place.place_id,
        day_number=trip_place.day_number
    )

    db.add(new_trip_place)
    db.commit()
    db.refresh(new_trip_place)

    return new_trip_place


@router.get("/trips/{trip_id}/places", response_model=list[ItineraryDay])
def trip_places(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if existing_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != existing_trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    trip_places = db.query(
        TripPlaceDB,
        PlaceDB
    ).join(
        PlaceDB,
        TripPlaceDB.place_id == PlaceDB.id
    ).filter(
        TripPlaceDB.trip_id == trip_id
    ).all()

    itinerary = []

    for day in range(1, existing_trip.total_days + 1):
        day_places = []

        for trip_place, place in trip_places:
            if trip_place.day_number == day:
                day_places.append(place)

        itinerary.append(
            ItineraryDay(
                day_number=day,
                places=day_places
            )
        )

    return itinerary


@router.delete("/trips/{trip_id}/places/{place_id}")
def delete_place_from_trip(
    trip_id: int,
    place_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if existing_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != existing_trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    tripplace = db.query(TripPlaceDB).filter(
        TripPlaceDB.trip_id == trip_id,
        TripPlaceDB.place_id == place_id
    ).first()

    if tripplace is None:
        raise HTTPException(
            status_code=404,
            detail="Place not found in this trip"
        )

    db.delete(tripplace)
    db.commit()

    return {
        "message": "Place removed from trip successfully"
    }


@router.delete("/trips/{trip_id}")
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    tripplaces = db.query(TripPlaceDB).filter(
        TripPlaceDB.trip_id == trip_id
    ).all()

    preferences = db.query(TripPreferenceDB).filter(
        TripPreferenceDB.trip_id == trip_id
    ).all()

    for trip_place in tripplaces:
        db.delete(trip_place)

    for preference in preferences:
        db.delete(preference)

    db.delete(trip)
    db.commit()

    return {
        "message": "Trip removed successfully"
    }


@router.patch("/trips/{trip_id}", response_model=TripResponse)
def update_name(
    trip_id: int,
    trip_update: TripUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    if trip_update.name is not None:
        trip.name = trip_update.name

    if trip_update.total_days is not None:

        trip_places = db.query(TripPlaceDB).filter(
            TripPlaceDB.trip_id == trip_id
        ).all()

        for trip_place in trip_places:
            if trip_place.day_number > trip_update.total_days:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot reduce total days because places are scheduled after the new total days"
                )

        trip.total_days = trip_update.total_days

    db.commit()
    db.refresh(trip)

    return trip


@router.get("/trips/{trip_id}", response_model=TripResponse)
def trip_info(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    return trip


@router.get("/trips/{trip_id}/details", response_model=TripDetailsResponse)
def trip_details(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    destination = db.query(DestinationDB).filter(
        DestinationDB.id == trip.destination_id
    ).first()

    trip_places = db.query(
        TripPlaceDB,
        PlaceDB
    ).join(
        PlaceDB,
        TripPlaceDB.place_id == PlaceDB.id
    ).filter(
        TripPlaceDB.trip_id == trip_id
    ).all()

    itinerary = []

    for day in range(1, trip.total_days + 1):
        day_places = []

        for trip_place, place in trip_places:
            if trip_place.day_number == day:
                day_places.append(place)

        itinerary.append(
            ItineraryDay(
                day_number=day,
                places=day_places
            )
        )

    return TripDetailsResponse(
        id=trip.id,
        name=trip.name,
        destination=destination.name,
        total_days=trip.total_days,
        itinerary=itinerary
    )


@router.patch("/trips/{trip_id}/places/{place_id}", response_model=TripPlace)
def change_day_number(
    trip_id: int,
    place_id: int,
    trip_place_update: TripPlaceUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if existing_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != existing_trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    existing_trip_place = db.query(TripPlaceDB).filter(
        TripPlaceDB.trip_id == trip_id,
        TripPlaceDB.place_id == place_id
    ).first()

    if existing_trip_place is None:
        raise HTTPException(
            status_code=404,
            detail="Place not found in this trip"
        )

    if trip_place_update.day_number > existing_trip.total_days:
        raise HTTPException(
            status_code=400,
            detail="Day number exceeds the total number of days in this trip"
        )

    existing_trip_place.day_number = trip_place_update.day_number

    db.commit()
    db.refresh(existing_trip_place)

    return existing_trip_place


@router.put("/trips/{trip_id}/preferences")
def update_preferences(
    trip_id: int,
    trip_preference: TripPreference,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if existing_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if existing_trip.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    existing_preferences = db.query(TripPreferenceDB).filter(
        TripPreferenceDB.trip_id == trip_id
    ).all()

    for preference in existing_preferences:
        db.delete(preference)

    unique_preferences = set(trip_preference.preferences)

    for preference in unique_preferences:
        new_preference = TripPreferenceDB(
            trip_id=trip_id,
            preference=preference
        )

        db.add(new_preference)

    db.commit()

    return {
        "message": "Preferences updated successfully"
    }


@router.get("/trips/{trip_id}/preferences")
def get_preferences(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    existing_trip = db.query(TripDB).filter(
        TripDB.id == trip_id
    ).first()

    if existing_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if current_user.id != existing_trip.user_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    trip_preferences = db.query(TripPreferenceDB).filter(
        TripPreferenceDB.trip_id == trip_id
    ).all()

    return trip_preferences