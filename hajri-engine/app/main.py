"""
HAJRI Engine - Main FastAPI Application

Headless, deterministic computation engine for college attendance.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pendulum

from app.config import get_settings
from app.core.exceptions import PolicyViolation
from app.routers import snapshots, attendance, predictions, engine


# Create FastAPI app
app = FastAPI(
    title="HAJRI Engine",
    description="Headless attendance computation engine for college attendance tracking",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware - explicitly list origins for credentials support
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server (test portal)
        "http://localhost:3000",  # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
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
        "version": "0.1.0",
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


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    settings = get_settings()
    print(f"🚀 HAJRI Engine starting...")
    print(f"   Debug mode: {settings.debug}")
    print(f"   Timezone: {settings.default_timezone}")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    print("👋 HAJRI Engine shutting down...")
