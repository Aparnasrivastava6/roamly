import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("STAYINGAPI_KEY")

job_id = "job_2503bbad3f0702fcfa268cf6"

url = f"https://api.stayingapi.com/v1/jobs/{job_id}"

headers = {
    "Authorization": f"Bearer {API_KEY}"
}

response = requests.get(
    url,
    headers=headers
)

print(response.status_code)
print(response.text)