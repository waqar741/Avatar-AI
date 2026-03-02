"""Controller mediating WebSockets, LLM Services, and TTS Streaming Pipelines."""
import asyncio
import logging
from fastapi import WebSocket

from app.config import settings
from app.services.session_manager import session_manager
from app.services.groq_service import GroqStreamingService
from app.services.tts_service import EdgeTTSService
from app.services.audio_stream_buffer import AudioStreamBuffer
from app.services.audio_chunk_encoder import AudioChunkEncoder
from app.services.lip_sync_service import RhubarbLipSyncService
from app.models.chat_models import WSOutgoingMessage

logger = logging.getLogger(__name__)


class StreamController:
    """Coordinates message propagation, tracking LLM state, dual audio-text streaming, and isolating socket errors."""

    def __init__(self, websocket: WebSocket, groq_service: GroqStreamingService):
        """Inject websocket capabilities and downstream completion/speech services."""
        self.websocket = websocket
        self.groq_service = groq_service
        
        # Audio orchestration mechanics initialized per session request
        self.tts_service = EdgeTTSService() if settings.tts_enabled else None
        self.audio_buffer = AudioStreamBuffer()
        self.audio_encoder = AudioChunkEncoder()
        
        # Avatar Lip Sync logic isolated independently from audio chunks
        self.lipsync_service = RhubarbLipSyncService() if settings.lipsync_enabled else None
        # Keep track of inflight lip sync jobs for cleanup gracefully
        self.pending_lipsync_tasks = set()

    async def _generate_and_send_audio(self, text: str) -> None:
        """
        Takes buffered text and natively streams audio frames out via WebSocket.
        Interrupts cleanly if socket severs unexpectedly.
        """
        if not self.tts_service:
            return

        try:
            full_audio_bytes = bytearray()
            async for raw_bytes in self.tts_service.stream_speech(text):
                full_audio_bytes.extend(raw_bytes)
                encoded_chunks = self.audio_encoder.encode(raw_bytes)
                for chunk in encoded_chunks:
                    await self.websocket.send_text(WSOutgoingMessage.audio_chunk(chunk).model_dump_json())

            # Clear out trailing encoded pieces immediately
            trailing_chunk = self.audio_encoder.flush()
            if trailing_chunk:
                await self.websocket.send_text(WSOutgoingMessage.audio_chunk(trailing_chunk).model_dump_json())

            # Dispatch Phoneme synchronization computation entirely decoupled from the UI audio delay
            if self.lipsync_service and len(full_audio_bytes) > 0:
                task = asyncio.create_task(self._process_lip_sync(bytes(full_audio_bytes)))
                self.pending_lipsync_tasks.add(task)
                task.add_done_callback(self.pending_lipsync_tasks.discard)

        except asyncio.CancelledError:
            logger.warning("TTS generation was cancelled rapidly mid-flight")
            raise
        except Exception as e:
            logger.error("TTS Pipeline encounted a severe issue", exc_info=True)
            await self.websocket.send_text(WSOutgoingMessage.error("Audio generation failed non-fatally").model_dump_json())

    async def _process_lip_sync(self, audio_data: bytes) -> None:
        """
        Takes captured PCM frames per sentence block and dispatches out to Rhubarb Subprocesses.
        """
        try:
            frames = await self.lipsync_service.generate_phonemes(audio_data)
            if frames:
                await self.websocket.send_text(WSOutgoingMessage.phoneme(frames).model_dump_json())
        except asyncio.CancelledError:
            logger.warning("LipSync processing task aborted cleanly due to unmount trigger")
            raise
        except Exception as e:
            logger.error("Non-fatal LipSync rendering failure", extra={"error": str(e)})

    async def handle_stream(self, message: str) -> None:
        """
        Consume user input, forward tokens out via WS, construct TTS audio bounds tracking.
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
                if not session_manager.charge_session_tokens(self.websocket, 1):
                    await self.websocket.send_text(
                        WSOutgoingMessage.error("Session token limits reached. Generation halted.").model_dump_json()
                    )
                    break
                
                # Outbound send token fast
                await self.websocket.send_text(WSOutgoingMessage.token(token).model_dump_json())
                
                # Push into sentence buffers catching synchronous outputs sequentially
                if settings.tts_enabled:
                    synthesize_target = self.audio_buffer.append(token)
                    if synthesize_target:
                        await self._generate_and_send_audio(synthesize_target)
            
            # Send trailing text finish
            await self.websocket.send_text(WSOutgoingMessage.done().model_dump_json())
            
            # Final audio resolution capturing remainder strings after generation ceases
            if settings.tts_enabled:
                final_synthesize_target = self.audio_buffer.flush()
                if final_synthesize_target:
                    await self._generate_and_send_audio(final_synthesize_target)
                
                # Halt to guarantee trailing phoneme extractions map successfully prior to terminal closure payload
                if self.pending_lipsync_tasks:
                    await asyncio.gather(*self.pending_lipsync_tasks, return_exceptions=True)
                    
                await self.websocket.send_text(WSOutgoingMessage.audio_done().model_dump_json())
                
                if settings.lipsync_enabled:
                    await self.websocket.send_text(WSOutgoingMessage.phoneme_done().model_dump_json())
            
        except asyncio.CancelledError:
            logger.warning("Generation aborted due to client disconnect context")
            # Proactively cull unyielding stray background extraction tasks 
            for t in self.pending_lipsync_tasks:
                if not t.done():
                    t.cancel()
            raise
        except RuntimeError as e:
            logger.error("Service exception triggered generation halt", extra={"error": str(e)})
            await self.websocket.send_text(WSOutgoingMessage.error(str(e)).model_dump_json())
        except Exception as e:
            logger.error("Unexpected pipeline failure", exc_info=True)
            await self.websocket.send_text(WSOutgoingMessage.error("Internal Server Error").model_dump_json())
        finally:
            session_manager.active_llm_requests -= 1
