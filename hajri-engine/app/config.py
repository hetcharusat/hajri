"""
Configuration settings for HAJRI Engine.
Loaded from environment variables.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment."""
    
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    
    # App settings
    debug: bool = False
    dev_mode: bool = True  # Allow test requests without real JWT
    log_level: str = "INFO"
    
    # Timezone
    default_timezone: str = "Asia/Kolkata"
    
    # Attendance defaults
    default_required_percentage: float = 75.0
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
