"""WebSocket endpoint definitions."""
import asyncio
import json
import logging
from pydantic import ValidationError
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.connection_manager import manager
from app.config import settings
from app.services.session_manager import session_manager
from app.services.groq_service import GroqStreamingService
from app.services.stream_controller import StreamController
from app.models.chat_models import WSIncomingMessage, WSOutgoingMessage

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/avatar")
async def websocket_avatar_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint driving session LLM token streaming securely.
    """
    accepted = await manager.connect(websocket)
    if not accepted:
        await websocket.close(code=1013, reason="Server is busy")
        return

    session_manager.attach_session(websocket)
    
    # Isolate services specifically for this websocket request lifecycle context
    http_client = websocket.app.state.http_client
    groq_service = GroqStreamingService(http_client)
    stream_controller = StreamController(websocket, groq_service)

    try:
        await websocket.send_text(WSOutgoingMessage.token("Connected to Streaming API").model_dump_json())
        
        while True:
            # Revert to standard event loop polling
            try:
                raw_message = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=settings.ws_heartbeat_interval
                )
                
                # Strict structural parsing protects downstream mechanics
                try:
                    payload = WSIncomingMessage.model_validate_json(raw_message)
                except ValidationError as ve:
                    logger.warning("Invalid incoming payload", extra={"error": str(ve)})
                    await websocket.send_text(
                        WSOutgoingMessage.error("Invalid JSON format payload").model_dump_json()
                    )
                    continue
                
                if payload.type == "chat" and payload.message:
                    # Explicit await protects connection scope memory limits
                    await stream_controller.handle_stream(payload.message)
                elif payload.type == "ping":
                    await websocket.send_text(
                        WSOutgoingMessage(type="heartbeat", content="pong").model_dump_json()
                    )
                    
            except asyncio.TimeoutError:
                # Emit heartbeat mechanism
                await websocket.send_text(
                    WSOutgoingMessage(type="heartbeat", content="ping").model_dump_json()
                )
                
    except WebSocketDisconnect:
        logger.info("Client disconnected gracefully")
    except Exception as e:
        logger.error("WebSocket server handler fault", extra={"error": str(e)})
    finally:
        session_manager.detach_session(websocket)
        manager.disconnect(websocket)
