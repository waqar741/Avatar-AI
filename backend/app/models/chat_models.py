"""Chat models describing the WebSocket stream payload formatting."""
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel, Field

class PhonemeFrame(BaseModel):
    """Timing tuple output normalized from Rhubarb Lip Sync generation."""
    start: float = Field(..., description="Start time of the mouth shape in seconds")
    end: float = Field(..., description="End time of the mouth shape in seconds")
    value: str = Field(..., description="Rhubarb mouth shape symbol (A, B, C, D, E, F, G, H, X)")

class WSIncomingMessage(BaseModel):
    """Schema for parsing JSON messages sent by the WebSocket client."""
    type: Literal["chat", "ping"] = Field(..., description="Type of incoming message")
    message: Optional[str] = Field(None, description="The user's text message")


class WSOutgoingMessage(BaseModel):
    """Schema for structuring outgoing token streams and events to the client."""
    type: Literal["token", "audio_chunk", "audio_done", "phoneme", "phoneme_done", "done", "error", "heartbeat"] = Field(..., description="The type of the event")
    content: Optional[str] = Field(None, description="The partial text token or response content")
    data: Optional[str] = Field(None, description="Base64 encoded payload for binary arrays")
    frames: Optional[List[Dict[str, Any]]] = Field(None, description="A sequence of PhonemeFrames serialized")
    message: Optional[str] = Field(None, description="Detailed text description for error events")

    @classmethod
    def token(cls, text: str) -> "WSOutgoingMessage":
        """Utility for creating a token chunk payload."""
        return cls(type="token", content=text)

    @classmethod
    def audio_chunk(cls, b64_data: str) -> "WSOutgoingMessage":
        """Utility for creating an audio payload from base64 string."""
        return cls(type="audio_chunk", data=b64_data)

    @classmethod
    def audio_done(cls) -> "WSOutgoingMessage":
        """Utility for signaling the TTS generation is complete."""
        return cls(type="audio_done")

    @classmethod
    def phoneme(cls, phoneme_frames: List["PhonemeFrame"]) -> "WSOutgoingMessage":
        """Utility for outputting lipsync synchronization frames structurally."""
        return cls(type="phoneme", frames=[frame.model_dump() for frame in phoneme_frames])

    @classmethod
    def phoneme_done(cls) -> "WSOutgoingMessage":
        """Utility for signaling the Rhubarb sequence is finally completed."""
        return cls(type="phoneme_done")

    @classmethod
    def done(cls) -> "WSOutgoingMessage":
        """Utility for signaling the stream generation is complete."""
        return cls(type="done")

    @classmethod
    def error(cls, err_msg: str) -> "WSOutgoingMessage":
        """Utility for creating an error payload."""
        return cls(type="error", message=err_msg)
