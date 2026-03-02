"""Lip synchronization engine wrapping Rhubarb CLI with strict isolation boundaries."""
import os
import tempfile
import asyncio
import logging
from typing import List

from app.config import settings
from app.models.chat_models import PhonemeFrame
from app.services.phoneme_parser import PhonemeParser
from app.services.process_guard import process_guard

logger = logging.getLogger(__name__)


class RhubarbLipSyncService:
    """
    Executes constrained subprocess boundaries pulling timing frames from chunked audio byte arrays.
    Strictly isolated tracking logic enforcing deletion routines regardless of outcomes.
    """

    def __init__(self):
        """Initialize configurations linking Rhubarb location."""
        self.binary_path = settings.rhubarb_binary_path
        self.timeout = settings.lipsync_timeout_seconds
        
        # Fast fail verification - log but delay explicit hard crash until generation
        if not os.path.exists(self.binary_path):
            logger.warning(
                "Rhubarb binary not accessible at nominal path. Phonemes will fail if fired.",
                extra={"expected_path": self.binary_path}
            )

    async def generate_phonemes(self, audio_bytes: bytes) -> List[PhonemeFrame]:
        """
        Receives raw chunked PCM segments, pipes to disk, fetches JSON, and scrubs securely.
        
        Args:
            audio_bytes: In-memory Wav payload array.
            
        Returns:
            List[PhonemeFrame]: Resolved and validated timing structures mapping to mouth shapes.
        """
        if not settings.lipsync_enabled or not audio_bytes:
            return []

        # We construct a short-lived temp file managed explicitly to skirt Zombie file leakage
        temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
        try:
            # Execute small synchronous write. Unlikely to block loop severely on short chunks.
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(audio_bytes)
                
            # Define isolated subprocess generation wrapped under guarded limits
            async def _invoke_rhubarb() -> List[PhonemeFrame]:
                process = await asyncio.create_subprocess_exec(
                    self.binary_path,
                    "-f", "json",
                    temp_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    # Enforce strict maximum duration limits preventing indefinitely hung threads
                    stdout_data, stderr_data = await asyncio.wait_for(
                        process.communicate(), 
                        timeout=self.timeout
                    )
                    
                    if process.returncode != 0:
                        logger.error("Rhubarb CLI invocation returned non-zero code", extra={
                            "stdout": stdout_data.decode('utf-8', errors='ignore'),
                            "stderr": stderr_data.decode('utf-8', errors='ignore'),
                            "returncode": process.returncode
                        })
                        return []
                        
                    return PhonemeParser.parse_rhubarb_json(stdout_data.decode('utf-8'))
                    
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    logger.error("Rhubarb subprocess hit maximum timeout limit.", extra={"timeout": self.timeout})
                    return []
                except asyncio.CancelledError:
                    process.kill()
                    await process.wait()
                    logger.warning("Rhubarb subprocess killed directly due to socket sever.")
                    raise

            # Dispatch bounded job
            return await process_guard.execute_with_guard(_invoke_rhubarb)
            
        except Exception as e:
            logger.error("Catastrophic fault generating phonemes", exc_info=True)
            return []
            
        finally:
            # Final block guarantees file obliteration from file-system even under Exception contexts natively
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception as e:
                logger.error("Fatal temp file leakage detected. Cleanup rejected by filesystem.", extra={
                    "temp_path": temp_path,
                    "error": str(e)
                })
