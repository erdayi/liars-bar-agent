from abc import ABC, abstractmethod
from typing import Any, Optional


class GameEngine(ABC):
    @abstractmethod
    def initialize(self, player_ids: list, nicknames: dict = None, avatars: dict = None) -> list:
        """Set up initial state. Returns list of (target, event) tuples."""
        ...

    @abstractmethod
    def handle_action(self, player_id: str, action: str, data: dict) -> list:
        """Process a player action. Returns resulting (target, event) tuples."""
        ...

    @abstractmethod
    def get_state_for_player(self, player_id: str) -> dict:
        """Return the game state visible to a specific player."""
        ...

    @abstractmethod
    def get_current_player_id(self) -> Optional[str]:
        ...

    @abstractmethod
    def is_game_over(self) -> bool:
        ...
