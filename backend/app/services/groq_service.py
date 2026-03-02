"""Service layer bridging external Groq LLM API communication."""
import json
import logging
from typing import AsyncGenerator
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class GroqStreamingService:
    """Consumes the Groq completions API yielding granular tokens to avert memory buildup."""
    
    def __init__(self, http_client: httpx.AsyncClient):
        """
        Initialize with the application's shared HTTP client.

        Args:
            http_client: the shared connection pool client.
        """
        self.http_client = http_client
        self.api_key = settings.groq_api_key
        self.model = settings.groq_model_name
        self.timeout = settings.groq_timeout_seconds
        # Warning: ensure your API key points directly to Groq. 
        # Using typical OpenAI compatible structure.
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    async def stream_completion(self, message: str) -> AsyncGenerator[str, None]:
        """
        Stream LLM completions incrementally.
        
        Args:
            message: The user's input string message.
            
        Yields:
            str: Partial string tokens from the model.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": message}],
            "stream": True,
            "max_tokens": settings.max_tokens_per_request
        }
        
        try:
            # We enforce passing a specific request timeout alongside the client defaults
            async with self.http_client.stream("POST", self.url, headers=headers, json=payload, timeout=self.timeout) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    logger.error(
                        "Groq API Error", 
                        extra={"status": response.status_code, "body": error_body.decode('utf-8', errors='ignore')}
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
                            logger.debug("Failed to decode JSON chunk from Groq API", extra={"chunk": data_str})
                            continue
                            
        except httpx.TimeoutException as e:
            logger.error("Groq API Timeout encountered", extra={"error": str(e)})
            raise RuntimeError("LLM Request Timeout") from e
        except Exception as e:
            logger.error("Unexpected error interacting with Groq API", exc_info=True)
            raise
