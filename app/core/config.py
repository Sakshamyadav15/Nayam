"""
NAYAM (नयम्) — Core Configuration Module.

Loads all application settings from environment variables using Pydantic Settings.
Supports separate dev/prod configurations via APP_ENV.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "NAYAM"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://nayam_user:nayam_password@localhost:5432/nayam_db"

    # ── JWT Authentication ───────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE_ME"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── File Uploads ─────────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # ── CORS ─────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    # ── Phase 2: AI / Agent Configuration ────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "tfidf-local"
    EMBEDDING_DIMENSIONS: int = 1
    AGENT_TIMEOUT_SECONDS: int = 30
    AGENT_MAX_CONTEXT_MESSAGES: int = 20
    ACTION_EXPIRY_HOURS: int = 24

    # ── Bhashini (Gov India AI Language Services — Dhruva API) ─────
    BHASHINI_API_KEY: str = ""           # Dhruva INFERENCE_API_KEY (Authorization header)
    BHASHINI_INFERENCE_URL: str = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

    # ── Phase 3: Predictive Governance ───────────────────────────
    RISK_COMPUTATION_INTERVAL_HOURS: int = 6
    ANOMALY_DEVIATION_THRESHOLD: float = 2.0
    PREDICTION_WINDOW_DAYS: int = 7
    RISK_MODEL_VERSION: str = "v1.0"

    # ── Phase 3: Geo-Spatial / PostGIS ───────────────────────────
    POSTGIS_ENABLED: bool = False
    GEO_CLUSTER_RADIUS_METERS: float = 500.0
    HEATMAP_GRID_SIZE: int = 50

    # ── Phase 3: Zero-Knowledge Privacy ──────────────────────────
    ENCRYPTION_KEY: str = ""           # Fernet key (generate via cryptography.fernet.Fernet.generate_key)
    PII_FIELDS: str = "contact_number,email"  # comma-separated

    # ── Phase 3: Autonomous Task Recommendations ─────────────────
    RECOMMENDATION_EXPIRY_HOURS: int = 72
    MAX_RECOMMENDATIONS_PER_WARD: int = 10

    # ── Phase 3: Observability ───────────────────────────────────
    AUDIT_LOG_RETENTION_DAYS: int = 365
    ENABLE_AUDIT_LOGGING: bool = True

    # ── Phase 4: Offline-First & Edge Sync ────────────────────────
    OFFLINE_MODE_ENABLED: bool = False
    SYNC_INTERVAL_SECONDS: int = 30
    SYNC_MAX_RETRIES: int = 3
    SYNC_BATCH_SIZE: int = 50
    DEFAULT_NODE_ID: str = "central"

    # ── Phase 4: Security Hardening ──────────────────────────────
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    ENFORCE_HTTPS: bool = False
    TOKEN_ROTATION_ENABLED: bool = False
    TOKEN_ROTATION_DAYS: int = 7

    # ── Phase 4: Compliance ──────────────────────────────────────
    COMPLIANCE_EXPORT_DIR: str = "./exports"
    COMPLIANCE_RETENTION_DAYS: int = 730

    # ── Phase 4: Monitoring & Performance ────────────────────────
    ENABLE_PERFORMANCE_TRACKING: bool = True
    METRICS_RETENTION_DAYS: int = 90
    HEALTH_CHECK_INTERVAL_SECONDS: int = 30

    @property
    def is_production(self) -> bool:
        """Check if the application is running in production mode."""
        return self.APP_ENV == "production"

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def max_upload_bytes(self) -> int:
        """Convert MB limit to bytes."""
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings singleton.

    Returns the application settings, loaded once and cached for performance.
    """
    return Settings()
