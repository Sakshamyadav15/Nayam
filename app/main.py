"""
NAYAM (नयम्) — Application Entrypoint.

FastAPI application factory with middleware, CORS, and route registration.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger

settings = get_settings()

# ── Structured Logging (Phase 4) ─────────────────────────────────────
configure_logging(
    json_output=settings.is_production,
    log_level="INFO" if settings.is_production else "DEBUG",
)
logger = get_logger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.

    Runs startup logic before yielding, and shutdown logic after.
    """
    # Startup
    logger.info(
        "app.startup",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
    )

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info("app.upload_dir_ready", path=settings.UPLOAD_DIR)

    yield

    # Shutdown
    logger.info("app.shutdown", app_name=settings.APP_NAME)


# ── Application Factory ──────────────────────────────────────────────
def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application instance.

    Returns:
        Configured FastAPI application.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Secure AI Co-Pilot for Public Leaders & Administrators",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── Trailing-Slash Normalisation Middleware ──────────────────
    # The Next.js proxy strips trailing slashes (308 redirect) which
    # causes browsers to drop the Authorization header.  This ASGI
    # middleware silently adds the slash before routing so that no
    # 307 redirect is ever issued by FastAPI.  It only touches
    # known root-level API paths, leaving sub-routes untouched.
    from starlette.types import ASGIApp, Receive, Scope, Send

    _ROOT_API_PATHS = frozenset([
        "/api/v1/citizens",
        "/api/v1/issues",
        "/api/v1/documents",
        "/api/v1/dashboard",
        "/api/v1/actions",
        "/api/v1/schedule",
        "/api/v1/drafts",
        "/api/v1/notifications",
        "/api/v1/bhashini",
    ])

    class TrailingSlashMiddleware:
        def __init__(self, inner_app: ASGIApp) -> None:
            self.app = inner_app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] == "http" and scope.get("path") in _ROOT_API_PATHS:
                scope["path"] = scope["path"] + "/"
            await self.app(scope, receive, send)

    app.add_middleware(TrailingSlashMiddleware)

    # ── Request Logging Middleware (Phase 4 – Observability) ───
    from app.monitoring.request_logging import RequestLoggingMiddleware

    app.add_middleware(RequestLoggingMiddleware)

    # ── Rate Limit Middleware (Phase 4 – Security Hardening) ────
    from app.hardening.rate_limiter import RateLimitMiddleware
    from app.core.database import SessionLocal

    app.add_middleware(
        RateLimitMiddleware,
        db_session_factory=SessionLocal,
    )

    # ── CORS Middleware ──────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health Check ─────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    def health_check() -> dict:
        """
        Basic health check endpoint.

        Returns:
            Application health status with version info.
        """
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
        }

    # ── Register Routers ─────────────────────────────────────────
    from app.api.v1.auth import router as auth_router
    from app.api.v1.citizens import router as citizens_router
    from app.api.v1.issues import router as issues_router
    from app.api.v1.documents import router as documents_router
    from app.api.v1.dashboard import router as dashboard_router
    from app.api.v1.agent import router as agent_router
    from app.api.v1.actions import router as actions_router
    from app.api.v1.sync import router as sync_router
    from app.api.v1.offline import router as offline_router
    from app.api.v1.compliance import router as compliance_router
    from app.api.v1.monitoring import router as monitoring_router
    from app.api.v1.hardening import router as hardening_router
    from app.api.v1.stt import router as stt_router
    from app.api.v1.notifications import router as notifications_router
    from app.api.v1.schedule import router as schedule_router
    from app.api.v1.drafts import router as drafts_router
    from app.api.v1.bhashini import router as bhashini_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(citizens_router, prefix="/api/v1/citizens", tags=["Citizens"])
    app.include_router(issues_router, prefix="/api/v1/issues", tags=["Issues"])
    app.include_router(documents_router, prefix="/api/v1/documents", tags=["Documents"])
    app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
    app.include_router(agent_router, prefix="/api/v1/agent", tags=["Agent"])
    app.include_router(actions_router, prefix="/api/v1/actions", tags=["Actions"])
    app.include_router(sync_router, prefix="/api/v1/sync", tags=["Sync"])
    app.include_router(offline_router, prefix="/api/v1/offline", tags=["Offline"])
    app.include_router(compliance_router, prefix="/api/v1/compliance", tags=["Compliance"])
    app.include_router(monitoring_router, prefix="/api/v1/monitoring", tags=["Monitoring"])
    app.include_router(hardening_router, prefix="/api/v1/hardening", tags=["Hardening"])
    app.include_router(stt_router, prefix="/api/v1/stt", tags=["Speech-to-Text"])
    app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
    app.include_router(schedule_router, prefix="/api/v1/schedule", tags=["Schedule"])
    app.include_router(drafts_router, prefix="/api/v1/drafts", tags=["Drafts"])
    app.include_router(bhashini_router, prefix="/api/v1/bhashini", tags=["Bhashini"])

    return app


app = create_app()
