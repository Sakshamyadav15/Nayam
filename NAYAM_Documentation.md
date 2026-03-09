# NAYAM (नयम्) — Complete Implementation Documentation

> **AI Co-Pilot Platform for Public Leaders & Municipal Administrators**
>
> Version 2.0.0 | Python 3.13 | FastAPI 0.104 | Next.js 16 | Groq LLM | FAISS + Sentence-Transformers RAG | Whisper STT | Bhashini Dhruva API

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Backend Implementation](#3-backend-implementation)
   - 3.1 [Application Entry Point](#31-application-entry-point)
   - 3.2 [Configuration System](#32-configuration-system)
   - 3.3 [Database Layer](#33-database-layer)
   - 3.4 [Authentication & Security](#34-authentication--security)
   - 3.5 [Data Models (ORM)](#35-data-models-orm)
   - 3.6 [Pydantic Schemas](#36-pydantic-schemas)
   - 3.7 [Repository Pattern](#37-repository-pattern)
   - 3.8 [Service Layer](#38-service-layer)
   - 3.9 [API Routers](#39-api-routers)
4. [AI & Intelligence Layer](#4-ai--intelligence-layer)
   - 4.1 [Multi-Agent Framework](#41-multi-agent-framework)
   - 4.2 [Agent Routing](#42-agent-routing)
   - 4.3 [Specialized Agents](#43-specialized-agents)
   - 4.4 [RAG Pipeline](#44-rag-pipeline)
   - 4.5 [Document Processing](#45-document-processing)
   - 4.6 [Conversation Memory](#46-conversation-memory)
   - 4.7 [Agent Orchestration](#47-agent-orchestration)
   - 4.8 [Speech-to-Text (STT) Pipeline](#48-speech-to-text-stt-pipeline)
   - 4.9 [AI Draft Generator](#49-ai-draft-generator)
   - 4.10 [Bhashini Language Services](#410-bhashini-language-services)
5. [Human-in-the-Loop (HITL) Approval System](#5-human-in-the-loop-hitl-approval-system)
6. [Frontend Implementation](#6-frontend-implementation)
   - 6.1 [Technology Stack](#61-technology-stack)
   - 6.2 [Pages & Components](#62-pages--components)
   - 6.3 [API Integration Layer](#63-api-integration-layer)
   - 6.4 [Geo-Analytics & Risk Scoring](#64-geo-analytics--risk-scoring)
   - 6.5 [Predictive Intelligence](#65-predictive-intelligence)
7. [Platform Subsystems](#7-platform-subsystems)
   - 7.1 [Compliance & Audit](#71-compliance--audit)
   - 7.2 [Monitoring & Observability](#72-monitoring--observability)
   - 7.3 [Rate Limiting & Security Hardening](#73-rate-limiting--security-hardening)
   - 7.4 [Offline-First & Edge Sync](#74-offline-first--edge-sync)
   - 7.5 [Schedule Management](#75-schedule-management)
   - 7.6 [Notification System](#76-notification-system)
8. [Database Design](#8-database-design)
9. [API Reference](#9-api-reference)
10. [Deployment](#10-deployment)
11. [Testing](#11-testing)
12. [Configuration Reference](#12-configuration-reference)

---

## 1. Executive Summary

**NAYAM (नयम्)** is an AI-powered governance platform designed to serve as an intelligent co-pilot for municipal leaders, administrative staff, and data analysts. It addresses the operational challenges of public administration — tracking citizen grievances, managing policy documents, allocating departmental resources, and making data-driven decisions — through a unified platform backed by Large Language Models (LLMs) and a Retrieval-Augmented Generation (RAG) pipeline.

### Core Design Principles

1. **AI-Augmented, Not AI-Autonomous** — Every AI-proposed action requires explicit human approval (Human-in-the-Loop). The system advises; humans decide.
2. **Multi-Agent Specialization** — Three domain-specific agents (Policy, Citizen, Operations) each trained with contextual prompts and routed via intent classification.
3. **Document-Grounded Intelligence** — All LLM responses are grounded in uploaded governance documents via RAG (FAISS + sentence-transformers dense embeddings), reducing hallucination and improving factual accuracy.
4. **Voice-First Accessibility** — Fully implemented STT pipeline (Groq Whisper -> local faster-whisper -> OpenAI) and Bhashini Dhruva API integration for 12+ Indian languages enables voice input for queries, document creation, and issue filing in any supported Indian language.
5. **AI Content Generation** — LLM-powered draft generator produces 9 types of government documents (speeches, responses, circulars, etc.) with template prompts, tone/audience control, and versioned editing.
6. **Enterprise-Grade Security** — JWT authentication, role-based access control (RBAC), per-IP rate limiting, structured audit logging, and encrypted PII fields.

### What the Platform Does

| Feature | Description |
|---------|-------------|
| **Citizen Management** | Full CRUD for citizen records with ward-based organization |
| **Issue Tracking** | Grievance lifecycle management (Open → In Progress → Closed) with priority levels and department assignment |
| **Document Intelligence** | Upload PDF/DOCX/TXT, auto-extract text, AI-summarize, and index for RAG retrieval |
| **AI Chat** | Natural language queries answered by specialized agents with document-grounded responses |
| **HITL Approvals** | Review, approve, or reject every AI-proposed action before execution |
| **Speech-to-Text** | Multi-provider STT pipeline: transcribe, classify content type, and intelligently ingest voice into the platform |
| **Bhashini Language Services** | Full Bhashini Dhruva API integration: ASR, TTS, neural machine translation, hybrid LLM + keyword text classification, and summarization for 12+ Indian languages |
| **Voice Intelligence** | Record voice in any Indian language, auto-classify as question/issue/document via hybrid classifier, user can override classification, and route to the appropriate action |
| **Multi-Language Issue Creation** | File grievances via voice in any Indian language with Bhashini ASR and optional auto-translation to English |
| **AI Draft Generator** | LLM-powered generation of 9 document types with template system prompts, tone/audience controls, versioned editing, and publish workflow |
| **Schedule Management** | Full calendar/event system with 7 event types, 3 priority levels, status lifecycle, department/ward assignment, and 48-hour smart notifications |
| **Smart Notifications** | Aggregated feed from 4 sources: pending approvals, high-priority issues, recent documents, upcoming events |
| **Dashboards** | Real-time aggregated statistics by department, status, ward |
| **Geo-Analytics** | Ward-level risk heatmaps combining issue volume and severity |
| **Predictive Insights** | 4-week forecasting of issue trends per ward with anomaly detection |

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│                                                                  │
│   Next.js 16 + React 19 + TypeScript 5.7                        │
│   ┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────────────────┐   │
│   │Dashboard │ │Citizens│ │Documents │ │Intelligence (Chat)│   │
│   └──────────┘ └────────┘ └──────────┘ └───────────────────┘   │
│   ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐           │
│   │Issues    │ │Approvals│ │Geo-Analyt│ │Predictive│           │
│   └──────────┘ └────────┘ └──────────┘ └──────────┘           │
│   ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐           │
│   │Schedule  │ │Drafts  │ │Compliance│ │Monitor   │           │
│   └──────────┘ └────────┘ └──────────┘ └──────────┘           │
│   ┌──────────┐ 🔔 Notification Bell                            │
│   │Settings  │                                                 │
│   └──────────┘                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/REST (JSON)
┌─────────────────────────────▼───────────────────────────────────┐
│                       APPLICATION LAYER                          │
│                                                                  │
│  ┌─── FastAPI Application ──────────────────────────────────┐   │
│  │                                                           │   │
│  │  Middleware Stack:                                        │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ CORS → TrailingSlash → RateLimit → RequestLogging  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                           │   │
│  │  12 API Routers + 5 New Routers = 17 Total:                │   │
│  │  auth │ citizens │ issues │ documents │ dashboard        │   │
│  │  agent │ actions │ stt │ notifications │ schedule        │   │
│  │  drafts │ sync │ offline │ compliance │ monitoring       │   │
│  │  hardening │ bhashini                                      │   │
│  │                                                           │   │
│  │  Service Layer → Repository Layer → SQLAlchemy ORM       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Intelligence Layer ───────────────────────────────────┐   │
│  │                                                           │   │
│  │  ┌────────────┐    ┌─────────────────────────────────┐   │   │
│  │  │AgentRouter │──▶│ PolicyAgent │ CitizenAgent │ Ops │   │   │
│  │  │(Intent     │    └──────────────────┬──────────────┘   │   │
│  │  │ Scoring)   │                       │                   │   │
│  │  └────────────┘                       ▼                   │   │
│  │                              ┌─────────────────┐          │   │
│  │                              │  Groq LLM API   │          │   │
│  │                              │ (llama-3.3-70b) │          │   │
│  │                              └─────────────────┘          │   │
│  │                                                           │   │
│  │  ┌─── RAG Pipeline ────────────────────────────────┐     │   │
│  │  │ Upload → extract_text → chunk_text → store      │     │   │
│  │  │ Query → FAISS IndexFlatIP → dense cosine sim    │     │   │
│  │  │ Model: all-MiniLM-L6-v2 (384-dim embeddings)    │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                           │   │
│  │  ┌─── STT Pipeline (Fully Implemented) ────────────┐     │   │
│  │  │ Mic -> Audio -> Groq Whisper / faster-whisper     │     │   │
│  │  │ Transcript -> Classify -> Ingest -> RAG Store     │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                           │   │
│  │  ┌─── Bhashini Dhruva API ─────────────────────────┐     │   │
│  │  │ ASR / TTS / NMT / Classify / Summarize           │     │   │
│  │  │ 12+ Indian Languages (Hindi, Tamil, Bengali...)   │     │   │
│  │  │ Hybrid LLM + Keyword Classification Fallback      │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                        DATA LAYER                                │
│                                                                  │
│  SQLite (development) / PostgreSQL 16 (production)              │
│                                                                  │
│  Tables: users, citizens, issues, documents, conversations,     │
│  embeddings, action_requests, events, drafts, + subsystem tables │
│                                                                  │
│  File Storage: ./uploads/ (UUID-named files)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Phased Development

The platform was built across four engineering phases:

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **Phase 1** | Core Infrastructure & Data Spine | FastAPI app, SQLAlchemy ORM, JWT auth, CRUD for citizens/issues/documents, dashboard aggregation, 518-test suite |
| **Phase 2** | AI Intelligence & Human-in-the-Loop | Multi-agent framework, Groq LLM integration, RAG pipeline (TF-IDF), conversation memory, action approval workflow |
| **Phase 3** | Predictive Governance & Privacy | Risk scoring, anomaly detection, geo-spatial analytics, zero-knowledge privacy stubs, recommendation engine |
| **Phase 4** | Production Hardening | Offline-first sync, rate limiting, compliance/audit, monitoring/metrics, Docker deployment, security hardening |

---

## 3. Backend Implementation

### 3.1 Application Entry Point

**File:** `app/main.py`

The application factory creates a FastAPI instance with:

1. **CORS Middleware** — Configurable allowed origins (default: `localhost:3000`)
2. **Trailing Slash Middleware** — Custom middleware that transparently handles `/api/v1/citizens` and `/api/v1/citizens/` identically, preventing 307 redirects that break REST clients
3. **Rate Limiting Middleware** — Per-IP sliding window throttle
4. **Request Logging Middleware** — X-Request-ID correlation for distributed tracing
5. **Structured Logging** — JSON output in production via structlog

**Router Registration** -- 17 API routers are mounted under `/api/v1/`:

```python
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Authentication"])
app.include_router(citizens.router,      prefix="/api/v1/citizens",      tags=["Citizens"])
app.include_router(issues.router,        prefix="/api/v1/issues",        tags=["Issues"])
app.include_router(documents.router,     prefix="/api/v1/documents",     tags=["Documents"])
app.include_router(dashboard.router,     prefix="/api/v1/dashboard",     tags=["Dashboard"])
app.include_router(agent.router,         prefix="/api/v1/agent",         tags=["AI Agent"])
app.include_router(actions.router,       prefix="/api/v1/actions",       tags=["Actions"])
app.include_router(stt.router,           prefix="/api/v1/stt",           tags=["Speech-to-Text"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(schedule.router,      prefix="/api/v1/schedule",      tags=["Schedule"])
app.include_router(drafts.router,        prefix="/api/v1/drafts",        tags=["Drafts"])
app.include_router(sync.router,          prefix="/api/v1/sync",          tags=["Sync"])
app.include_router(offline.router,       prefix="/api/v1/offline",       tags=["Offline"])
app.include_router(compliance.router,    prefix="/api/v1/compliance",    tags=["Compliance"])
app.include_router(monitoring.router,    prefix="/api/v1/monitoring",    tags=["Monitoring"])
app.include_router(hardening.router,     prefix="/api/v1/hardening",     tags=["Hardening"])
app.include_router(bhashini.router,     prefix="/api/v1/bhashini",     tags=["Bhashini"])
```

**Startup Events:**
- Force-create all database tables via `Base.metadata.create_all(bind=engine)`
- Ensure upload directory exists
- Log startup configuration

**Health Endpoint:** `GET /health` returns `{"status": "ok", "version": "1.0.0"}`

### 3.2 Configuration System

**File:** `app/core/config.py`

Uses **Pydantic Settings** (`BaseSettings`) to load all configuration from environment variables with `.env` file support.

**Configuration Groups (50+ settings):**

| Group | Settings | Description |
|-------|----------|-------------|
| Application | `APP_NAME`, `APP_VERSION`, `APP_ENV`, `DEBUG` | Application identity and mode |
| Database | `DATABASE_URL` | SQLAlchemy connection string |
| JWT | `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Token configuration |
| File Upload | `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB` | Upload handling |
| CORS | `ALLOWED_ORIGINS` | Comma-separated origin list |
| AI/Agent | `GROQ_API_KEY`, `GROQ_MODEL`, `EMBEDDING_MODEL`, `AGENT_TIMEOUT_SECONDS`, `AGENT_MAX_CONTEXT_MESSAGES`, `ACTION_EXPIRY_HOURS` | LLM and agent behavior |
| Predictive | `RISK_COMPUTATION_INTERVAL_HOURS`, `ANOMALY_DEVIATION_THRESHOLD`, `PREDICTION_WINDOW_DAYS` | Risk scoring parameters |
| Geo-Spatial | `POSTGIS_ENABLED`, `GEO_CLUSTER_RADIUS_METERS`, `HEATMAP_GRID_SIZE` | Map/heatmap configuration |
| Privacy | `ENCRYPTION_KEY`, `PII_FIELDS` | Zero-knowledge privacy |
| Offline/Sync | `OFFLINE_MODE_ENABLED`, `SYNC_INTERVAL_SECONDS`, `SYNC_BATCH_SIZE` | Edge sync |
| Rate Limiting | `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS` | Throttle configuration |
| Compliance | `COMPLIANCE_EXPORT_DIR`, `COMPLIANCE_RETENTION_DAYS` | Audit trail |
| Monitoring | `ENABLE_PERFORMANCE_TRACKING`, `METRICS_RETENTION_DAYS` | Metrics |

**Computed Properties:**
- `is_production` → `True` when `APP_ENV == "production"`
- `cors_origins` → Parses comma-separated string into `List[str]`
- `max_upload_bytes` → Converts MB to bytes

**Caching:** `@lru_cache()` on `get_settings()` ensures settings are loaded once.

### 3.3 Database Layer

**File:** `app/core/database.py`

**Engine Configuration:**
- **SQLite (dev):** `check_same_thread=False` for FastAPI async compatibility; no connection pooling (unsupported)
- **PostgreSQL (prod):** `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`

**Session Management:**
- `SessionLocal` — `sessionmaker(autocommit=False, autoflush=False)`
- `get_db()` — FastAPI dependency generator that yields a session, rolls back on exception, and closes in `finally`

**Declarative Base:**
- `Base(DeclarativeBase)` — All ORM models inherit from this. Tables auto-created on startup.

### 3.4 Authentication & Security

**File:** `app/core/security.py`

#### Password Hashing
- **Library:** `passlib[bcrypt]`
- `hash_password(password)` → Returns bcrypt hash
- `verify_password(plain, hashed)` → Returns boolean

#### JWT Token Management
- **Library:** `python-jose[cryptography]`
- `create_access_token(data, expires_delta)` → Encodes payload with `exp` claim using HS256
- `decode_access_token(token)` → Decodes and validates; returns `None` on `JWTError`

#### RBAC (Role-Based Access Control)
- **Roles:** `Leader` (full access), `Staff` (CRUD, no admin), `Analyst` (read-only)
- `get_current_user` dependency — Extracts `Authorization: Bearer <token>`, decodes JWT, fetches user from DB
- `require_roles([UserRole.LEADER, UserRole.STAFF])` — Dependency factory that restricts endpoints to specific roles

### 3.5 Data Models (ORM)

All models use UUID primary keys and timezone-aware `DateTime` columns.

#### User Model (`app/models/user.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, auto-generated |
| `name` | String(255) | NOT NULL |
| `email` | String(255) | UNIQUE, NOT NULL, indexed |
| `password_hash` | String(512) | NOT NULL |
| `role` | Enum(Leader/Staff/Analyst) | NOT NULL, default Staff |
| `created_at` | DateTime(tz) | NOT NULL, auto-set |

**Relationships:** `documents` (one-to-many → Document)

#### Citizen Model (`app/models/citizen.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | String(255) | NOT NULL, indexed |
| `contact_number` | String(20) | NOT NULL |
| `ward` | String(100) | NOT NULL, indexed |
| `created_at` | DateTime(tz) | NOT NULL |

**Relationships:** `issues` (one-to-many → Issue, cascade delete)

#### Issue Model (`app/models/issue.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `citizen_id` | UUID | FK → citizens.id, CASCADE, indexed |
| `department` | String(255) | NOT NULL, indexed |
| `description` | Text | NOT NULL |
| `status` | Enum(Open/In Progress/Closed) | NOT NULL, default Open, indexed |
| `priority` | Enum(Low/Medium/High) | NOT NULL, default Medium, indexed |
| `latitude` | Float | nullable (Phase 2 geo) |
| `longitude` | Float | nullable (Phase 2 geo) |
| `location_description` | String(500) | nullable |
| `created_at` | DateTime(tz) | NOT NULL, indexed |
| `updated_at` | DateTime(tz) | NOT NULL, auto-updated |

**Indexes:** department, status, priority, created_at, (latitude, longitude) composite

#### Document Model (`app/models/document.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `title` | String(500) | NOT NULL |
| `uploaded_by` | UUID | FK → users.id, SET NULL |
| `file_path` | String(1024) | NOT NULL |
| `extracted_text` | Text | nullable |
| `summary` | Text | nullable |
| `created_at` | DateTime(tz) | NOT NULL, indexed |

#### Conversation Model (`app/models/conversation.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `session_id` | UUID | NOT NULL, indexed |
| `user_id` | UUID | NOT NULL |
| `role` | Enum(USER/ASSISTANT/SYSTEM) | NOT NULL |
| `content` | Text | NOT NULL |
| `agent_name` | String(100) | nullable |
| `created_at` | DateTime(tz) | NOT NULL |

**Composite Indexes:** `(session_id, created_at)` for efficient history retrieval

#### Embedding Model (`app/models/embedding.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `source_type` | String(50) | NOT NULL (e.g. "document") |
| `source_id` | UUID | NOT NULL |
| `content_hash` | String(64) | NOT NULL (SHA-256 for dedup) |
| `chunk_index` | Integer | NOT NULL, default 0 |
| `chunk_text` | Text | NOT NULL |
| `embedding` | JSON | NOT NULL (vector as list of floats) |
| `dimensions` | Integer | NOT NULL |
| `model_name` | String(100) | nullable |
| `created_at` | DateTime(tz) | NOT NULL |

**Indexes:** `(source_type, source_id)` composite, `content_hash` for deduplication

#### ActionRequest Model (`app/models/action_request.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `session_id` | UUID | NOT NULL |
| `agent_name` | String(100) | NOT NULL |
| `action_type` | String(100) | NOT NULL |
| `description` | Text | NOT NULL |
| `payload` | JSON | nullable |
| `status` | Enum(PENDING/APPROVED/REJECTED/EXPIRED) | NOT NULL, default PENDING |
| `requested_by` | UUID | NOT NULL |
| `reviewed_by` | UUID | nullable |
| `review_note` | Text | nullable |
| `created_at` | DateTime(tz) | NOT NULL |
| `reviewed_at` | DateTime(tz) | nullable |

#### Event Model (`app/models/event.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `title` | String(255) | NOT NULL |
| `description` | Text | nullable |
| `event_type` | Enum(Meeting/Hearing/Site Visit/Deadline/Review/Public Event/Other) | NOT NULL |
| `status` | Enum(Scheduled/In Progress/Completed/Cancelled) | NOT NULL, default Scheduled |
| `priority` | Enum(Low/Medium/High) | NOT NULL, default Medium |
| `start_time` | DateTime(tz) | NOT NULL |
| `end_time` | DateTime(tz) | nullable |
| `location` | String(500) | nullable |
| `attendees` | Text | nullable (comma-separated) |
| `department` | String(255) | nullable, indexed |
| `ward` | String(100) | nullable |
| `reminder_minutes` | Integer | default 30 |
| `is_all_day` | Boolean | default False |
| `created_by` | UUID | FK → users.id |
| `created_at` | DateTime(tz) | NOT NULL |
| `updated_at` | DateTime(tz) | NOT NULL, auto-updated |

**Indexes:** `start_time`, `status`, `event_type`, `department`

#### Draft Model (`app/models/draft.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `title` | String(500) | NOT NULL |
| `draft_type` | Enum(Speech/Official Response/Press Release/Policy Brief/Meeting Agenda/Public Notice/Formal Letter/RTI Response/Government Circular) | NOT NULL |
| `status` | Enum(Generating/Draft/Under Review/Approved/Published) | NOT NULL, default Draft |
| `content` | Text | nullable (filled after generation) |
| `prompt_context` | Text | nullable (original topic/instructions) |
| `tone` | String(100) | nullable (formal/empathetic/assertive/etc.) |
| `audience` | String(255) | nullable (target audience description) |
| `department` | String(255) | nullable, indexed |
| `version` | Integer | NOT NULL, default 1 (auto-incremented on edit) |
| `extra_metadata` | JSON | nullable (word_count, language, ai_generated, etc.) |
| `created_by` | UUID | FK → users.id |
| `created_at` | DateTime(tz) | NOT NULL |
| `updated_at` | DateTime(tz) | NOT NULL, auto-updated |

**Indexes:** `draft_type`, `status`, `department`

### 3.6 Pydantic Schemas

All schemas use Pydantic v2 with `model_config = {"from_attributes": True}` for ORM compatibility.

**Schema Groups:**
- **User:** `UserRegisterRequest`, `UserLoginRequest`, `UserResponse`, `TokenResponse`, `MessageResponse`
- **Citizen:** `CitizenCreateRequest`, `CitizenUpdateRequest`, `CitizenResponse`, `CitizenListResponse`
- **Issue:** `IssueCreateRequest` (with geo metadata), `IssueUpdateRequest`, `IssueResponse`, `IssueListResponse`
- **Document:** `DocumentUploadResponse`, `DocumentListResponse`, `DocumentSummaryResponse`
- **Dashboard:** `DepartmentCount`, `StatusCount`, `RecentDocument`, `DashboardResponse`
- **Agent:** `AgentQueryRequest`, `AgentQueryResponse`, `AgentListResponse`, `AgentInfo`, `SessionHistoryResponse`, `SessionHistoryMessage`
- **ActionRequest:** `ActionReviewRequest`, `ActionRequestResponse`, `ActionRequestListResponse`
- **Event:** `EventCreateRequest`, `EventUpdateRequest`, `EventResponse`, `EventListResponse`
- **Draft:** `DraftGenerateRequest` (draft_type, topic, tone, audience, department, additional_context), `DraftUpdateRequest`, `DraftResponse`, `DraftListResponse`
- **STT:** `TranscribeResponse`, `TranscribeAndClassifyResponse`, `TranscribeAndIngestResponse`
- **Notification:** `NotificationItem`, `NotificationsResponse`

**Validation Rules (examples):**
- `name`: min 2 chars, max 255
- `email`: `EmailStr` type (RFC-compliant validation)
- `password`: min 8 chars, max 128
- `description`: min 10 chars, max 5000
- `latitude`: -90 to 90
- `longitude`: -180 to 180

### 3.7 Repository Pattern

Each model has a corresponding repository class in `app/repositories/` that encapsulates all database queries:

```
UserRepository      → User CRUD + email lookup + role filtering
CitizenRepository   → Citizen CRUD + ward filtering + name search
IssueRepository     → Issue CRUD + status/priority/department filtering + date range
DocumentRepository  → Document CRUD + paginated listing
ConversationRepository → Session history + user session listing + session deletion
EmbeddingRepository    → Create + content hash dedup check + similarity search
EventRepository     → Event CRUD + status/type/department filtering + date range + upcoming()
DraftRepository     → Draft CRUD + type/status/department filtering
```

All repositories accept a `Session` and provide typed methods returning ORM objects.

### 3.8 Service Layer

Services implement business logic on top of repositories:

| Service | File | Responsibility |
|---------|------|----------------|
| `AuthService` | `app/services/auth.py` | Register, login, token creation |
| `CitizenService` | `app/services/citizen.py` | Citizen CRUD with validation |
| `IssueService` | `app/services/issue.py` | Issue lifecycle management |
| `DocumentService` | `app/services/document.py` | Upload, extraction, summarization, RAG indexing |
| `DashboardService` | `app/services/dashboard.py` | Aggregated analytics computation |
| `AgentService` | `app/services/agent.py` | Full query orchestration pipeline |
| `MemoryService` | `app/services/memory.py` | Conversation storage + FAISS dense vector RAG search |
| `ApprovalService` | `app/services/approval.py` | Action request lifecycle |
| `STTService` | `app/services/stt.py` | Multi-provider speech-to-text (Groq → local → OpenAI) |
| `NotificationService` | `app/services/notification.py` | Aggregates 4 notification sources |
| `ScheduleService` | `app/services/schedule.py` | Event/calendar CRUD + upcoming |
| `DraftService` | `app/services/draft.py` | LLM-powered draft generation (9 templates) |

### 3.9 API Routers

All routers follow the pattern:
1. Declare `APIRouter()`
2. Define endpoints with type-annotated parameters
3. Inject `get_db` and `get_current_user` dependencies
4. Delegate to service layer
5. Return Pydantic response models

---

## 4. AI & Intelligence Layer

### 4.1 Multi-Agent Framework

**File:** `app/agents/base.py`

The agent framework is built on three core abstractions:

#### AgentContext (Dataclass)
```
session_id:            UUID           — Conversation session
user_id:               UUID           — Authenticated user
query:                 str            — User's natural language input
conversation_history:  List[Dict]     — Prior messages [{"role": "...", "content": "..."}]
rag_context:           List[str]      — Retrieved document chunks from RAG
metadata:              Dict[str, Any] — Extra context (e.g. geo coordinates)
```

#### AgentResponse (Dataclass)
```
agent_name:        str            — Which agent responded
message:           str            — The natural language response
confidence:        float          — Self-assessed confidence (0.0–1.0)
suggested_actions: List[Dict]     — Proposed mutations requiring HITL approval
metadata:          Dict[str, Any] — Supplementary data for UI rendering
```

#### BaseAgent (Abstract Base Class)

All agents must implement:
- `name` → Unique identifier (e.g. `"PolicyAgent"`)
- `description` → What the agent handles
- `execute(context: AgentContext) → AgentResponse`

**Built-in LLM Integration:**

The `BaseAgent` provides shared LLM infrastructure:

1. **`_get_groq_client()`** — Lazy-initialized Groq client singleton. Creates the client on first call, reuses for all subsequent calls across all agent instances. Returns `None` if `GROQ_API_KEY` is not configured.

2. **`_call_llm(context)`** — Calls Groq LLM with a fully-constructed prompt. Returns the response text, or `None` if the LLM is unavailable (allowing fallback to templates).

3. **`_build_prompt_messages(context)`** — Constructs the chat message array:
   ```
   [system_prompt] → [conversation_history...] → [RAG context injection] → [user query]
   ```
   - **System prompt** is generated by `_system_prompt()` (overridable per agent)
   - **Conversation history** provides multi-turn context
   - **RAG context** is injected as a system message: *"The following documents were retrieved as relevant context..."*
   - **User query** is appended last

4. **`_system_prompt()`** — Default prompt template that agents override for specialization

### 4.2 Agent Routing

**File:** `app/agents/router.py`

The `AgentRouter` uses **keyword-scored intent classification** to select the best agent:

```python
_INTENT_KEYWORDS = {
    "PolicyAgent": ["policy", "scheme", "regulation", "law", "act", "rule",
                     "guideline", "eligibility", "subsidy", "budget", ...],
    "CitizenAgent": ["citizen", "complaint", "issue", "grievance", "ward",
                      "water supply", "sanitation", "road", "garbage", ...],
    "OperationsAgent": ["department", "staff", "resource", "assign", "allocate",
                         "workload", "schedule", "operations", "KPI", ...],
}
```

**Routing Algorithm:**
1. Lowercase the query
2. For each agent, count how many keywords appear in the query
3. Sort by score descending
4. Calculate confidence as `best_score / total_scores`
5. If no keywords match, default to `CitizenAgent` with 0.5 confidence

**Runtime Registration:** Additional agents can be registered via `router.register_agent(agent)`.

### 4.3 Specialized Agents

#### PolicyAgent (`app/agents/policy.py`)
- **Domain:** Government policies, schemes, regulations, laws, budgets
- **System Prompt:** Specialized for governance policy interpretation
- **Capabilities:** Explain policy eligibility, compare schemes, interpret regulations
- **Fallback:** Template responses about policy topics when LLM is unavailable
- **Action Detection:** Can suggest policy updates for HITL approval

#### CitizenAgent (`app/agents/citizen.py`)
- **Domain:** Citizen records, complaints, ward analytics, issue tracking
- **System Prompt:** Specialized for citizen service delivery
- **Capabilities:** Look up citizen complaints, analyze ward-level trends, track issue resolution
- **Fallback:** Template responses about citizen services
- **Action Detection:** Can suggest issue escalations or priority changes

#### OperationsAgent (`app/agents/operations.py`)
- **Domain:** Resources, departments, KPIs, scheduling, workforce management
- **System Prompt:** Specialized for municipal operations
- **Capabilities:** Resource allocation recommendations, department efficiency analysis, workload balancing
- **Fallback:** Template responses about operational metrics
- **Action Detection:** Can suggest resource reallocation or task assignment

### 4.4 RAG Pipeline

The Retrieval-Augmented Generation (RAG) pipeline grounds LLM responses in actual uploaded documents, reducing hallucination.

#### Ingestion Flow

```
Document Upload (API: POST /api/v1/documents/upload)
       │
       ▼
  _validate_file()          ← Extension whitelist, size limit check
       │
       ▼
  _save_file()              ← UUID filename, stored in UPLOAD_DIR
       │
       ▼
  extract_text()            ← Content extraction (see §4.5)
       │
       ▼
  generate_summary()        ← Groq LLM (2-3 sentence summary)
       │                       Falls back to extractive summary (first 3 sentences)
       ▼
  Document saved to DB      ← With extracted_text and summary columns
       │
       ▼
  _store_document_embeddings()
       │
       ▼
  chunk_text()              ← 400-word chunks, 50-word overlap
       │
       ▼
  For each chunk:
    generate_embeddings_batch()  ← sentence-transformers (all-MiniLM-L6-v2)
       │
       ▼
    memory.store_embedding()
       │
       ▼
  Embedding record created  ← source_type="document", SHA-256 dedup, 384-dim dense vectors
```

#### Retrieval Flow

```
User Query (API: POST /api/v1/agent/query)
       │
       ▼
  AgentService.process_query()
       │
       ▼
  MemoryService.search_by_text(query, top_k=5)
       │
       ▼
  Load ALL embeddings from DB (optionally filtered by source_type)
       │
       ▼
  generate_embedding(query)  ← sentence-transformers (all-MiniLM-L6-v2)
       │
       ▼
  Build FAISS IndexFlatIP(384)  ← Inner-product on L2-normalized vectors
       │
       ▼
  index.search(query_vector, top_k)
       │
       ▼
  Filter results by score > 0.15 threshold
       │
       ▼
  Return: [{embedding_id, source_type, source_id, chunk_text, score}, ...]
       │
       ▼
  Inject chunk_texts into agent prompt as RAG context
       │
       ▼
  Agent + LLM generate grounded response
```

**Why FAISS + Sentence-Transformers?**
- **Semantic understanding** — Dense embeddings capture meaning, not just keyword overlap
- **Fast similarity search** — FAISS IndexFlatIP provides efficient nearest-neighbor search
- **Better recall** — Handles paraphrasing, synonyms, and multilingual queries
- **Compact model** — all-MiniLM-L6-v2 runs locally (CPU) with 384-dim vectors
- **Batch encoding** — Efficient batch processing for document ingestion

### 4.5 Document Processing

**File:** `app/services/document.py`

#### Text Extraction

| Format | Library | Method |
|--------|---------|--------|
| `.txt` | Built-in | `open()` with UTF-8 encoding, error-tolerant |
| `.pdf` | PyPDF2 | `PdfReader` → iterate pages → `extract_text()` → join with `\n\n` |
| `.docx` | python-docx | `Document()` → iterate paragraphs → join with `\n\n` |
| Other | — | Returns placeholder message |

All extraction is wrapped in try/except to ensure the upload succeeds even if extraction fails.

#### Text Chunking

```python
def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
```

- **Chunk size:** 400 words (optimized for TF-IDF relevance)
- **Overlap:** 50 words between consecutive chunks (prevents context loss at boundaries)
- **Algorithm:** Sliding window with `step = chunk_size - overlap = 350` words

Example: A 1200-word document produces 4 chunks:
```
Chunk 0: words[0:400]
Chunk 1: words[350:750]
Chunk 2: words[700:1100]
Chunk 3: words[1050:1200]
```

#### AI Summarization

```python
def generate_summary(text: str) -> str:
```

1. **Primary:** Groq LLM summarization
   - Truncates to first 2000 words
   - System prompt: *"You are a document summarizer for the NAYAM governance platform. Provide a concise 2-3 sentence summary..."*
   - Temperature: 0.3 (low creativity, high accuracy)
   - Max tokens: 200

2. **Fallback:** Extractive summary
   - First 3 sentences of the document
   - Used when `GROQ_API_KEY` is not set or LLM call fails

### 4.6 Conversation Memory

**File:** `app/services/memory.py`

The `MemoryService` manages two types of memory:

#### Short-Term Memory (Conversations)
- `store_message()` — Store a single message (user/assistant/system)
- `store_turn()` — Store a user→assistant pair atomically
- `get_session_context()` — Retrieve last N messages for a session (default: 20)
- `get_user_sessions()` — List recent session IDs for a user
- `delete_session()` — Remove all messages in a session

#### Long-Term Memory (Embeddings / RAG Store)
- `store_embedding()` — Store a pre-computed embedding with SHA-256 deduplication
  - Computes `content_hash = SHA-256(text)`
  - Checks `exists_by_content_hash()` before insert
  - Prevents duplicate chunks from re-uploads
- `generate_embedding(text)` — Generates a 384-dim dense vector using sentence-transformers (`all-MiniLM-L6-v2`), lazy-loaded on first call
- `generate_embeddings_batch(texts)` — Batch encoding with `batch_size=64` and `normalize_embeddings=True` for efficient document ingestion
- `search_similar_context()` — Vector-based similarity search (placeholder for future extensions)
- `search_by_text()` — **Primary RAG retrieval method** using FAISS `IndexFlatIP` with dense embeddings (see §4.4)

### 4.7 Agent Orchestration

**File:** `app/services/agent.py`

The `AgentService.process_query()` method is the central orchestration point:

```
Step 1: Session Management
         ├─ If session_id is None → generate new UUID
         └─ Parse existing session_id to UUID

Step 2: Conversation History
         ├─ MemoryService.get_session_context(session_id)
         └─ Convert ORM objects to [{"role": "...", "content": "..."}]

Step 3: RAG Context Retrieval
         ├─ MemoryService.search_by_text(query, top_k=5)
         ├─ Extract chunk_text from results
         └─ On failure → log warning, continue with empty context

Step 4: Agent Routing
         ├─ If agent_name specified → use that agent directly
         └─ Otherwise → AgentRouter.route(query) → (agent, intent, confidence)

Step 5: Agent Execution
         ├─ Build AgentContext with session, history, RAG, metadata
         ├─ agent.execute(context) → AgentResponse
         └─ On failure → HTTP 500

Step 6: Persist Conversation
         └─ MemoryService.store_turn(session_id, user_msg, assistant_response)

Step 7: Create Action Requests
         ├─ For each suggested_action in response:
         │   └─ ApprovalService.create_action_request(...)
         └─ Collect pending_action IDs for response

Return: {session_id, agent_name, response, confidence,
         suggested_actions, pending_actions, metadata}
```

### 4.8 Speech-to-Text (STT) Pipeline

The NAYAM platform has a **fully implemented** multi-provider STT pipeline for accepting voice input from users (municipal leaders, citizens at help desks, field workers).

**File:** `app/services/stt.py` (~790 lines) | `app/api/v1/stt.py` (3 endpoints)

#### Provider Chain (Automatic Fallback)

| Priority | Provider | Latency | Offline | Condition |
|----------|---------|---------|---------|-----------|
| 1 | **Groq Whisper** | ~1s | No | `GROQ_API_KEY` set (primary) |
| 2 | **Local faster-whisper** | ~5-10s | Yes ✓ | `faster-whisper` installed (CPU/int8, `small` model) |
| 3 | **OpenAI Whisper API** | ~2-3s | No | `OPENAI_API_KEY` set (last resort) |

#### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    STT PIPELINE (Implemented)                  │
│                                                              │
│  🎤 Frontend Mic Buttons (Intelligence + Documents pages)    │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │  Audio Capture   │  ← MediaRecorder API (.webm/.wav)     │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Provider Selection (automatic fallback chain)   │        │
│  │  Groq Whisper → local faster-whisper → OpenAI   │        │
│  └────────┬────────────────────────────────────────┘        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  Transcript +    │                                        │
│  │  Language +      │  ← STT result                         │
│  │  Duration        │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ├── /transcribe ──▶ Returns text only              │
│           ├── /classify ────▶ + LLM content classification   │
│           └── /ingest ──────▶ + Create entity + RAG index    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Three API Endpoints

| Endpoint | Purpose | Flow |
|----------|---------|------|
| `POST /api/v1/stt/transcribe` | Transcription only | Audio → STT → text + language + duration |
| `POST /api/v1/stt/classify` | Transcribe + classify | Audio → STT → LLM classifies content type (issue, document, query) |
| `POST /api/v1/stt/ingest` | Full pipeline | Audio → STT → Classify → Create entity (issue/document) → RAG index |

**Supported formats:** `.wav`, `.mp3`, `.m4a`, `.ogg`, `.webm`, `.flac`, `.aac` (max 25 MB)

#### Language Support

Whisper models support 100+ languages including Hindi (primary for NAYAM's municipal context), English (secondary), and regional Indian languages (Marathi, Gujarati, Tamil, etc.).

#### Frontend Integration

Microphone buttons (🎤) are available on:
- **Intelligence page** — Voice queries sent directly to AI agents
- **Documents page** — Voice recordings transcribed and stored as documents with RAG indexing

### 4.9 AI Draft Generator

**Files:** `app/services/draft.py` (245 lines) | `app/api/v1/drafts.py` | `app/models/draft.py`

The Draft Generator is an LLM-powered content creation system that produces 9 types of government documents using template system prompts.

#### Template System

Each draft type has a specialized system prompt with `{tone}` and `{audience}` placeholders:

| Draft Type | Template Focus | Example Output |
|-----------|----------------|----------------|
| **Speech** | 3-5 min, compelling opening, talking points, memorable closing | Inaugural address, policy announcement |
| **Official Response** | Clear, authoritative, action-oriented with reference numbers | Reply to citizen complaint, inter-department memo |
| **Press Release** | Headline, dateline, lead paragraph, body quotes, boilerplate | New scheme announcement, project completion |
| **Policy Brief** | Executive Summary → Background → Findings → Options → Recommendation | Water conservation policy, urban planning brief |
| **Meeting Agenda** | Numbered items, time allocations, responsible persons, outcomes | Municipal council meeting, review meeting |
| **Public Notice** | Effective date, rules, compliance requirements, contact info | Road closure notice, new regulation |
| **Formal Letter** | Proper salutation, reference line, subject, formal closing | Letter to state government, inter-department |
| **RTI Response** | RTI Act 2005 sections, transparency, exemption reasons | Response to information request |
| **Government Circular** | Circular number, instructions, compliance deadline, authority | Internal policy circular |

#### Generation Flow

```
POST /api/v1/drafts/generate
  │
  ▼
DraftGenerateRequest {draft_type, topic, tone, audience, department, additional_context}
  │
  ▼
Select template system prompt → format with tone + audience
  │
  ▼
Groq LLM (llama-3.3-70b-versatile, temperature=0.7, max_tokens=2000)
  │
  ▼
Draft created: content + word_count + version=1 + status=DRAFT
  │
  ▼
Edit → version auto-increment → Submit for Review → Approve → Publish
```

#### Draft Lifecycle

```
GENERATING → DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED
```

- **GENERATING** — LLM is producing content
- **DRAFT** — Content ready, editable by creator
- **UNDER_REVIEW** — Submitted for supervisory review
- **APPROVED** — Cleared for publication
- **PUBLISHED** — Final, read-only

Each content edit auto-increments the `version` integer for audit tracking.

### 4.10 Bhashini Language Services

**Files:** `app/services/bhashini.py` | `app/schemas/bhashini.py` | `app/api/v1/bhashini.py`

Full integration with the Bhashini Dhruva API (`dhruva-api.bhashini.gov.in`) for Indian language AI services. Supports 12+ Indian languages including Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, and Urdu.

#### Service Layer (`app/services/bhashini.py`)

The `BhashiniService` class provides:

| Method | Description |
|--------|-------------|
| `asr()` | Speech-to-text via Bhashini ASR pipeline for Indian languages |
| `tts()` | Text-to-speech with male/female voice selection |
| `translate()` | Neural machine translation between any supported language pair |
| `asr_translate()` | Compound: transcribe audio then translate to target language |
| `classify_text()` | Hybrid LLM + keyword text classification (question/issue/document) |
| `summarize_text()` | LLM-powered summarization with key points and action items |
| `get_supported_languages()` | Returns supported languages per task type |
| `health_check()` | Verifies Bhashini API connectivity |

#### Text Classification -- Dual Strategy

The `classify_text()` method implements a **hybrid classification** approach:

1. **LLM Classification (primary):** Groq Llama 3.3 analyzes text and returns category, confidence, reasoning, and extracted metadata (department, priority, citizen name).
2. **Keyword Classifier (fallback and cross-validator):** Rule-based classifier (`_keyword_classify()`) with 90+ Hindi and English governance keywords across three categories:
   - **Question keywords** (~30 words): "kya", "kaise", "status", "what", "how", etc.
   - **Issue keywords** (~35 words): "samasya", "shikayat", "pothole", "bijli nahi", "naali", etc.
   - **Document keywords** (~30 words): "baithak", "karyavahi", "minutes", "agenda", "budget", etc.

**Cross-validation logic:**
- Both classifiers always run in parallel
- If LLM confidence < 65%, the keyword result overrides when it scores higher
- On LLM failure, keyword classifier provides immediate fallback
- Question-mark presence in text receives a scoring boost
- Disambiguation examples in the LLM prompt distinguish policy discussion (document) from complaints (issue):
  - "water supply policy needs revision" → document (policy discussion)
  - "water supply nahi aa raha" → issue (complaint about service outage)
  - "road repair report for this week" → document (report/record)
  - "road has a pothole near my house" → issue (specific problem report)

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/bhashini/asr` | POST | Speech-to-text for Indian languages (multipart audio) |
| `/api/v1/bhashini/tts` | POST | Text-to-speech with voice selection |
| `/api/v1/bhashini/translate` | POST | Neural machine translation |
| `/api/v1/bhashini/asr-translate` | POST | Compound ASR + translation |
| `/api/v1/bhashini/classify-text` | POST | Hybrid LLM + keyword text classification |
| `/api/v1/bhashini/summarize` | POST | Text summarization with key points |
| `/api/v1/bhashini/languages` | GET | Supported languages per task |
| `/api/v1/bhashini/health` | GET | Bhashini API connectivity check |

#### Voice Intelligence Pipeline

```
Record Audio (any Indian language)
       |
       v
  Bhashini ASR (language-aware)
       |
       v
  Hybrid Classification (LLM + Keywords)
       |
       +--> "question"  -> Route to AI Agent
       +--> "issue"     -> Create Issue (with citizen picker)
       +--> "document"  -> Save as Document
       |
       v
  Optional: Summarize (key points, action items, departments)
```

#### Frontend Integration

Bhashini language services are integrated across three frontend pages:

| Page | Integration |
|------|-------------|
| **Bhashini** (`/bhashini`) | Voice Intelligence tab (record, ASR, classify, act), Text-to-Speech tab, Translation tab |
| **Documents** (`/documents`) | Language selector + Bhashini ASR for voice ingest with classification; user can override AI classification via "Create As" dropdown; TTS and Translate buttons on document detail modal |
| **Issues** (`/issues`) | Create Issue form with voice recording, Bhashini ASR, and translate-to-English; TTS and Translate buttons on issue detail modal |

---

## 5. Human-in-the-Loop (HITL) Approval System

The HITL system ensures that no AI-proposed action modifies system state without explicit human authorization.

### Workflow

```
Agent identifies needed action during response generation
       │
       ▼
  Agent adds to suggested_actions in AgentResponse
       │
       ▼
  AgentService creates ActionRequest (status: PENDING)
       │
       ▼
  Response returned to user with pending_actions list
       │
       ▼
  Approvals page shows all pending requests
       │
       ├── Leader/Staff clicks "Approve"
       │   └─ POST /api/v1/actions/{id}/review  {status: "APPROVED", note: "..."}
       │   └─ ActionRequest.status → APPROVED, reviewed_by set, reviewed_at set
       │
       └── Leader/Staff clicks "Reject"
           └─ POST /api/v1/actions/{id}/review  {status: "REJECTED", note: "..."}
           └─ ActionRequest.status → REJECTED
```

### Action Request Lifecycle

```
PENDING ──▶ APPROVED ──▶ (Action Executed)
   │
   └──▶ REJECTED
   │
   └──▶ EXPIRED (after ACTION_EXPIRY_HOURS)
```

### RBAC Enforcement
- **Any authenticated user** can view action requests
- **Only Leader and Staff** can approve or reject
- **Analysts** are read-only

---

## 6. Frontend Implementation

### 6.1 Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | React framework with App Router |
| React | 19.2.4 | UI library |
| TypeScript | 5.7.3 | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| Radix UI | 21 packages | Accessible component primitives |
| Recharts | 2.x | Data visualization charts |
| Lucide React | — | Icon library |
| Zod | — | Schema validation |
| React Hook Form | — | Form state management |
| js-cookie | — | Token storage |

### 6.2 Pages & Components

| Page | Route | Features |
|------|-------|----------|
| **Dashboard** | `/` | Total issues, citizens, documents; department breakdown; status distribution; recent documents |
| **Citizens** | `/citizens` | Paginated citizen list with ward filter; create/edit dialogs |
| **Issues** | `/issues` | Issue list with status/priority/department filters; create with citizen selector; status updates |
| **Documents** | `/documents` | Document list with file upload dialog; shows extracted text + AI summary; supports PDF/DOCX/TXT; Bhashini ASR voice ingest with 12-language selector; user-overridable AI classification ("Create As" dropdown); TTS and Translate on detail modal |
| **Intelligence** | `/intelligence` | AI chat interface; session management; agent selector; real-time streaming responses; voice input |
| **Schedule** | `/schedule` | Calendar event management; stats cards (upcoming/today/high priority); filters (type/status/department); event CRUD with detail dialog; status workflow (Start/Complete/Cancel) |
| **Drafts** | `/drafts` | AI draft generation; 9 template quick-generate cards; stats (total/AI-generated/under review); generate dialog with tone/audience/context; view/edit with version tracking; copy to clipboard; publish workflow |
| **Approvals** | `/approvals` | Pending action requests; approve/reject with notes; status badges (PENDING/APPROVED/REJECTED) |
| **Geo-Analytics** | `/geo-analytics` | Ward risk heatmap; risk score formula: `(volume/maxVolume * 50) + (highPriority/total * 50)` |
| **Predictive** | `/predictive` | 4-week forecast chart; anomaly detection (high-priority issues); ward trend lines |
| **Compliance** | `/compliance` | Audit trail viewer; export functionality |
| **Monitoring** | `/monitoring` | System health; API metrics; uptime status |
| **Issues** | `/issues` | Issue list with status/priority/department filters; create with citizen selector; voice-based issue creation with Bhashini ASR and translate-to-English; TTS and Translate on detail modal |
| **Bhashini** | `/bhashini` | Voice Intelligence (record, classify, route to action); Text-to-Speech with voice selection; Neural machine translation between language pairs |
| **Settings** | `/settings` | User profile management; theme preferences |

### 6.3 API Integration Layer

**File:** `frontend/lib/services.ts`

All API calls go through a centralized service layer with:
- **Token injection:** `Authorization: Bearer <token>` on every authenticated request
- **Base URL:** `http://localhost:8000` (configurable)
- **Error handling:** Consistent error extraction from API responses
- **Type safety:** TypeScript interfaces matching backend Pydantic schemas

Key functions:
```typescript
login(email, password)        → TokenResponse
register(name, email, ...)    → UserResponse
fetchCitizens(skip, limit)    → CitizenListResponse
fetchIssues(skip, limit, filters) → IssueListResponse
fetchDocuments(skip, limit)   → DocumentListResponse
uploadDocument(title, file)   → DocumentUploadResponse
fetchDashboard()              → DashboardResponse
sendAgentQuery(query, ...)    → AgentQueryResponse
fetchActionRequests(...)      → ActionRequestListResponse
reviewAction(id, approve, note) → ActionRequestResponse
fetchEvents(skip, limit, filters)  → EventListResponse
createEvent(data)             → EventResponse
updateEvent(id, data)         → EventResponse
deleteEvent(id)               → MessageResponse
generateDraft(data)           → DraftResponse
fetchDrafts(skip, limit, filters)  → DraftListResponse
getDraft(id)                  → DraftResponse
updateDraft(id, data)         → DraftResponse
deleteDraft(id)               → MessageResponse
```

### 6.4 Geo-Analytics & Risk Scoring

**File:** `frontend/app/geo-analytics/page.tsx`

Risk scores are computed client-side from issue data:

```
For each ward:
  count     = number of issues in ward
  highCount = number of HIGH priority issues

  riskScore = (count / maxCount * 50) + (highCount / count * 50)
```

This normalized formula ensures:
- **Volume** contributes 50% (relative to busiest ward)
- **Severity** contributes 50% (proportion of high-priority issues)
- Scores range from 0–100
- No ward can hit 100 unless it's both the busiest AND has all-high-priority issues

### 6.5 Predictive Intelligence

**File:** `frontend/app/predictive/page.tsx`

The predictive page provides:

1. **4-Week Historical Distribution** — Issues distributed across 4 calendar weeks using a synthetic bell-curve pattern
2. **Trend Prediction** — Deterministic risk trends per ward using seeded random (based on ward name hash) for reproducibility
3. **Anomaly Detection** — High-priority issues flagged as anomalies with counts and percentages
4. **Chart Configuration** — Y-axis domain `[0, 100]`, both "Actual" and "Predicted" data lines

---

## 7. Platform Subsystems

### 7.1 Compliance & Audit

**Directory:** `app/compliance/`

- **Audit Logging** — All state-changing operations recorded with timestamp, user, action, and payload
- **GDPR Export** — Citizen data export capability for right-of-access compliance
- **Retention Policy** — Configurable via `COMPLIANCE_RETENTION_DAYS` (default: 730 days)
- **Export Format** — JSON exports to `COMPLIANCE_EXPORT_DIR`

### 7.2 Monitoring & Observability

**Directory:** `app/monitoring/`

- **Structured Logging** — structlog with JSON processor in production, console in dev
- **Request Logging** — Every request gets a unique `X-Request-ID` for distributed tracing
- **Prometheus Metrics** — Exposed at `/api/v1/monitoring/metrics`
- **Deep Health Check** — `/api/v1/monitoring/health/deep` verifies DB connectivity
- **Latency Tracking** — Per-request duration logged

### 7.3 Rate Limiting & Security Hardening

**Directory:** `app/hardening/`

- **Per-IP Sliding Window** — Tracks request counts per IP within configurable window
- **429 Responses** — Returns `Retry-After` header when limit exceeded
- **Audit Trail** — Rate limit violations logged for security review
- **Configuration:** `RATE_LIMIT_REQUESTS=100`, `RATE_LIMIT_WINDOW_SECONDS=60`

### 7.4 Offline-First & Edge Sync

**Directories:** `app/offline/`, `app/sync/`

Designed for field deployment where internet connectivity is intermittent:

- **Offline Queue** — Operations queued locally when offline
- **Push/Pull Sync** — `POST /api/v1/sync/push` (upload changes) and `POST /api/v1/sync/pull` (download latest)
- **Conflict Resolution** — Last-write-wins with configurable strategies
- **Batch Processing** — Sync operations batched (`SYNC_BATCH_SIZE=50`) for efficiency
- **Node Identity** — Each deployment node identified by `DEFAULT_NODE_ID`

### 7.5 Schedule Management

**Files:** `app/models/event.py`, `app/repositories/event.py`, `app/services/schedule.py`, `app/api/v1/schedule.py`

A complete calendar/event management system for public leaders and administrators:

- **7 Event Types** — Meeting, Hearing, Site Visit, Deadline, Review, Public Event, Other
- **3 Priority Levels** — Low, Medium, High
- **4 Statuses** — Scheduled → In Progress → Completed (or Cancelled)
- **Rich Metadata** — Location, attendees (comma-separated), department, ward, all-day toggle
- **Reminders** — Configurable `reminder_minutes` per event (default 30)
- **Smart Notifications** — Events within 48 hours automatically surface in the notification feed with time-until labels ("in less than 1 hour", "in 6 hours", "tomorrow")
- **Filtering** — By status, type, department, date range
- **Frontend** — Full CRUD with stats cards, filters, event detail dialog, create/edit dialogs, status workflow buttons

### 7.6 Notification System

**Files:** `app/services/notification.py`, `app/api/v1/notifications.py`, `frontend/components/nayam/notification-bell.tsx`

An aggregated notification feed that pulls from 4 real-time data sources:

| Source | What It Surfaces | Severity |
|--------|-----------------|----------|
| **Pending Approvals** | Action requests awaiting human review | Warning |
| **High-Priority Issues** | Issues marked HIGH priority in last 7 days | Error |
| **Recent Documents** | Documents uploaded in last 24 hours | Info |
| **Upcoming Events** | Events scheduled within next 48 hours | Warning (<6h) / Info (>6h) |

**Frontend Component:** Notification bell (🔔) in topbar with:
- Live polling every 30 seconds
- Unread count badge
- Dropdown with dismiss and navigate actions
- Severity-based color coding

---

## 8. Database Design

### Entity-Relationship Summary

```
┌──────────┐     1:N     ┌──────────┐
│  User    │─────────────│ Document │
│          │  uploaded_by │          │
└──────────┘             └──────────┘

┌──────────┐     1:N     ┌──────────┐
│ Citizen  │─────────────│  Issue   │
│          │  citizen_id  │          │
└──────────┘             └──────────┘

┌──────────────┐   N:1   ┌──────────┐
│ Conversation │─────────│  User    │
│              │ user_id  │          │
└──────────────┘         └──────────┘

┌──────────────┐  source  ┌──────────┐
│  Embedding   │─────────│ Document │
│              │ source_id│          │
└──────────────┘         └──────────┘

┌───────────────┐ session  ┌──────────────┐
│ ActionRequest │─────────│ Conversation │
│               │session_id│              │
└───────────────┘         └──────────────┘

┌──────────┐     N:1     ┌──────────┐
│  Event   │─────────────│  User    │
│          │  created_by  │          │
└──────────┘             └──────────┘

┌──────────┐     N:1     ┌──────────┐
│  Draft   │─────────────│  User    │
│          │  created_by  │          │
└──────────┘             └──────────┘
```

### Index Strategy

| Table | Indexes | Purpose |
|-------|---------|---------|
| `users` | `email` (unique), `role` | Login lookup, role filtering |
| `citizens` | `name`, `ward` | Name search, ward filtering |
| `issues` | `citizen_id`, `department`, `status`, `priority`, `created_at`, `(latitude, longitude)` | All query patterns |
| `documents` | `uploaded_by`, `created_at` | User docs, chronological sort |
| `conversations` | `(session_id, created_at)` composite | History retrieval |
| `embeddings` | `(source_type, source_id)`, `content_hash` | RAG queries, dedup |
| `events` | `start_time`, `status`, `event_type`, `department` | Calendar queries, filtering |
| `drafts` | `draft_type`, `status`, `department` | Draft listing, filtering |

### Seed Data

**`seed.py`** is the single unified seed script. Run `python seed.py` (with the backend running) to populate:
- 60 citizens across 8 wards (Ward-1 through Ward-8)
- 130 issues across 10 departments (Water Supply, Roads & Infrastructure, Sanitation, Electricity, Public Health, Education, Housing, Revenue, Social Welfare, Transport)
- 5 governance documents (Municipal Water Supply Policy, Ward Development Plan, Citizen Grievance Redressal Guidelines, Annual Budget Summary, Public Health Emergency Protocol)
- Date spread: Issues distributed across 30 days (not all same timestamp)
- 16 action requests: 8 PENDING, 5 APPROVED, 3 REJECTED
- 22 calendar events across 7 event types (meetings, hearings, site visits, deadlines, reviews, public events)
- 9 AI-generated drafts covering all 9 template types (Speech, Official Response, Press Release, Policy Brief, Meeting Agenda, Public Notice, Formal Letter, RTI Response, Government Circular)

Use `python seed.py --reset` to delete the database and start fresh.

---

## 9. API Reference

### Authentication

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/auth/register` | POST | None | `{name, email, password, role}` | `{id, name, email, role, created_at}` |
| `/api/v1/auth/login` | POST | None | `{email, password}` | `{access_token, token_type, user}` |

### Citizens

| Endpoint | Method | Auth | Query Params | Response |
|----------|--------|------|------|----------|
| `/api/v1/citizens` | POST | Leader, Staff | — | `CitizenResponse` |
| `/api/v1/citizens` | GET | Any | `skip`, `limit`, `ward`, `search` | `{total, citizens[]}` |
| `/api/v1/citizens/{id}` | GET | Any | — | `CitizenResponse` |
| `/api/v1/citizens/{id}` | PUT | Leader, Staff | — | `CitizenResponse` |
| `/api/v1/citizens/{id}` | DELETE | Leader | — | `MessageResponse` |

### Issues

| Endpoint | Method | Auth | Query Params | Response |
|----------|--------|------|------|----------|
| `/api/v1/issues` | POST | Leader, Staff | — | `IssueResponse` |
| `/api/v1/issues` | GET | Any | `skip`, `limit`, `status`, `priority`, `department` | `{total, issues[]}` |
| `/api/v1/issues/{id}` | GET | Any | — | `IssueResponse` |
| `/api/v1/issues/{id}` | PUT | Leader, Staff | — | `IssueResponse` |
| `/api/v1/issues/{id}` | DELETE | Leader | — | `MessageResponse` |

### Documents

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/documents/upload` | POST | Leader, Staff | `multipart/form-data {title, file}` | `DocumentUploadResponse` |
| `/api/v1/documents` | GET | Any | `skip`, `limit` | `{total, documents[]}` |
| `/api/v1/documents/{id}` | GET | Any | — | `DocumentUploadResponse` |
| `/api/v1/documents/{id}` | DELETE | Leader | — | `MessageResponse` |

### Dashboard

| Endpoint | Method | Auth | Response |
|----------|--------|------|----------|
| `/api/v1/dashboard` | GET | Any | `{total_issues, issues_by_department[], issues_by_status[], total_documents, recent_documents[]}` |

### AI Agent

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/agent/query` | POST | Any | `{query, session_id?, agent_name?, metadata?}` | `{session_id, agent_name, response, confidence, suggested_actions[], pending_actions[]}` |
| `/api/v1/agent/agents` | GET | Any | — | `{agents: [{name, description}]}` |
| `/api/v1/agent/sessions/{id}/history` | GET | Any | `limit` | `{session_id, total, messages[]}` |

### Action Approvals

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/actions` | GET | Any | `skip`, `limit`, `status`, `agent_name` | `{total, actions[]}` |
| `/api/v1/actions/pending` | GET | Any | `skip`, `limit` | `{total, actions[]}` |
| `/api/v1/actions/{id}` | GET | Any | — | `ActionRequestResponse` |
| `/api/v1/actions/{id}/review` | POST | Leader, Staff | `{status: "APPROVED"/"REJECTED", review_note?}` | `ActionRequestResponse` |

### Speech-to-Text

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/stt/transcribe` | POST | Any | `multipart/form-data {file}` | `{transcript, language, duration, provider}` |
| `/api/v1/stt/classify` | POST | Any | `multipart/form-data {file}` | `{transcript, language, duration, classification}` |
| `/api/v1/stt/ingest` | POST | Leader, Staff | `multipart/form-data {file, mode?}` | `{transcript, classification, created_entity, rag_indexed}` |

### Bhashini Language Services

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/bhashini/asr` | POST | Any | `multipart/form-data {file, language}` | `{text, language, duration}` |
| `/api/v1/bhashini/tts` | POST | Any | `{text, language, gender}` | `{audio_base64, language, gender}` |
| `/api/v1/bhashini/translate` | POST | Any | `{text, source_language, target_language}` | `{translated_text, source_language, target_language}` |
| `/api/v1/bhashini/asr-translate` | POST | Any | `multipart/form-data {file, source_language, target_language}` | `{text, translated_text, source_language, target_language}` |
| `/api/v1/bhashini/classify-text` | POST | Any | `{text, source_language?}` | `{category, confidence, reasoning, metadata, method}` |
| `/api/v1/bhashini/summarize` | POST | Any | `{text, source_language?}` | `{summary, key_points[], action_items[], departments[]}` |
| `/api/v1/bhashini/languages` | GET | Any | -- | `{asr: [], tts: [], translation: []}` |
| `/api/v1/bhashini/health` | GET | Any | -- | `{status, response_time_ms}` |

### Schedule Management

| Endpoint | Method | Auth | Query Params | Response |
|----------|--------|------|------|----------|
| `/api/v1/schedule` | GET | Any | `skip`, `limit`, `status`, `event_type`, `department`, `start_after`, `start_before` | `{total, events[]}` |
| `/api/v1/schedule` | POST | Leader, Staff | — | `EventResponse` |
| `/api/v1/schedule/{id}` | GET | Any | — | `EventResponse` |
| `/api/v1/schedule/{id}` | PATCH | Any | — | `EventResponse` |
| `/api/v1/schedule/{id}` | DELETE | Leader | — | `MessageResponse` |
| `/api/v1/schedule/upcoming/list` | GET | Any | `hours` | `{total, events[]}` |

### AI Draft Generator

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/api/v1/drafts/generate` | POST | Leader, Staff | `{draft_type, topic, tone?, audience?, department?, additional_context?}` | `DraftResponse` |
| `/api/v1/drafts` | GET | Any | `skip`, `limit`, `draft_type`, `status`, `department` | `{total, drafts[]}` |
| `/api/v1/drafts/{id}` | GET | Any | — | `DraftResponse` |
| `/api/v1/drafts/{id}` | PATCH | Any | `{title?, content?, status?, tone?, audience?}` | `DraftResponse` |
| `/api/v1/drafts/{id}` | DELETE | Leader | — | `MessageResponse` |

### Notifications

| Endpoint | Method | Auth | Response |
|----------|--------|------|----------|
| `/api/v1/notifications` | GET | Any | `{notifications[], count}` |

### Platform Operations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/sync/push` | POST | Any | Push offline data to server |
| `/api/v1/sync/pull` | POST | Any | Pull latest data from server |
| `/api/v1/offline/queue` | GET | Any | View pending offline operations |
| `/api/v1/compliance/exports` | GET | Leader | Generate audit trail export |
| `/api/v1/monitoring/health/deep` | GET | Any | Deep health probe (DB check) |
| `/api/v1/monitoring/metrics` | GET | Any | Prometheus-format metrics |
| `/health` | GET | None | Simple health check |

---

## 10. Deployment

### Development Setup

```bash
# Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Seed Data
python seed.py
```

### Docker Deployment

**Dockerfile** (multi-stage):
```
Stage 1: python:3.13-slim base
  → Install system deps (gcc, libpq-dev)
  → pip install requirements.txt
  → Copy application code
  → Create non-root user
  → Healthcheck: curl /health
  → CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**docker-compose.yml** (3 services):

| Service | Image | Purpose | Ports |
|---------|-------|---------|-------|
| `postgres` | postgres:16-alpine | Production database | 5432 |
| `backend` | Built from Dockerfile | FastAPI application | 8000 |
| `nginx` | nginx:1.25-alpine | Reverse proxy + static files | 80 |

**Volumes:**
- `postgres_data` — Persistent database storage
- `upload_data` — Uploaded document files
- `./nginx.conf` — Nginx configuration

### Environment Variables (Production)

```env
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql://nayam_user:strong_password@postgres:5432/nayam_db
JWT_SECRET_KEY=<generate-64-char-random-string>
GROQ_API_KEY=gsk_xxxxxxxxxxxx
ALLOWED_ORIGINS=https://your-domain.gov.in
ENFORCE_HTTPS=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=60
ENABLE_AUDIT_LOGGING=true
```

---

## 11. Testing

### Test Suite Overview

**518 tests** covering all layers:

| Test File | Focus | Count |
|-----------|-------|-------|
| `test_auth.py` | Registration, login, JWT, RBAC | ~50 |
| `test_citizens.py` | Citizen CRUD, validation, pagination | ~60 |
| `test_issues.py` | Issue lifecycle, filters, geo metadata | ~80 |
| `test_documents.py` | Upload, extraction, RAG indexing | ~18 |
| `test_dashboard.py` | Aggregation queries | ~20 |
| `test_integration.py` | Cross-service workflows | ~9 |
| `test_health.py` | Health endpoint | ~5 |
| Other module tests | Agents, memory, approvals, sync, etc. | ~276 |

### Test Infrastructure

**File:** `tests/conftest.py`

- **In-memory SQLite** database per test session
- **TestClient** from FastAPI's test utilities
- **Fixtures:** `db_session`, `client`, `auth_headers`, `sample_citizen`, `sample_issue`
- **Isolation:** Each test gets a fresh database state

### Running Tests

```bash
# All tests
pytest -v

# Specific module
pytest tests/test_auth.py -v

# With coverage
pytest --cov=app --cov-report=html

# Parallel execution
pytest -n auto
```

---

## 12. Configuration Reference

### Complete Settings Table

| Variable | Type | Default | Phase | Description |
|----------|------|---------|-------|-------------|
| `APP_NAME` | str | `"NAYAM"` | 1 | Application name |
| `APP_VERSION` | str | `"1.0.0"` | 1 | Semantic version |
| `APP_ENV` | str | `"development"` | 1 | Environment mode |
| `DEBUG` | bool | `True` | 1 | Debug logging |
| `DATABASE_URL` | str | `postgresql://...` | 1 | Database connection |
| `JWT_SECRET_KEY` | str | `"CHANGE_ME"` | 1 | JWT signing secret |
| `JWT_ALGORITHM` | str | `"HS256"` | 1 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | `60` | 1 | Token TTL |
| `UPLOAD_DIR` | str | `"./uploads"` | 1 | File storage path |
| `MAX_UPLOAD_SIZE_MB` | int | `10` | 1 | Upload size limit |
| `ALLOWED_ORIGINS` | str | `"localhost:3000,..."` | 1 | CORS origins |
| `GROQ_API_KEY` | str | `""` | 2 | Groq LLM API key |
| `GROQ_MODEL` | str | `"llama-3.3-70b-versatile"` | 2 | LLM model |
| `OPENAI_API_KEY` | str | `""` | 2 | OpenAI API key (unused) |
| `EMBEDDING_MODEL` | str | `"all-MiniLM-L6-v2"` | 2 | Embedding model (sentence-transformers) |
| `EMBEDDING_DIMENSIONS` | int | `384` | 2 | Vector dimensions |
| `AGENT_TIMEOUT_SECONDS` | int | `30` | 2 | Agent execution timeout |
| `AGENT_MAX_CONTEXT_MESSAGES` | int | `20` | 2 | Max history per session |
| `ACTION_EXPIRY_HOURS` | int | `24` | 2 | Action auto-expiry |
| `RISK_COMPUTATION_INTERVAL_HOURS` | int | `6` | 3 | Risk recalculation |
| `ANOMALY_DEVIATION_THRESHOLD` | float | `2.0` | 3 | Anomaly detection σ |
| `PREDICTION_WINDOW_DAYS` | int | `7` | 3 | Forecast horizon |
| `RISK_MODEL_VERSION` | str | `"v1.0"` | 3 | Risk model version |
| `POSTGIS_ENABLED` | bool | `False` | 3 | PostGIS geo features |
| `GEO_CLUSTER_RADIUS_METERS` | float | `500.0` | 3 | Cluster radius |
| `HEATMAP_GRID_SIZE` | int | `50` | 3 | Heatmap resolution |
| `ENCRYPTION_KEY` | str | `""` | 3 | Fernet encryption key |
| `PII_FIELDS` | str | `"contact_number,email"` | 3 | PII field list |
| `RECOMMENDATION_EXPIRY_HOURS` | int | `72` | 3 | Recommendation TTL |
| `MAX_RECOMMENDATIONS_PER_WARD` | int | `10` | 3 | Recommendation limit |
| `AUDIT_LOG_RETENTION_DAYS` | int | `365` | 3 | Audit log retention |
| `ENABLE_AUDIT_LOGGING` | bool | `True` | 3 | Audit toggle |
| `OFFLINE_MODE_ENABLED` | bool | `False` | 4 | Offline mode |
| `SYNC_INTERVAL_SECONDS` | int | `30` | 4 | Sync frequency |
| `SYNC_MAX_RETRIES` | int | `3` | 4 | Sync retry count |
| `SYNC_BATCH_SIZE` | int | `50` | 4 | Batch size |
| `DEFAULT_NODE_ID` | str | `"central"` | 4 | Node identity |
| `RATE_LIMIT_REQUESTS` | int | `100` | 4 | Requests per window |
| `RATE_LIMIT_WINDOW_SECONDS` | int | `60` | 4 | Window duration |
| `ENFORCE_HTTPS` | bool | `False` | 4 | HTTPS enforcement |
| `TOKEN_ROTATION_ENABLED` | bool | `False` | 4 | JWT rotation |
| `TOKEN_ROTATION_DAYS` | int | `7` | 4 | Rotation interval |
| `COMPLIANCE_EXPORT_DIR` | str | `"./exports"` | 4 | Export directory |
| `COMPLIANCE_RETENTION_DAYS` | int | `730` | 4 | Data retention |
| `ENABLE_PERFORMANCE_TRACKING` | bool | `True` | 4 | Performance toggle |
| `METRICS_RETENTION_DAYS` | int | `90` | 4 | Metrics retention |
| `HEALTH_CHECK_INTERVAL_SECONDS` | int | `30` | 4 | Health check interval |

---

## Dependencies

### Python Backend (`requirements.txt`)

```
# Core
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.2
pydantic-settings==2.1.0
alembic==1.13.0
python-multipart==0.0.6

# Authentication
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
email-validator==2.1.0
bcrypt==4.0.1

# AI / LLM
groq==0.25.0
faiss-cpu==1.13.2
sentence-transformers==5.2.3

# Document Processing
PyPDF2==3.0.1
python-docx==1.1.0

# Speech-to-Text
faster-whisper              # Local offline STT (CPU/int8)
openai                      # OpenAI Whisper API fallback

# Monitoring
structlog==24.1.0
prometheus-client==0.19.0

# Testing
pytest==7.4.3
pytest-asyncio==0.23.2
httpx==0.25.2
```

### Frontend (`package.json`)

```
next: 16.1.6
react: 19.2.4
typescript: 5.7.3
tailwindcss: 4.x
@radix-ui/*: 21 packages (dialog, dropdown, tabs, etc.)
recharts: 2.x
lucide-react
zod
react-hook-form
js-cookie
```

---

*NAYAM (नयम्) — AI Co-Pilot for Governance. Built with precision. Designed for impact.*
