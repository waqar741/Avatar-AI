"""Session manager for tracking token limits and session state on active web sockets."""
import time
import logging
from typing import Dict, Optional
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)


class SessionState:
    """Lightweight representation of state variables on a per-socket basis."""
    def __init__(self) -> None:
        self.start_time: float = time.time()
        self.last_activity: float = time.time()
        self.request_count: int = 0
        self.token_count: int = 0
        
    def is_expired(self) -> bool:
        """Evaluate if the session exceeded maximum bounds or sat idle too long."""
        current = time.time()
        if current - self.start_time > settings.session_max_lifetime_seconds:
            logger.warning("Session exceeded maximum lifetime constraint")
            return True
        if current - self.last_activity > settings.session_idle_timeout_seconds:
            logger.warning("Session exceeded maximum idle boundary")
            return True
        return False
        
    def update_activity(self) -> None:
        """Refresh the idle watchdog."""
        self.last_activity = time.time()


class SessionManager:
    """
    Tracks and isolates active session metrics to prevent memory growth
    and abuse vector tokens. Maps WebSockets to basic operational boundaries.
    """
    def __init__(self) -> None:
        self.sessions: Dict[WebSocket, SessionState] = {}
        self.total_sessions_started: int = 0
        self.active_llm_requests: int = 0

    def get_session(self, websocket: WebSocket) -> Optional[SessionState]:
        """Retrieve existing session state or None if missing."""
        return self.sessions.get(websocket)

    def attach_session(self, websocket: WebSocket) -> None:
        """Create a new session associated with a tracked WebSocket."""
        if websocket not in self.sessions:
            self.sessions[websocket] = SessionState()
            self.total_sessions_started += 1
            logger.debug("Attached new session state")

    def detach_session(self, websocket: WebSocket) -> None:
        """Free memory allocated to the websocket state."""
        if websocket in self.sessions:
            del self.sessions[websocket]
            logger.debug("Detached session state")

    def record_request(self, websocket: WebSocket) -> None:
        """Increment count of incoming LLM completion requests within this session."""
        session = self.get_session(websocket)
        if session:
            session.request_count += 1
            session.update_activity()

    def charge_session_tokens(self, websocket: WebSocket, token_amount: int) -> bool:
        """
        Increment the accumulated tokens count and confirm the cap hasn't been breached.
        
        Returns:
            bool: True if tokens are permitted, False if max_tokens_per_session is exhausted.
        """
        session = self.get_session(websocket)
        if not session:
            return False  # Implicit rejection for untracked websockets
        
        session.token_count += token_amount
        if session.token_count > settings.max_tokens_per_session:
            logger.warning("Session reached its maximum allowed tokens limit", extra={
                "session_tokens": session.token_count,
                "limit": settings.max_tokens_per_session
            })
            return False
        return True


# Global explicit session manager
session_manager = SessionManager()
