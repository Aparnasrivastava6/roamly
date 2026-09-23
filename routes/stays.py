import os
import requests
from datetime import date
from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(tags=["Stays"])

def get_api_key():
    API_KEY = os.getenv("STAYINGAPI_KEY")

    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="StayingAPI key is not configured"
        )

    return API_KEY

@router.get("/stays/search")
def search_stays(
    location: str,
    check_in: date,
    check_out: date,
    adults: int = Query(default=2, gt=0),
    limit: int = Query(default=5, gt=0, le=20)
):
    if check_in < date.today():
        raise HTTPException(
            status_code=400,
            detail="Check-in date cannot be in the past"
        )

    if check_out <= check_in:
        raise HTTPException(
            status_code=400,
            detail="Check-out date must be after check-in date"
        )

    API_KEY = get_api_key()

    url = "https://api.stayingapi.com/v1/search"

    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    params = {
        "location": location,
        "checkIn": check_in.isoformat(),
        "checkOut": check_out.isoformat(),
        "adults": adults,
        "platforms": "booking",
        "limit": limit
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch stay data: {str(e)}"
        )

@router.get("/stays/jobs/{job_id}")
def get_stay_job(job_id: str):
    API_KEY = get_api_key()

    url = f"https://api.stayingapi.com/v1/jobs/{job_id}"

    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=15
        )

        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch stay job: {str(e)}"
        )