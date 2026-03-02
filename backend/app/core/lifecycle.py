"""Application lifespan management for startup and shutdown events."""
import time
import logging
import httpx
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI

from app.core.connection_manager import manager
from app.logging_config import setup_logging

logger = logging.getLogger(__name__)

# Track application start time for uptime calculation
APP_START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manage FastAPI application lifecycle.
    
    Args:
        app: The FastAPI application instance.
    """
    setup_logging()
    logger.info("Application starting up")
    
    # Initialize shared Async HTTP client with strict timeouts
    timeout = httpx.Timeout(settings.groq_timeout_seconds, connect=10.0)
    limits = httpx.Limits(max_keepalive_connections=settings.max_connections, max_connections=settings.max_connections)
    # Using context guard explicitly without 'async with' scoping out before yield
    app.state.http_client = httpx.AsyncClient(timeout=timeout, limits=limits)
    
    yield
    
    logger.info("Application shutting down")
    await app.state.http_client.aclose()
    await manager.close_all()
    logger.info("Shutdown complete")
