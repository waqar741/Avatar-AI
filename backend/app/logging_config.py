"""Structured logging configuration."""
import logging
import sys
from pythonjsonlogger import jsonlogger

from app.config import settings


def setup_logging() -> None:
    """Initialize structured JSON logging for the application."""
    logger = logging.getLogger()
    logger.setLevel(settings.log_level.upper())

    # Clear existing handlers to prevent duplicates
    if logger.handlers:
        logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Disable excessive Uvicorn access logs in production
    if settings.is_production:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    logging.info(
        "Logging configured",
        extra={"env": settings.env, "log_level": settings.log_level}
    )
