"""REST API routes definition."""
import time
from fastapi import APIRouter

from app.models.schemas import HealthResponse
from app.core.connection_manager import manager
from app.core.lifecycle import APP_START_TIME

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
        active_connections=active
    )
