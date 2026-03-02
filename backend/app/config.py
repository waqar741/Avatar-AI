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

    # TTS configurations
    tts_enabled: bool = Field(default=True, alias="TTS_ENABLED")
    tts_voice: str = Field(default="en-US-AriaNeural", alias="TTS_VOICE")
    tts_max_buffer_chars: int = Field(default=150, alias="TTS_MAX_BUFFER_CHARS")
    tts_audio_chunk_size: int = Field(default=32768, alias="TTS_AUDIO_CHUNK_SIZE")
    tts_timeout_seconds: int = Field(default=30, alias="TTS_TIMEOUT_SECONDS")

    # Rhubarb Lip Sync configurations
    lipsync_enabled: bool = Field(default=True, alias="LIPSYNC_ENABLED")
    lipsync_max_concurrent_processes: int = Field(default=5, alias="LIPSYNC_MAX_CONCURRENT_PROCESSES")
    lipsync_timeout_seconds: int = Field(default=10, alias="LIPSYNC_TIMEOUT_SECONDS")
    rhubarb_binary_path: str = Field(default="rhubarb", alias="RHUBARB_BINARY_PATH")

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
