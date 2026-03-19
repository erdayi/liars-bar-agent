from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.api import auth, lobby
from app.api import tts
from app.ws.game_ws import handle_game_websocket

from app.game_manager.room import room_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database on startup
    await init_db()
    # Load rooms from database
    await room_manager.load_rooms_from_db()
    yield


app = FastAPI(title="Liar's Bar A2A", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(lobby.router, prefix="/api")
app.include_router(tts.router, prefix="/api")


# WebSocket endpoint
@app.websocket("/ws/game/{room_id}")
async def game_websocket(websocket: WebSocket, room_id: str):
    # Get token from query param
    token = websocket.query_params.get("token", "")
    await handle_game_websocket(websocket, token, room_id)


# Redirect root to frontend
@app.get("/")
async def root():
    return RedirectResponse(url="/index.html")
