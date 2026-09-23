import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("STAYINGAPI_KEY")

url = "https://api.stayingapi.com/v1/search"

headers = {
    "Authorization": f"Bearer {API_KEY}"
}

params = {
    "location": "Kolkata, India",
    "checkIn": "2026-10-10",
    "checkOut": "2026-10-12",
    "adults": 2,
    "platforms": "booking",
    "limit": 5
}

response = requests.get(
    url,
    headers=headers,
    params=params
)

print("Status code:", response.status_code)
print(response.text)