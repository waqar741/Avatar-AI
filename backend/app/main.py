"""Main FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.lifecycle import lifespan
from app.api.routes import router as api_router
from app.api.websocket import router as ws_router


def create_app() -> FastAPI:
    """
    Initialize and configure the FastAPI application.
    
    Returns:
        FastAPI: The configured application instance.
    """
    app = FastAPI(
        title="3D AI Avatar Backend",
        description="Production-ready backend foundation for 3D AI Avatar Web Application",
        version="1.0.0",
        lifespan=lifespan
    )

    # Configure CORS - strict bounds loaded from environment
    allowed_origins = settings.allowed_origins

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(api_router)
    app.include_router(ws_router)

    return app


app = create_app()
