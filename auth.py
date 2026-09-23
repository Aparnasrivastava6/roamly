from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from schemas import UserCreate, UserResponse
from database import get_db
from models import UserDB

load_dotenv()

router = APIRouter(tags=["Authentication"])

password_hash = PasswordHash.recommended()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_password_hash(password):
    return password_hash.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(UserDB).filter(
        UserDB.email == email
    ).first()

    if user is None:
        raise credentials_exception

    return user

@router.post("/register", response_model=UserResponse)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    existing_email = db.query(UserDB).filter(
        UserDB.email == user.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    existing_username = db.query(UserDB).filter(
        UserDB.username == user.username
    ).first()

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )

    new_user = UserDB(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.post("/login")
def login_user(
    user: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    existing_user = db.query(UserDB).filter(
        UserDB.email == user.username
    ).first()

    if existing_user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    password_correct = password_hash.verify(
        user.password,
        existing_user.hashed_password
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={"sub": existing_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }