import pandas as pd
from main import SessionLocal,DestinationDB,PlaceDB
db=SessionLocal()

places=pd.read_csv("TravelPlanner_Places_Clean.csv")
print(places)