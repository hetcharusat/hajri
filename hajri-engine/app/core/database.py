"""
Supabase database connection and helpers.
"""

from supabase import create_client, Client
from functools import lru_cache
from app.config import get_settings


@lru_cache()
def get_supabase_client() -> Client:
    """
    Get Supabase client with service role key.
    Service role bypasses RLS for engine computations.
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )


def get_db() -> Client:
    """Dependency for FastAPI routes."""
    return get_supabase_client()
