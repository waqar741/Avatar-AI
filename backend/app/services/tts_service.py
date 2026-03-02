"""Text-to-Speech generation using Microsoft Edge-TTS."""
import asyncio
import logging
from typing import AsyncGenerator
import edge_tts

from app.config import settings

logger = logging.getLogger(__name__)


class EdgeTTSService:
    """Async wrapper for the edge-tts synthesize API ensuring low-latency memory streaming."""

    def __init__(self):
        """Initialize parameters mapped strictly from configuration bounds."""
        self.voice = settings.tts_voice
        self.timeout = settings.tts_timeout_seconds

    async def stream_speech(self, text: str) -> AsyncGenerator[bytes, None]:
        """
        Accept buffered text chunk and yield generator of raw audio bytes safely.

        Args:
            text: A complete sentence or logical chunk of text to process.
        
        Yields:
            bytes: Binary payload chunks comprising the synthesized audio.
        """
        if not text or not text.strip():
            return

        communicate = edge_tts.Communicate(text, self.voice)
        
        try:
            # Enforce an outer timeout on the synthesize attempt to ensure no hung streams
            async def _generate_stream():
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        yield chunk["data"]

            generator = _generate_stream()
            
            while True:
                chunk = await asyncio.wait_for(
                    anext(generator, None), 
                    timeout=self.timeout
                )
                if chunk is None:
                    break
                yield chunk

        except asyncio.TimeoutError:
            logger.error("Edge-TTS timed out synthesizing audio", extra={"text_length": len(text)})
        except asyncio.CancelledError:
            logger.warning("TTS audio generation cancelled externally")
            raise
        except Exception as e:
            logger.error("General Failure in Edge-TTS client", extra={"error": str(e), "text_length": len(text)})
