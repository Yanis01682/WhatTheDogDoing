from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
import bcrypt
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from enum import Enum

SECRET_KEY = "whatthedogdoing-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserStatus(str, Enum):
    online = "online"
    busy = "busy"
    away = "away"
    invisible = "invisible"
    offline = "offline"


class UserAuth(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    status: str = "online"
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_username(db: Session, username: str):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == username).first()
    return user


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


@router.post("/register", response_model=UserResponse)
def register(user_data: UserAuth, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user_data.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    if user_data.email and get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already taken")
    new_user = models.User(
        username=user_data.username,
        email=user_data.email if user_data.email else None,
        hashed_password=get_password_hash(user_data.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user.status = "online"
    db.commit()
    access_token = create_access_token(data={"sub": user.username})
    user_response = UserResponse.model_validate(user)
    return TokenResponse(access_token=access_token, user=user_response)


@router.get("/me", response_model=UserResponse)
def me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/logout")
def logout(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.status = "offline"
    db.commit()
    return {"message": "Successfully logged out"}


@router.put("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="旧密码不正确")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码长度不能少于 6 位")

    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    return {"message": "密码修改成功"}


@router.put("/status")
def update_status(
    request: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新用户在线状态"""
    new_status = request.get("status")
    valid_statuses = ["online", "offline", "busy", "away", "invisible"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"无效的状态值，必须是: {', '.join(valid_statuses)}")

    current_user.status = new_status
    db.commit()
    return {"message": "状态更新成功", "status": new_status}


class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: int
    username: str
    nickname: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    data: UserProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
