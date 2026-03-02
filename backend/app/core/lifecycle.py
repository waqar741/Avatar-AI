"""Application lifespan management for startup and shutdown events."""
import time
import logging
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
    
    yield
    
    logger.info("Application shutting down")
    await manager.close_all()
    logger.info("Shutdown complete")
