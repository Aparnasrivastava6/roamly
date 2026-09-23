from main import DestinationDB,PlaceDB,SessionLocal

db=SessionLocal()

destinations=db.query(DestinationDB).all()

print("Destinations:",len(destinations))
print("Places:",db.query(PlaceDB).count())

print("\nDestinations with zero places:")

for destination in destinations:
    count=db.query(PlaceDB).filter(
        PlaceDB.destination_id==destination.id
    ).count()

    if count==0:
        print(destination.name)

db.close()