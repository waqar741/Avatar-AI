"""Service layer for OpenAI-compatible LLM API streaming communication."""
import json
import logging
from typing import AsyncGenerator
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMStreamingService:
    """Consumes any OpenAI-compatible chat completions API, yielding granular tokens."""
    
    def __init__(self, http_client: httpx.AsyncClient):
        """
        Initialize with the application's shared HTTP client.

        Args:
            http_client: the shared connection pool client.
        """
        self.http_client = http_client
        self.model = settings.llm_model
        self.timeout = settings.llm_timeout_seconds
        self.url = f"{settings.llm_base_url.rstrip('/')}/v1/chat/completions"

    async def stream_completion(self, message: str) -> AsyncGenerator[str, None]:
        """
        Stream LLM completions incrementally.
        
        Args:
            message: The user's input string message.
            
        Yields:
            str: Partial string tokens from the model.
        """
        headers = {
            "Content-Type": "application/json"
        }

        # Conditionally add Authorization header if an API key is configured
        if settings.llm_api_key:
            headers["Authorization"] = f"Bearer {settings.llm_api_key}"
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": message}],
            "stream": True,
            "max_tokens": settings.llm_max_tokens_per_request
        }
        
        try:
            async with self.http_client.stream("POST", self.url, headers=headers, json=payload, timeout=self.timeout) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    logger.error(
                        "LLM API Error", 
                        extra={"status": response.status_code, "body": error_body.decode('utf-8', errors='ignore'), "url": self.url}
                    )
                    raise RuntimeError(f"LLM Provider Error: HTTP {response.status_code}")
                
                # Memory efficient line iteration directly from sockets
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[len("data: "):].strip()
                        if data_str == "[DONE]":
                            break
                            
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {}).get("content")
                                if delta:
                                    yield delta
                        except json.JSONDecodeError:
                            logger.debug("Failed to decode JSON chunk from LLM API", extra={"chunk": data_str})
                            continue
                            
        except httpx.TimeoutException as e:
            logger.error("LLM API Timeout", extra={"error": str(e), "url": self.url})
            raise RuntimeError("LLM Request Timeout") from e
        except Exception as e:
            logger.error("Unexpected error interacting with LLM API", exc_info=True)
            raise
