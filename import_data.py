import pandas as pd
from main import DestinationDB,PlaceDB,SessionLocal

cities=pd.read_csv("City.csv")
places=pd.read_csv("TravelPlanner_Places_Clean.csv")

db=SessionLocal()

for _,row in cities.iterrows():
    destination=db.query(DestinationDB).filter(
        DestinationDB.name==row["City"]
    ).first()

    if destination is None:
        continue

    if pd.notna(row["image_url"]) and str(row["image_url"]).strip():
        destination.image_url=str(row["image_url"])

db.commit()

print("Destination images updated successfully!")

for _,row in places.iterrows():
    place=db.query(PlaceDB).filter(
        PlaceDB.source_id==row["place_id"]
    ).first()

    if place is None:
        continue

    if pd.notna(row["image_url"]) and str(row["image_url"]).strip():
        place.image_url=str(row["image_url"])

db.commit()

print("Place images updated successfully!")

db.close()