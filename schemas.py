from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict


class Destination(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    best_time: str
    description: str
    image_url: str


class Place(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_id: int | None = None
    name: str
    city: str | None = None
    state: str | None = None
    address: str | None = None
    latitude: str | None = None
    longitude: str | None = None
    rating: str | None = None
    reviews_count: int | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    source_url: str | None = None
    destination_id: int

class UserCreate(BaseModel):
    username: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str


class UserLogin(BaseModel):
    email: str
    password: str


class Trip(BaseModel):
    name: str
    destination_id: int
    total_days: int = Field(gt=0)
    budget: float = Field(gt=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Trip name cannot be empty")

        return value


class TripResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    destination_id: int
    total_days: int
    budget: float


class TripPlace(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trip_id: int
    place_id: int
    day_number: int = Field(gt=0)


class TripUpdate(BaseModel):
    name: str | None = None
    total_days: int | None = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError("Trip name cannot be empty")

        return value


class ItineraryDay(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day_number: int
    places: list[Place]


class TripDetailsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    destination: str
    total_days: int
    itinerary: list[ItineraryDay]


class TripPreference(BaseModel):
    trip_id: int
    preferences: list[str]


class TripPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trip_id: int
    preference: str


class TripPlaceUpdate(BaseModel):
    day_number: int = Field(gt=0)