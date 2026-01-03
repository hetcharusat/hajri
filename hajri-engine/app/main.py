"""
HAJRI Engine - Main FastAPI Application

Headless, deterministic computation engine for college attendance.
Optimized for handling multiple concurrent requests.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import pendulum
import asyncio
import logging
import time
from typing import Dict, Any

from app.config import get_settings
from app.core.exceptions import PolicyViolation
from app.routers import snapshots, attendance, predictions, engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("hajri-engine")

# Concurrent request tracking
request_stats: Dict[str, Any] = {
    "total_requests": 0,
    "active_requests": 0,
    "peak_concurrent": 0,
    "errors": 0,
    "started_at": None
}


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """Track concurrent requests and timing."""
    
    async def dispatch(self, request: Request, call_next):
        request_stats["total_requests"] += 1
        request_stats["active_requests"] += 1
        request_stats["peak_concurrent"] = max(
            request_stats["peak_concurrent"], 
            request_stats["active_requests"]
        )
        
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            request_stats["errors"] += 1
            raise
        finally:
            request_stats["active_requests"] -= 1
            duration = time.perf_counter() - start_time
            if duration > 1.0:  # Log slow requests
                logger.warning(f"Slow request: {request.method} {request.url.path} took {duration:.2f}s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan event handler for startup/shutdown."""
    # Startup
    settings = get_settings()
    request_stats["started_at"] = pendulum.now("UTC").isoformat()
    
    logger.info("🚀 HAJRI Engine starting...")
    logger.info(f"   Debug mode: {settings.debug}")
    logger.info(f"   Dev mode: {settings.dev_mode}")
    logger.info(f"   Timezone: {settings.default_timezone}")
    logger.info(f"   Required attendance: {settings.default_required_percentage}%")
    
    yield  # App runs here
    
    # Shutdown
    logger.info("👋 HAJRI Engine shutting down...")
    logger.info(f"   Total requests served: {request_stats['total_requests']}")
    logger.info(f"   Peak concurrent: {request_stats['peak_concurrent']}")
    logger.info(f"   Errors: {request_stats['errors']}")


# Create FastAPI app with lifespan
app = FastAPI(
    title="HAJRI Engine",
    description="Headless attendance computation engine for college attendance tracking",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# GZip compression for responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request tracking middleware
app.add_middleware(RequestTrackingMiddleware)

# CORS middleware - explicitly list origins for credentials support
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server (test portal)
        "http://localhost:5174",   # Admin portal
        "http://localhost:3000",   # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        # Production origins
        "https://hajri-admin.netlify.app",
        "https://hajri-admin.vercel.app",
        "https://hajri-engine.onrender.com",
        "https://hajri-x8ag.onrender.com",
        # Allow any Vercel preview URLs
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(PolicyViolation)
async def policy_violation_handler(request: Request, exc: PolicyViolation):
    """Handle policy violations with structured response."""
    return JSONResponse(
        status_code=400,
        content=exc.to_dict()
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unexpected errors."""
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": str(exc) if get_settings().debug else "An unexpected error occurred",
            "path": str(request.url.path)
        }
    )


# Include routers
app.include_router(snapshots.router)
app.include_router(attendance.router)
app.include_router(predictions.router)
app.include_router(engine.router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API info."""
    settings = get_settings()
    return {
        "service": "HAJRI Engine",
        "version": "0.2.0",
        "status": "running",
        "debug": settings.debug,
        "timestamp": pendulum.now("UTC").isoformat(),
        "docs": "/docs",
        "endpoints": {
            "snapshots": "/snapshots",
            "attendance": "/attendance",
            "predictions": "/predictions",
            "engine": "/engine"
        }
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    settings = get_settings()
    return {
        "status": "healthy",
        "version": "0.2.0",
        "timestamp": pendulum.now("UTC").isoformat(),
        "uptime_since": request_stats["started_at"],
        "stats": {
            "total_requests": request_stats["total_requests"],
            "active_requests": request_stats["active_requests"],
            "peak_concurrent": request_stats["peak_concurrent"],
            "errors": request_stats["errors"]
        },
        "config": {
            "debug": settings.debug,
            "dev_mode": settings.dev_mode,
            "timezone": settings.default_timezone,
            "required_percentage": settings.default_required_percentage
        }
    }


# Render health check endpoint (lightweight)
@app.get("/healthz")
async def healthz():
    """Lightweight health check for Render."""
    return {"status": "ok"}


# Stats endpoint for admin
@app.get("/stats")
async def get_stats():
    """Get server statistics."""
    return {
        "timestamp": pendulum.now("UTC").isoformat(),
        **request_stats
    }
