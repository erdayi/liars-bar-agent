import json
import asyncio
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.auth.secondme import verify_token
from app.game_manager.room import room_manager, Room
from app.models.events import ClientEvent, ServerEvent
from app.game_logic.bot_ai import get_dice_ai_decision, get_deck_ai_decision
from app.database import AsyncSessionLocal
from app.models.user import User


class ConnectionManager:
    def __init__(self):
        # {player_id: websocket}
        self.active_connections: dict[str, WebSocket] = {}
        # {room_id: {player_id: websocket}}
        self.room_connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, player_id: str, room_id: str):
        await websocket.accept()
        self.active_connections[player_id] = websocket

        if room_id not in self.room_connections:
            self.room_connections[room_id] = {}
        self.room_connections[room_id][player_id] = websocket

    def disconnect(self, player_id: str, room_id: str):
        if player_id in self.active_connections:
            del self.active_connections[player_id]

        if room_id in self.room_connections and player_id in self.room_connections[room_id]:
            del self.room_connections[room_id][player_id]

        if room_id in self.room_connections and not self.room_connections[room_id]:
            del self.room_connections[room_id]

    async def send_personal(self, player_id: str, message: dict):
        if player_id in self.active_connections:
            try:
                await self.active_connections[player_id].send_json(message)
            except Exception:
                pass

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.room_connections:
            for ws in list(self.room_connections[room_id].values()):
                try:
                    await ws.send_json(message)
                except Exception:
                    pass


# Global connection manager
manager = ConnectionManager()


async def handle_game_websocket(websocket: WebSocket, token: str, room_id: str):
    """Handle WebSocket connection for game."""
    # Verify token
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    player_id = payload.get("sub") or payload.get("user_id")
    if not player_id:
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    # Get room
    room = room_manager.get_room(room_id)
    if not room:
        await websocket.close(code=4002, reason="Room not found")
        return

    # Add player to room if not already - store access_token for their TTS
    if player_id not in room.players:
        nickname = payload.get("username", "Anonymous")
        avatar = payload.get("avatar", "fox")
        access_token = None

        # Get user's SecondMe access_token from database for TTS
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == player_id))
                user = result.scalar_one_or_none()
                if user and user.access_token:
                    access_token = user.access_token
                    print(f"[DEBUG] Stored access_token for player {player_id}")
        except Exception as e:
            print(f"[ERROR] Failed to get user access_token: {e}")

        room.add_player(player_id, nickname, avatar, access_token=access_token)

    # Connect
    await manager.connect(websocket, player_id, room_id)

    try:
        # Send initial room state
        await manager.send_personal(player_id, {
            "event": "room_state",
            "data": room.get_state()
        })

        # If game started, send game state
        if room.game_started and room.engine:
            await manager.send_personal(player_id, {
                "event": "game_state",
                "data": room.engine.get_state_for_player(player_id)
            })

        # Notify others
        await manager.broadcast(room_id, {
            "event": "player_joined",
            "data": {
                "player_id": player_id,
                "nickname": room.players[player_id]["nickname"],
                "avatar": room.players[player_id]["avatar"],
            }
        })

        # Listen for messages
        while True:
            try:
                data = await websocket.receive_text()
                await handle_game_message(websocket, player_id, room_id, data)
            except WebSocketDisconnect:
                break

    except Exception as e:
        print(f"WebSocket error: {e}")

    finally:
        manager.disconnect(player_id, room_id)
        await manager.broadcast(room_id, {
            "event": "player_left",
            "data": {"player_id": player_id}
        })

        # Clean up empty rooms
        if room_id in room_manager.rooms:
            room = room_manager.rooms[room_id]
            if not room.players:
                room_manager.delete_room(room_id)


