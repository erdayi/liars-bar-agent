import uuid
import random
from typing import Optional
from app.game_logic import DeckEngine, DiceEngine
from app.models.game import GamePhase, GameMode
from app.database import AsyncSessionLocal
from sqlalchemy import select, delete
from app.models.room import Room as RoomModel

# Bot names and avatars for variety
BOT_NAMES = [
    "狐狸", "狼", "乌鸦", "蛇", "猫", "熊", "兔子", "鲨鱼", "猫头鹰", "公牛",
    "老虎", "狮子", "豹", "鹰", "鹤", "鹿", "猪", "狗", "马", "龙",
    "小美", "小明", "老王", "阿强", "翠花", "二蛋", "铁柱", "傻蛋", "呆子", "笨笨"
]
BOT_AVATARS = ["fox", "wolf", "raven", "snake", "cat", "bear", "rabbit", "shark", "owl", "bull"]


class Room:
    def __init__(self, room_id: str, mode: str, max_players: int = 8):
        self.room_id = room_id
        self.mode = mode  # "deck" or "dice"
        self.max_players = max_players
        self.players: dict[str, dict] = {}  # {player_id: {nickname, avatar, ws, ready, is_bot}}
        self.game_started = False
        self.engine = None
        self.owner_id: Optional[str] = None

    def add_player(self, player_id: str, nickname: str, avatar: str = "fox", is_bot: bool = False, access_token: str = None) -> bool:
        if len(self.players) >= self.max_players:
            return False
        if player_id in self.players:
            return False

        self.players[player_id] = {
            "nickname": nickname,
            "avatar": avatar,
            "ws": None,
            "ready": False,
            "is_bot": is_bot,
            "access_token": access_token,  # Store each player's SecondMe token for TTS
        }

        if not self.owner_id:
            self.owner_id = player_id

        # Save to database
        import asyncio
        from app.database import AsyncSessionLocal
        asyncio.create_task(self._save_to_db())

        return True

    async def _save_to_db(self):
        """Save room to database."""
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            from app.models.room import Room as RoomModel
            players_list = [
                {
                    "player_id": pid,
                    "nickname": p["nickname"],
                    "avatar": p["avatar"],
                    "ready": p.get("ready", False),
                    "is_bot": p.get("is_bot", False),
                    "access_token": p.get("access_token"),
                }
                for pid, p in self.players.items()
            ]

            result = await db.execute(
                select(RoomModel).where(RoomModel.room_id == self.room_id)
            )
            db_room = result.scalar_one_or_none()

            if db_room:
                db_room.players = players_list
                db_room.game_started = self.game_started
                db_room.owner_id = self.owner_id
            else:
                db_room = RoomModel(
                    room_id=self.room_id,
                    mode=self.mode,
                    max_players=self.max_players,
                    owner_id=self.owner_id,
                    players=players_list,
                    game_started=self.game_started,
                )
                db.add(db_room)
            await db.commit()

    def add_bot(self) -> bool:
        """Add a bot player to the room."""
        print(f"[DEBUG add_bot] is_full: {self.is_full()}, game_started: {self.game_started}, players: {len(self.players)}, max_players: {self.max_players}")
        if self.is_full():
            print("[DEBUG add_bot] Room is full")
            return False
        if self.game_started:
            print("[DEBUG add_bot] Game already started")
            return False

        # Generate unique bot ID
        bot_id = f"bot_{uuid.uuid4().hex[:8]}"

        # Pick random name and avatar
        available_names = [n for n in BOT_NAMES if not any(p.get("nickname") == n for p in self.players.values())]
        if not available_names:
            available_names = BOT_NAMES

        bot_name = random.choice(available_names)
        bot_avatar = random.choice(BOT_AVATARS)
        print(f"[DEBUG add_bot] Adding bot: {bot_id}, name: {bot_name}, avatar: {bot_avatar}")

        return self.add_player(bot_id, bot_name, bot_avatar, is_bot=True)

    def add_bots(self, count: int) -> int:
        """Add multiple bots to the room."""
        added = 0
        for _ in range(count):
            if not self.add_bot():
                break
            added += 1
        return added

    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]

        # Transfer ownership if needed
        if self.owner_id == player_id and self.players:
            self.owner_id = next(iter(self.players.keys()))

        # Save to database
        import asyncio
        asyncio.create_task(self._save_to_db())

    def start_game(self) -> bool:
        if self.game_started or len(self.players) < 2:
            return False

        # Create game engine
        if self.mode == "deck":
            self.engine = DeckEngine()
        else:
            self.engine = DiceEngine()

        # Initialize with players
        player_ids = list(self.players.keys())
        nicknames = {pid: self.players[pid]["nickname"] for pid in player_ids}
        avatars = {pid: self.players[pid]["avatar"] for pid in player_ids}

        self.engine.initialize(player_ids, nicknames, avatars)
        self.game_started = True
        return True

    def get_state(self) -> dict:
        return {
            "room_id": self.room_id,
            "mode": self.mode,
            "max_players": self.max_players,
            "players": [
                {
                    "player_id": pid,
                    "nickname": p["nickname"],
                    "avatar": p["avatar"],
                    "ready": p.get("ready", False),
                }
                for pid, p in self.players.items()
            ],
            "player_count": len(self.players),
            "game_started": self.game_started,
            "owner_id": self.owner_id,
        }

    def is_full(self) -> bool:
        return len(self.players) >= self.max_players


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}

    async def load_rooms_from_db(self):
        """Load rooms from database into memory."""
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(RoomModel).where(RoomModel.game_started == False))
            db_rooms = result.scalars().all()

            for db_room in db_rooms:
                room = Room(db_room.room_id, db_room.mode, db_room.max_players)
                room.game_started = db_room.game_started
                room.owner_id = db_room.owner_id
                # Load players
                if db_room.players:
                    for p in db_room.players:
                        room.players[p["player_id"]] = {
                            "nickname": p["nickname"],
                            "avatar": p["avatar"],
                            "ws": None,
                            "ready": p.get("ready", False),
                            "is_bot": p.get("is_bot", False),
                            "access_token": p.get("access_token"),
                        }
                self.rooms[db_room.room_id] = room
            print(f"[RoomManager] Loaded {len(self.rooms)} rooms from database")

    async def save_room_to_db(self, room: Room):
        """Save room to database."""
        async with AsyncSessionLocal() as db:
            players_list = [
                {
                    "player_id": pid,
                    "nickname": p["nickname"],
                    "avatar": p["avatar"],
                    "ready": p.get("ready", False),
                    "is_bot": p.get("is_bot", False),
                    "access_token": p.get("access_token"),
                }
                for pid, p in room.players.items()
            ]

            result = await db.execute(
                select(RoomModel).where(RoomModel.room_id == room.room_id)
            )
            db_room = result.scalar_one_or_none()

            if db_room:
                db_room.players = players_list
                db_room.game_started = room.game_started
                db_room.owner_id = room.owner_id
            else:
                db_room = RoomModel(
                    room_id=room.room_id,
                    mode=room.mode,
                    max_players=room.max_players,
                    owner_id=room.owner_id,
                    players=players_list,
                    game_started=room.game_started,
                )
                db.add(db_room)
            await db.commit()

    async def delete_room_from_db(self, room_id: str):
        """Delete room from database."""
        async with AsyncSessionLocal() as db:
            await db.execute(delete(RoomModel).where(RoomModel.room_id == room_id))
            await db.commit()

    async def update_room_in_db(self, room: Room):
        """Update room in database."""
        await self.save_room_to_db(room)

    def create_room(self, mode: str, max_players: int = 8) -> Room:
        room_id = str(uuid.uuid4())[:8]
        room = Room(room_id, mode, max_players)
        self.rooms[room_id] = room
        # Save to database
        import asyncio
        asyncio.create_task(self.save_room_to_db(room))
        return room

    def get_room(self, room_id: str) -> Optional[Room]:
        return self.rooms.get(room_id)

    async def delete_room(self, room_id: str):
        if room_id in self.rooms:
            del self.rooms[room_id]
        await self.delete_room_from_db(room_id)

    def get_all_rooms(self) -> list[dict]:
        return [
            room.get_state()
            for room in self.rooms.values()
            if not room.game_started
        ]


# Global room manager
room_manager = RoomManager()
