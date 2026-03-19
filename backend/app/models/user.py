from sqlalchemy import Column, String, Integer, DateTime, BigInteger
from sqlalchemy.sql import func
from app.database import Base
import uuid


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    secondme_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    avatar = Column(String(500), default="fox")
    points = Column(Integer, default=100)
    games_played = Column(Integer, default=0)
    games_won = Column(Integer, default=0)
    # SecondMe OAuth tokens
    access_token = Column(String(2000), nullable=True)
    refresh_token = Column(String(2000), nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
