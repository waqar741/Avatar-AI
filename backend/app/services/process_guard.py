"""Guard restricting unrestrained subprocess forks across the application lifespan."""
import asyncio
import logging
from typing import Callable, Coroutine, Any

from app.config import settings

logger = logging.getLogger(__name__)


class ProcessGuard:
    """
    Acts as a central bottleneck preventing CPU exhaustion vectors. Uses Async Semaphores
    to ensure we never saturate DigitalOcean droplets with rogue CLI processes internally.
    """

    def __init__(self):
        """Initialize global concurrency constraints from strict configuration fields."""
        # Configurable maximum concurrent Rhubarb instances
        self.max_processes = settings.lipsync_max_concurrent_processes
        self.semaphore = asyncio.Semaphore(self.max_processes)

    async def execute_with_guard(self, coro: Callable[[], Coroutine[Any, Any, Any]]) -> Any:
        """
        Awaits a bounded lock before permitting a subprocess execution to commence.
        
        Args:
            coro: An awaitable logic block firing the subprocess.
            
        Returns:
            Any: The generic return type of the executed coroutine.
        """
        try:
            async with self.semaphore:
                return await coro()
        except asyncio.CancelledError:
            # Client disconnects propagate here natively, freeing the semaphore immediately
            logger.warning("LipSync execution job aborted by disconnection while in ProcessGuard queue.")
            raise
        except Exception as e:
            logger.error("ProcessGuard execution fault", extra={"error": str(e)})
            raise


# Global singleton guard 
process_guard = ProcessGuard()
