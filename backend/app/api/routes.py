"""REST API routes definition."""
import time
from fastapi import APIRouter

from app.models.schemas import HealthResponse
from app.core.connection_manager import manager
from app.core.lifecycle import APP_START_TIME
from app.services.session_manager import session_manager

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint returning system status and metrics.
    
    Returns:
        HealthResponse: Current health status.
    """
    uptime = time.time() - APP_START_TIME
    active = manager.get_active_count()
    
    return HealthResponse(
        status="ok",
        uptime_seconds=uptime,
        active_connections=active,
        active_llm_requests=session_manager.active_llm_requests,
        total_sessions_started=session_manager.total_sessions_started
    )
