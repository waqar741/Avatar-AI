"""Security utilities including lightweight rate limiting."""
import time
from typing import Dict, List
from app.config import settings

class WSRateLimiter:
    """In-memory sliding window rate limiter specifically for WebSocket bounds."""
    def __init__(self) -> None:
        # IP -> list of message timestamps
        self._records: Dict[str, List[float]] = {}
        
    def is_allowed(self, ip: str) -> bool:
        """
        Check if an IP is allowed to send a message based on rolling minute bounds.
        Implicitly sweeps stale records out of memory.
        """
        current_time = time.time()
        
        if ip not in self._records:
            self._records[ip] = []
            
        # Time window = 60 seconds
        window_start = current_time - 60.0
        
        # Memory cleanup: discard timestamps older than 60s
        self._records[ip] = [ts for ts in self._records[ip] if ts > window_start]
        
        if len(self._records[ip]) >= settings.rate_limit_ws_messages_per_minute:
            return False
            
        self._records[ip].append(current_time)
        return True

# Singleton instance
ws_rate_limiter = WSRateLimiter()
