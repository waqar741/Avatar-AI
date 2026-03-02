import os
import shutil
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    env: str = Field(default="development", alias="ENV")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    groq_api_key: str = Field(..., alias="GROQ_API_KEY")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    max_connections: int = Field(default=100, alias="MAX_CONNECTIONS")
    ws_heartbeat_interval: int = Field(default=30, alias="WS_HEARTBEAT_INTERVAL")
    
    # Security Configurations
    allowed_origins: list[str] = Field(default=["*"], alias="ALLOWED_ORIGINS")
    rate_limit_ws_connections_per_ip: int = Field(default=5, alias="RATE_LIMIT_WS_CONNECTIONS_PER_IP")
    rate_limit_ws_messages_per_minute: int = Field(default=120, alias="RATE_LIMIT_WS_MESSAGES_PER_MINUTE")
    session_max_lifetime_seconds: int = Field(default=3600, alias="SESSION_MAX_LIFETIME_SECONDS")
    session_idle_timeout_seconds: int = Field(default=300, alias="SESSION_IDLE_TIMEOUT_SECONDS")
    
    # LLM Service configurations
    groq_model_name: str = Field(default="llama3-8b-8192", alias="GROQ_MODEL_NAME")
    groq_timeout_seconds: int = Field(default=60, alias="GROQ_TIMEOUT_SECONDS")
    llm_base_url: str = Field(default="https://api.groq.com/openai/v1", alias="LLM_BASE_URL")
    max_tokens_per_session: int = Field(default=8000, alias="MAX_TOKENS_PER_SESSION")
    max_tokens_per_request: int = Field(default=1000, alias="MAX_TOKENS_PER_REQUEST")
    max_request_duration_seconds: int = Field(default=60, alias="MAX_REQUEST_DURATION_SECONDS")

    # TTS configurations
    tts_enabled: bool = Field(default=True, alias="TTS_ENABLED")
    tts_voice: str = Field(default="en-US-AriaNeural", alias="TTS_VOICE")
    tts_max_buffer_chars: int = Field(default=150, alias="TTS_MAX_BUFFER_CHARS")
    tts_audio_chunk_size: int = Field(default=32768, alias="TTS_AUDIO_CHUNK_SIZE")
    tts_timeout_seconds: int = Field(default=30, alias="TTS_TIMEOUT_SECONDS")
    max_audio_queue_length: int = Field(default=10, alias="MAX_AUDIO_QUEUE_LENGTH")

    # Rhubarb Lip Sync configurations
    lipsync_enabled: bool = Field(default=True, alias="LIPSYNC_ENABLED")
    lipsync_max_concurrent_processes: int = Field(default=5, alias="LIPSYNC_MAX_CONCURRENT_PROCESSES")
    lipsync_timeout_seconds: int = Field(default=10, alias="LIPSYNC_TIMEOUT_SECONDS")
    rhubarb_binary_path: str = Field(default="rhubarb", alias="RHUBARB_BINARY_PATH")
    max_phoneme_frames_per_flush: int = Field(default=1500, alias="MAX_PHONEME_FRAMES_PER_FLUSH")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.env.lower() == "production"

    @model_validator(mode="after")
    def validate_environment(self) -> 'Settings':
        """Enforce hard limits on boot."""
        # Validate API Key is present (not empty)
        if not self.groq_api_key or len(self.groq_api_key.strip()) < 5:
            raise ValueError("GROQ_API_KEY is missing or too short. Provide a valid LLM API key.")
            
        # Validate Rhubarb Binary
        if self.lipsync_enabled:
            # Check if binary is resolvable in path or explicitly exists
            binary_exists = shutil.which(self.rhubarb_binary_path) is not None or os.path.exists(self.rhubarb_binary_path)
            # In local dev users might provide a path relative to root, if neither works fail fast
            if not binary_exists:
                raise ValueError(f"CRITICAL: Rhubarb binary not found at '{self.rhubarb_binary_path}'")
                
        # Production Specific Hardening
        if self.is_production:
            if not self.allowed_origins or self.allowed_origins == ["*"]:
                 raise ValueError("CRITICAL: ALLOWED_ORIGINS must be explicitly restricted in production!")
                 
        return self


settings = Settings()
