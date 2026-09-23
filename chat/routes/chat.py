from fastapi import APIRouter, Depends
from openai import OpenAI
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import os
import re

from chat.schemas import ChatRequest, ChatResponse
from database import get_db
from models import (
    DestinationDB,
    PlaceDB,
    TripDB,
    TripPreferenceDB,
    TripPlaceDB
)
from auth import get_current_user

load_dotenv()

router = APIRouter(tags=["Chat"])

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)


def find_trip(message, trips):
    message_lower = message.lower()

    for trip in trips:
        if trip.name.lower() in message_lower:
            return trip

    if len(trips) == 1:
        return trips[0]

    return None


def find_place(message, places):
    message_lower = message.lower()

    for place in places:
        normalized_name = re.sub(
            r"^\d+\.\s*",
            "",
            place.name
        ).strip().lower()

        if normalized_name and normalized_name in message_lower:
            return place

    return None


def get_trip_context(db, trips):
    if not trips:
        return "The user has no saved trips."

    trip_details = []

    for trip in trips:
        destination = db.query(DestinationDB).filter(
            DestinationDB.id == trip.destination_id
        ).first()

        preferences = db.query(TripPreferenceDB).filter(
            TripPreferenceDB.trip_id == trip.id
        ).all()

        itinerary = db.query(
            TripPlaceDB,
            PlaceDB
        ).join(
            PlaceDB,
            TripPlaceDB.place_id == PlaceDB.id
        ).filter(
            TripPlaceDB.trip_id == trip.id
        ).order_by(
            TripPlaceDB.day_number
        ).all()

        destination_name = (
            destination.name if destination else "Unknown destination"
        )

        preference_text = ", ".join(
            preference.preference
            for preference in preferences
        )

        itinerary_text = "No places added yet."

        if itinerary:
            itinerary_days = {}

            for trip_place, place in itinerary:
                itinerary_days.setdefault(
                    trip_place.day_number,
                    []
                ).append(place.name)

            itinerary_text = "\n".join(
                f"Day {day}: {', '.join(places)}"
                for day, places in itinerary_days.items()
            )

        trip_details.append(
            f"Trip: {trip.name}\n"
            f"Destination: {destination_name}\n"
            f"Duration: {trip.total_days} days\n"
            f"Budget: {trip.budget}\n"
            f"Preferences: {preference_text or 'No preferences added'}\n"
            f"Itinerary:\n{itinerary_text}"
        )

    return "\n\n".join(trip_details)


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    message = request.message.lower()

    trips = db.query(TripDB).filter(
        TripDB.user_id == current_user.id
    ).all()

    trip = find_trip(message, trips)

    if not trip and request.history:
        for history_message in reversed(request.history):
            if history_message.role == "user":
                trip = find_trip(
                    history_message.content.lower(),
                    trips
                )
                if trip:
                    break

    action_message = message

    if message in [
        "yes",
        "yeah",
        "yep",
        "y",
        "sure",
        "okay",
        "ok",
        "go ahead",
        "do it",
        "proceed"
    ]:
        for history_message in reversed(request.history):
            if history_message.role == "user":
                action_message = history_message.content.lower()
                break

    trip_from_action_message = find_trip(action_message, trips)

    if trip_from_action_message:
        trip = trip_from_action_message

    if not trip and len(trips) == 1:
        trip = trips[0]

    places_for_trip = []

    if trip:
        places_for_trip = db.query(PlaceDB).filter(
            PlaceDB.destination_id == trip.destination_id
        ).all()

    place = find_place(
        action_message,
        places_for_trip
    )

    action_result = None

    add_action = (
        "add " in action_message
        or "add the " in action_message
        or "include " in action_message
        or "put " in action_message
    )

    remove_action = (
        "remove " in action_message
        or "delete " in action_message
        or "take out " in action_message
    )

    move_action = (
        "move " in action_message
        or "shift " in action_message
    )

    rename_action = (
        "rename " in action_message
        or "change the name of " in action_message
    )

    budget_action = (
        "budget" in action_message
        and (
            "change" in action_message
            or "set" in action_message
            or "increase" in action_message
            or "decrease" in action_message
            or "make" in action_message
        )
    )

    duration_action = (
        ("day" in action_message or "days" in action_message)
        and (
            "change" in action_message
            or "make" in action_message
            or "extend" in action_message
            or "shorten" in action_message
        )
    )

    if add_action:
        day_match = re.search(
            r"day\s*(\d+)",
            action_message
        )

        if not trip:
            action_result = (
                "I couldn't determine which trip you want to modify."
            )

        elif not place:
            action_result = (
                "I couldn't find the place in your trip's destination."
            )

        elif not day_match:
            action_result = (
                "Please tell me which day you want to add "
                "the place to."
            )

        else:
            day_number = int(day_match.group(1))

            if day_number > trip.total_days:
                action_result = (
                    f"{trip.name} is only {trip.total_days} days long. "
                    f"Day {day_number} is not part of this trip."
                )

            else:
                existing = db.query(TripPlaceDB).filter(
                    TripPlaceDB.trip_id == trip.id,
                    TripPlaceDB.place_id == place.id
                ).first()

                if existing:
                    action_result = (
                        f"{place.name} is already in your "
                        f"{trip.name} itinerary on Day "
                        f"{existing.day_number}."
                    )

                else:
                    new_trip_place = TripPlaceDB(
                        trip_id=trip.id,
                        place_id=place.id,
                        day_number=day_number
                    )

                    db.add(new_trip_place)
                    db.commit()

                    action_result = (
                        f"Added {place.name} to Day "
                        f"{day_number} of your {trip.name}."
                    )

    elif remove_action:
        if not trip:
            action_result = (
                "I couldn't determine which trip you want to modify."
            )

        elif not place:
            action_result = (
                "I couldn't find the place in your trip's destination."
            )

        else:
            trip_place = db.query(TripPlaceDB).filter(
                TripPlaceDB.trip_id == trip.id,
                TripPlaceDB.place_id == place.id
            ).first()

            if not trip_place:
                action_result = (
                    f"{place.name} is not currently in your "
                    f"{trip.name} itinerary."
                )

            else:
                db.delete(trip_place)
                db.commit()

                action_result = (
                    f"Removed {place.name} from your "
                    f"{trip.name} itinerary."
                )

    elif move_action:
        day_matches = re.findall(
            r"\bday\s*(\d+)",
            action_message
        )

        if not trip:
            action_result = (
                "I couldn't determine which trip you want to modify."
            )

        elif not place:
            action_result = (
                "I couldn't find the place in your trip's destination."
            )

        elif not day_matches:
            action_result = (
                "Please tell me which day you want to move the place to."
            )

        else:
            day_number = int(day_matches[-1])

            if day_number > trip.total_days:
                action_result = (
                    f"{trip.name} is only {trip.total_days} days long. "
                    f"Day {day_number} is not part of this trip."
                )

            else:
                trip_place = db.query(TripPlaceDB).filter(
                    TripPlaceDB.trip_id == trip.id,
                    TripPlaceDB.place_id == place.id
                ).first()

                if not trip_place:
                    action_result = (
                        f"{place.name} is not currently in your "
                        f"{trip.name} itinerary."
                    )

                elif trip_place.day_number == day_number:
                    action_result = (
                        f"{place.name} is already scheduled "
                        f"for Day {day_number}."
                    )

                else:
                    old_day = trip_place.day_number

                    trip_place.day_number = day_number

                    db.commit()

                    action_result = (
                        f"Moved {place.name} from Day "
                        f"{old_day} to Day {day_number} "
                        f"of your {trip.name}."
                    )

    elif rename_action:
        if not trip:
            action_result = (
                "I couldn't determine which trip you want to rename."
            )

        else:
            rename_match = re.search(
                r"\bto\s+(.+)$",
                action_message
            )

            if not rename_match:
                action_result = (
                    "Please tell me what you want to "
                    "rename the trip to."
                )

            else:
                new_name = rename_match.group(1).strip()

                if not new_name:
                    action_result = (
                        "Please provide a new name for the trip."
                    )

                else:
                    old_name = trip.name

                    trip.name = new_name.title()

                    db.commit()

                    action_result = (
                        f"Renamed your trip from {old_name} "
                        f"to {trip.name}."
                    )

    elif budget_action:
        if not trip:
            action_result = (
                "I couldn't determine which trip you want to modify."
            )

        else:
            number_pattern = (
                r"(?:₹|rs\.?|inr)?\s*"
                r"\b(\d+(?:,\d+)*(?:\.\d+)?)\b"
            )

            to_match = re.search(
                r"\bto\s*" + number_pattern,
                action_message
            )

            if to_match:
                budget_str = to_match.group(1)
            else:
                all_numbers = re.findall(
                    number_pattern,
                    action_message
                )

                budget_str = all_numbers[-1] if all_numbers else None

            if not budget_str:
                action_result = (
                    "Please tell me the new budget amount."
                )

            else:
                budget = float(
                    budget_str.replace(",", "")
                )

                if budget <= 0:
                    action_result = (
                        "The budget must be greater than zero."
                    )

                else:
                    trip.budget = budget

                    db.commit()

                    action_result = (
                        f"Changed the budget for your "
                        f"{trip.name} to ₹{budget:,.0f}."
                    )

    elif duration_action:
        if not trip:
            action_result = (
                "I couldn't determine which trip you want to modify."
            )

        else:
            day_match = re.search(
                r"\b(\d+)\s*days?\b",
                action_message
            )

            if not day_match:
                action_result = (
                    "Please tell me how many days you want "
                    "the trip to be."
                )

            else:
                new_days = int(day_match.group(1))

                if new_days <= 0:
                    action_result = (
                        "The trip must be at least one day long."
                    )

                else:
                    trip.total_days = new_days

                    db.commit()

                    action_result = (
                        f"Changed your {trip.name} trip to "
                        f"{new_days} days."
                    )

    trips = db.query(TripDB).filter(
        TripDB.user_id == current_user.id
    ).all()

    trip_context = get_trip_context(
        db,
        trips
    )

    destinations = db.query(
        DestinationDB
    ).all()

    matched_destination = None

    for destination in destinations:
        if destination.name.lower() in message:
            matched_destination = destination
            break

    places = []

    categories = [
        "nature",
        "adventure",
        "pilgrimage",
        "historical",
        "wildlife",
        "culture"
    ]

    matched_category = None

    for category in categories:
        if category in message:
            matched_category = category
            break

    if matched_destination:
        query = db.query(PlaceDB).filter(
            PlaceDB.destination_id == matched_destination.id
        )

        if matched_category:
            query = query.filter(
                PlaceDB.category.ilike(
                    matched_category
                )
            )

        for current_place in query.all():
            if current_place.name.lower() in message:
                places = [current_place]
                break

        if not places:
            places = query.limit(20).all()

    place_context = ""

    if places:
        place_context = "\n".join(
            f"- {current_place.name}: "
            f"{current_place.description or 'No description available'}"
            for current_place in places
        )

    response = client.chat.completions.create(
        model="openrouter/free",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are the travel assistant for Roamly. "
                    "You help users plan, understand, and modify "
                    "their trips. "
                    "Use the user's trip information and Roamly's "
                    "database when relevant. "
                    "You may also use general travel knowledge to "
                    "answer questions and give suggestions. "
                    "If an action was performed, clearly tell the "
                    "user what was changed. "
                    "If an action could not be performed, explain why. "
                    "Do not claim that an action was completed unless "
                    "the provided action result confirms that it was. "
                    "If the user confirms a previously requested "
                    "action, use the action result to describe what "
                    "was actually changed."
                )
            },
            *[
                {
                    "role": history_message.role,
                    "content": history_message.content
                }
                for history_message in request.history
            ],
            {
                "role": "user",
                "content": (
                    f"{request.message}\n\n"
                    f"Action interpreted as:\n"
                    f"{action_message}\n\n"
                    f"Action result:\n"
                    f"{action_result or 'No database modification was requested.'}\n\n"
                    f"User's saved trips:\n"
                    f"{trip_context}\n\n"
                    f"Travel information from Roamly's database:\n"
                    f"{place_context or 'No matching destination or place was found in the database.'}"
                )
            }
        ]
    )

    return {
        "response": response.choices[0].message.content
    }