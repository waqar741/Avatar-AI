"""Parser transcribing raw Rhubarb JSON responses into validated schema sequences."""
import json
import logging
from typing import List

from app.models.chat_models import PhonemeFrame

logger = logging.getLogger(__name__)


class PhonemeParser:
    """Safely decodes external Rhubarb output rejecting malformed blocks without crashing."""

    @staticmethod
    def parse_rhubarb_json(json_content: str) -> List[PhonemeFrame]:
        """
        Validate strings specifically targeting Rhubarb's `mouthCues` array structure.

        Args:
            json_content: Raw string payload from Rhubarb stdout.
            
        Returns:
            List[PhonemeFrame]: Structured objects representing avatar mouth shapes over time.
        """
        if not json_content or not json_content.strip():
            return []

        try:
            data = json.loads(json_content)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse Rhubarb JSON format", extra={"error": str(e), "content": json_content[:100]})
            return []

        cues = data.get("mouthCues", [])
        frames = []
        
        for cue in cues:
            try:
                frame = PhonemeFrame(
                    start=cue.get("start", 0.0),
                    end=cue.get("end", 0.0),
                    value=cue.get("value", "X")
                )
                frames.append(frame)
            except Exception as e:
                logger.warning("Dropping invalid mouth cue during phoneme parse", extra={"cue": cue, "error": str(e)})

        return frames
