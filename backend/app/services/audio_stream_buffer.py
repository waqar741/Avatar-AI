"""Buffering system for optimizing fragmented tokens into synthesizable sentences."""
import re
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class AudioStreamBuffer:
    """
    Accumulates sub-word LLM tokens until logical breakpoints (punctuation
    or capacity constraints) are reached safely without bloating memory.
    """

    def __init__(self):
        """Initialize empty buffer state and limits."""
        self.current_buffer: str = ""
        self.max_chars: int = settings.tts_max_buffer_chars
        # Regex matching trailing punctuation designating a natural speaking pause
        self.sentence_regex = re.compile(r'([.?!:;]+)$')

    def append(self, token: str) -> Optional[str]:
        """
        Append a string to the buffer and determine if a flush boundary is met.

        Args:
            token: Incoming LLM generator text chunk.

        Returns:
            Optional[str]: The flushed content if boundary met, else None.
        """
        self.current_buffer += token

        # Flush if we exceed structural limits or hit trailing boundary mechanics
        if len(self.current_buffer) >= self.max_chars:
            logger.debug("Flushing buffer due to MAX boundary", extra={"chars": len(self.current_buffer)})
            return self.flush()

        if self.sentence_regex.search(self.current_buffer.strip()):
            return self.flush()

        return None

    def flush(self) -> Optional[str]:
        """
        Hard clear the buffer returning its residual text state securely.

        Returns:
            Optional[str]: Stripped buffer content if valid, else None.
        """
        content = self.current_buffer.strip()
        self.current_buffer = ""
        
        if content:
            return content
        return None
