from pydantic import BaseModel
from enum import Enum


class GamePhase(str, Enum):
    DEALING = "dealing"
    PLAYING = "playing"
    LIAR_CALLED = "liar_called"
    ROULETTE = "roulette"
    ROUND_OVER = "round_over"
    GAME_OVER = "game_over"


class GameMode(str, Enum):
    DICE = "dice"
    DECK = "deck"


class Bid(BaseModel):
    player_id: str
    quantity: int
    face_value: int
