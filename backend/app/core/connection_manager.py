"""WebSocket connection manager for handling active client sessions."""
import time
import logging
from typing import Dict
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections to prevent memory limits and handle broadcasting."""

    def __init__(self) -> None:
        """Initialize the connection manager."""
        self.active_connections: Dict[WebSocket, float] = {}

    async def connect(self, websocket: WebSocket) -> bool:
        """
        Accept and track a new WebSocket connection.
        
        Args:
            websocket: The incoming WebSocket connection.

        Returns:
            bool: True if connection is accepted, False if max connections reached.
        """
        if len(self.active_connections) >= settings.max_connections:
            logger.warning(
                "Max connections reached. Rejecting connection.",
                extra={"max_connections": settings.max_connections}
            )
            return False

        await websocket.accept()
        self.active_connections[websocket] = time.time()
        logger.info(
            "Client connected",
            extra={"active_connections": len(self.active_connections)}
        )
        return True

    def disconnect(self, websocket: WebSocket) -> None:
        """
        Remove a WebSocket connection from active tracked sessions.
        
        Args:
            websocket: The disconnected WebSocket.
        """
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            logger.info(
                "Client disconnected",
                extra={"active_connections": len(self.active_connections)}
            )

    async def broadcast(self, message: str) -> None:
        """
        Send a text message to all active connections.
        
        Args:
            message: The string message to broadcast.
        """
        stale_connections = []
        for connection in self.active_connections.keys():
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error("Failed to broadcast to connection", extra={"error": str(e)})
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(stale)

    async def close_all(self) -> None:
        """Gracefully close all active connections during shutdown."""
        connections = list(self.active_connections.keys())
        for connection in connections:
            try:
                await connection.close(code=1001, reason="Server shutting down")
            except Exception as e:
                logger.error("Error closing connection during shutdown", extra={"error": str(e)})
        self.active_connections.clear()
        logger.info("All connections closed")

    def get_active_count(self) -> int:
        """Return the number of active connections."""
        return len(self.active_connections)


# Global singleton for the connection manager
manager = ConnectionManager()