async def handle_game_message(websocket: WebSocket, player_id: str, room_id: str, raw_data: str):
    """Handle incoming game messages."""
    try:
        data = json.loads(raw_data)
        event = data.get("event")
        event_data = data.get("data", {})

        room = room_manager.get_room(room_id)
        if not room:
            return

        if event == "start_game":
            # Start game
            if room.start_game():
                # Broadcast game start
                await manager.broadcast(room_id, {
                    "event": "game_start",
                    "data": {"mode": room.mode}
                })

                # Send individual game states
                if room.engine:
                    for pid in room.players:
                        await manager.send_personal(pid, {
                            "event": "game_state",
                            "data": room.engine.get_state_for_player(pid)
                        })

                # Check if first player is a bot
                await schedule_bot_turn(room_id)

        elif event == "player_action" and room.engine:
            # Handle game action
            action = event_data.get("action")
            action_data = event_data.get("data", {})

            events = room.engine.handle_action(player_id, action, action_data)

            # Process events
            for target, event in events:
                if target == "broadcast":
                    await manager.broadcast(room_id, event.model_dump())
                else:
                    await manager.send_personal(target, event.model_dump())

                # Reset room after game over
                if event.event == "game_over":
                    room.game_started = False
                    # Save to database
                    import asyncio
                    asyncio.create_task(room_manager.update_room_in_db(room))

            # Check if next turn is a bot
            await schedule_bot_turn(room_id)

        elif event == "ready":
            # Toggle ready status
            if player_id in room.players:
                room.players[player_id]["ready"] = not room.players[player_id].get("ready", False)
                await manager.broadcast(room_id, {
                    "event": "player_ready",
                    "data": {
                        "player_id": player_id,
                        "ready": room.players[player_id]["ready"]
                    }
                })

        elif event == "enable_agent":
            # Enable agent mode for this player
            if player_id in room.players:
                room.players[player_id]["is_agent"] = True
                await manager.send_personal(player_id, {
                    "event": "agent_enabled",
                    "data": {"message": "Agent mode enabled"}
                })
                print(f"[AGENT] Agent mode enabled for player {player_id}")
                # If it's this player's turn, schedule AI action
                await schedule_bot_turn(room_id)

        elif event == "disable_agent":
            # Disable agent mode for this player
            if player_id in room.players:
                room.players[player_id]["is_agent"] = False
                await manager.send_personal(player_id, {
                    "event": "agent_disabled",
                    "data": {"message": "Agent mode disabled"}
                })
                print(f"[AGENT] Agent mode disabled for player {player_id}")

    except json.JSONDecodeError:
        pass


async def schedule_bot_turn(room_id: str):
    """Schedule bot or agent turn if current player is a bot/agent."""
    room = room_manager.get_room(room_id)
    # Only run bot turns when game has actually started
    if not room or not room.engine or not room.game_started:
        return

    # Get current turn player
    current_turn = get_current_turn_player(room)
    if not current_turn:
        return

    # Check if it's a bot or agent (both use AI)
    player_info = room.players.get(current_turn, {})
    is_bot = player_info.get("is_bot", False)
    is_agent = player_info.get("is_agent", False)

    if not is_bot and not is_agent:
        return

    # It's a bot/agent's turn - schedule AI action after a delay
    asyncio.create_task(execute_bot_turn(room_id, current_turn))


def get_current_turn_player(room: Room) -> Optional[str]:
    """Get the current turn player from the engine."""
    engine = room.engine
    if hasattr(engine, 'turn_order') and hasattr(engine, 'current_turn_idx'):
        if engine.turn_order and 0 <= engine.current_turn_idx < len(engine.turn_order):
            return engine.turn_order[engine.current_turn_idx]
    return None


async def execute_bot_turn(room_id: str, bot_id: str):
    """Execute bot/agent's turn with AI decision."""
    # Wait longer for readability and TTS synchronization
    await asyncio.sleep(3.0)

    room = room_manager.get_room(room_id)
    if not room or not room.engine:
        return

    # Check it's still this bot's turn
    current = get_current_turn_player(room)
    if current != bot_id:
        return  # Turn changed

    # Get AI decision
    if room.mode == "dice":
        ai_decision = get_dice_ai_decision(room.engine, bot_id)
    else:
        ai_decision = get_deck_ai_decision(room.engine, bot_id)

    player_info = room.players.get(bot_id, {})
    is_agent = player_info.get("is_agent", False)

    print(f"[BOT AI] {'Agent' if is_agent else 'Bot'} {bot_id} making decision: {ai_decision}")

    # Generate TTS message for agents
    tts_message = None
    if is_agent:
        tts_message = generate_tts_message(ai_decision, room.mode, player_info.get("nickname", "玩家"))

    # Execute the action
    events = room.engine.handle_action(bot_id, ai_decision["action"], ai_decision.get("data", {}))

    # Process events
    for target, event in events:
        if target == "broadcast":
            await manager.broadcast(room_id, event.model_dump())
        else:
            await manager.send_personal(target, event.model_dump())

    # Send TTS to agent player if enabled
    if is_agent and tts_message:
        await manager.send_personal(bot_id, {
            "event": "tts",
            "data": {"message": tts_message}
        })

    # Check if next player is also a bot/agent
    await schedule_bot_turn(room_id)


def generate_tts_message(ai_decision: dict, mode: str, nickname: str) -> str:
    """Generate TTS message for the agent's action."""
    action = ai_decision.get("action")

    if mode == "dice":
        if action == "place_bid":
            qty = ai_decision.get("data", {}).get("quantity", 0)
            face = ai_decision.get("data", {}).get("face_value", 0)
            return f"{nickname} 叫 {qty} 个 {face}"
        elif action == "challenge_bid":
            return f"{nickname} 质疑！"
    else:
        if action == "play_cards":
            return f"{nickname} 打出了卡片"
        elif action == "call_liar":
            return f"{nickname} 质疑！"

    return f"{nickname} 采取了行动"
