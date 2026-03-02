"""Pydantic schemas for API endpoints."""
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for health endpoint response."""
    status: str = Field(..., description="Current status of the system")
    uptime_seconds: float = Field(..., description="Seconds since the application started")
    active_connections: int = Field(..., description="Number of currently active WebSocket connections")
    active_llm_requests: int = Field(..., description="Count of currently generating LLM streams")
    total_sessions_started: int = Field(..., description="Total overall sessions connected over app lifetime")
