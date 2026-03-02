"""Controller mediating WebSockets and LLM Services protecting domain limits."""
import asyncio
import logging
from fastapi import WebSocket

from app.services.session_manager import session_manager
from app.services.groq_service import GroqStreamingService
from app.models.chat_models import WSOutgoingMessage

logger = logging.getLogger(__name__)


class StreamController:
    """Coordinates message propagation, tracking LLM state and isolating socket errors."""

    def __init__(self, websocket: WebSocket, groq_service: GroqStreamingService):
        """
        Inject websocket capabilities and downstream completion service.
        """
        self.websocket = websocket
        self.groq_service = groq_service

    async def handle_stream(self, message: str) -> None:
        """
        Consume user input, forward tokens out via WS, enforce bounds tracking.
        Must run entirely within request lifecycle without isolating background tasks.
        
        Args:
            message: Raw user payload to send to inference.
        """
        session_manager.record_request(self.websocket)
        logger.debug("Starting LLM stream forwarding")
        
        session_manager.active_llm_requests += 1
        try:
            generator = self.groq_service.stream_completion(message)
            
            async for token in generator:
                # Immediately enforce session capabilities avoiding generating extra
                if not session_manager.charge_session_tokens(self.websocket, 1):
                    await self.websocket.send_text(
                        WSOutgoingMessage.error("Session token limits reached. Generation halted.").model_dump_json()
                    )
                    break
                
                # Fast outbound send without global buffering
                await self.websocket.send_text(
                    WSOutgoingMessage.token(token).model_dump_json()
                )
            
            # Send trailing finish
            await self.websocket.send_text(WSOutgoingMessage.done().model_dump_json())
            
        except asyncio.CancelledError:
            logger.warning("Generation aborted due to client disconnect context")
            raise
        except RuntimeError as e:
            logger.error("Service exception triggered generation halt", extra={"error": str(e)})
            await self.websocket.send_text(
                WSOutgoingMessage.error(str(e)).model_dump_json()
            )
        except Exception as e:
            logger.error("Unexpected pipeline failure", exc_info=True)
            await self.websocket.send_text(
                WSOutgoingMessage.error("Internal Server Error").model_dump_json()
            )
        finally:
            session_manager.active_llm_requests -= 1
