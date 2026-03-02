"""Configuration module loading environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    env: str = Field(default="development", alias="ENV")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    groq_api_key: str = Field(..., alias="GROQ_API_KEY")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    max_connections: int = Field(default=100, alias="MAX_CONNECTIONS")
    ws_heartbeat_interval: int = Field(default=30, alias="WS_HEARTBEAT_INTERVAL")
    
    # LLM Service configurations
    groq_model_name: str = Field(default="llama3-8b-8192", alias="GROQ_MODEL_NAME")
    groq_timeout_seconds: int = Field(default=60, alias="GROQ_TIMEOUT_SECONDS")
    max_tokens_per_session: int = Field(default=8000, alias="MAX_TOKENS_PER_SESSION")
    max_tokens_per_request: int = Field(default=1000, alias="MAX_TOKENS_PER_REQUEST")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.env.lower() == "production"


settings = Settings()
