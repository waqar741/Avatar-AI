"""WebSocket endpoint definitions."""
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.connection_manager import manager
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/avatar")
async def websocket_avatar_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for Avatar bi-directional streaming.
    
    Args:
        websocket: The WebSocket connection instance.
    """
    accepted = await manager.connect(websocket)
    if not accepted:
        await websocket.close(code=1013, reason="Server is busy")
        return

    try:
        await websocket.send_text("Welcome to the Avatar Streaming API")
        
        while True:
            # Receive echo messages with timeout for heartbeat approach
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=settings.ws_heartbeat_interval
                )
                # Echo message back
                await websocket.send_text(f"Echo: {message}")
            except asyncio.TimeoutError:
                # Send simple ping mechanism
                await websocket.send_text("ping")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error("WebSocket error", extra={"error": str(e)})
        manager.disconnect(websocket)
