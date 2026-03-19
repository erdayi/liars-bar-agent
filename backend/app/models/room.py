from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Room(Base):
    __tablename__ = "rooms"

    room_id = Column(String, primary_key=True)
    mode = Column(String, nullable=False)  # "deck" or "dice"
    max_players = Column(Integer, default=8)
    owner_id = Column(String, nullable=False)
    players = Column(JSON, default=list)  # List of player info
    game_started = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
