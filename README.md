<p align="center">
  <h1 align="center">NAYAM</h1>
  <p align="center"><strong>AI Co-Pilot Platform for Public Leaders and Municipal Administrators</strong></p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.13-blue?logo=python" />
  <img src="https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/LLM-Groq%20Llama%203.3-orange" />
  <img src="https://img.shields.io/badge/RAG-FAISS%20%2B%20Sentence--Transformers-green" />
  <img src="https://img.shields.io/badge/STT-Whisper%20%2B%20Bhashini-blueviolet" />
  <img src="https://img.shields.io/badge/Bhashini-Dhruva%20API-ff6600" />
  <img src="https://img.shields.io/badge/API%20Routers-17-blue" />
  <img src="https://img.shields.io/badge/Routes-82-blue" />
  <img src="https://img.shields.io/badge/Tests-518%20passing-brightgreen" />
</p>

---

## Overview

NAYAM is an AI-powered governance platform designed to serve as an intelligent co-pilot for municipal leaders, administrative staff, and data analysts. It provides a unified interface for managing citizens, grievances, policy documents, schedules, and administrative workflows -- backed by a multi-agent LLM system, a Retrieval-Augmented Generation (RAG) pipeline, multi-provider speech-to-text, Bhashini Gov India language services, AI-powered document drafting, and a real-time notification engine.

> **Monorepo:** Backend (Python/FastAPI) and frontend (Next.js) live in a single repository. The frontend is in the `frontend/` directory.

### Key Capabilities

| Capability | Description |
|---|---|
| **Multi-Agent Intelligence** | Three domain-specific AI agents (Policy, Citizen, Operations) powered by Groq LLM with keyword-scored intent routing |
| **Document RAG Pipeline** | Upload PDF/DOCX/TXT; automatic text extraction, chunking, FAISS dense-vector indexing (all-MiniLM-L6-v2, 384-dim), and LLM-grounded retrieval |
| **Speech-to-Text Pipeline** | Multi-provider STT with automatic fallback: Groq Whisper, local faster-whisper (offline), OpenAI Whisper. Supports transcription, content classification, and intelligent entity ingestion |
| **Bhashini Language Services** | Full integration with Bhashini Dhruva API for 12+ Indian languages: ASR (speech-to-text), TTS (text-to-speech), neural machine translation, LLM-powered text classification (question/issue/document), and text summarization with keyword-based fallback |
| **Voice Intelligence** | Record voice in any supported Indian language, auto-classify as question/issue/document via hybrid LLM + keyword classifier (with user-overridable classification), and route to the appropriate action |
| **AI Draft Generator** | LLM-powered generation of nine formal document types with template system prompts, tone and audience controls, and versioned editing with publish workflow |
| **Schedule Management** | Calendar and event system supporting seven event types, three priority levels, status lifecycle tracking, and department/ward assignment |
| **Notification System** | Aggregated feed from four real-time sources: pending approvals, high-priority issues, recent documents, and upcoming events (48-hour lookahead) |
| **Multi-Language Issue Creation** | File grievances via voice in any Indian language with Bhashini ASR, with optional auto-translation to English via neural machine translation |
| **Human-in-the-Loop Approvals** | Every AI-proposed mutation requires explicit human authorization before execution |
| **Analytics and Predictive Intelligence** | Ward-level risk scoring, geo-spatial heatmaps, four-week trend forecasting, and anomaly detection |
| **Enterprise Security** | JWT authentication, role-based access control (Leader/Staff/Analyst), per-IP rate limiting, structured audit logging |

---

## System Architecture

```
+-------------------------------------------------------------+
|                    FRONTEND (Next.js 16)                      |
|  Dashboard | Issues | Citizens | Documents | Intelligence    |
|  Schedule  | Drafts | Approvals | Geo-Analytics | Predictive |
|  Compliance | Monitoring | Settings | Notifications          |
|  Bhashini (Voice Intelligence / TTS / Translation)            |
+----------------------------+--------------------------------+
                             | REST API (JSON)
+----------------------------v--------------------------------+
|                    BACKEND (FastAPI)                          |
|                                                              |
|  +----------+  +----------+  +------------+  +-----------+  |
|  | 17 API   |->| Services |->|Repositories|->| SQLAlchemy|  |
|  | Routers  |  | (Logic)  |  | (Data)     |  |   ORM     |  |
|  +----------+  +----------+  +------------+  +-----+-----+  |
|                                                     |        |
|  +--------------------------------------------------+        |
|  |         AI / INTELLIGENCE LAYER                  |        |
|  |                                                  |        |
|  |  Agent Router -> 3 Agents -> Groq LLM           |        |
|  |  RAG Pipeline: FAISS IndexFlatIP -> Dense Sim   |        |
|  |  STT Pipeline: Groq / faster-whisper / OpenAI    |        |
|  |  Bhashini Dhruva: ASR / TTS / NMT / Classify    |        |
|  |  Draft Generator: 9 Templates -> LLM -> Docs    |        |
|  +--------------------------------------------------+        |
|                                                              |
+----------------------------+--------------------------------+
                             |
                      +------v------+
                      |   SQLite    |
                      |  (dev) /    |
                      | PostgreSQL  |
                      |  (prod)     |
                      +-------------+
```

---

## Backend Structure

```
app/
|-- agents/              # Multi-agent framework
|   |-- base.py          # BaseAgent ABC, Groq LLM client, prompt builder
|   |-- router.py        # Intent-based keyword routing
|   |-- policy.py        # PolicyAgent: governance, schemes, regulations
|   |-- citizen.py       # CitizenAgent: complaints, ward analytics
|   +-- operations.py    # OperationsAgent: resources, departments, KPIs
|-- api/v1/              # 17 REST API routers (82 routes)
|   |-- auth.py          # JWT registration and login
|   |-- citizens.py      # Citizen CRUD and search
|   |-- issues.py        # Issue CRUD with filters
|   |-- documents.py     # Upload with RAG indexing
|   |-- dashboard.py     # Aggregated analytics
|   |-- agent.py         # AI chat and session history
|   |-- actions.py       # HITL approval workflow
|   |-- stt.py           # Speech-to-text endpoints
|   |-- bhashini.py      # Bhashini Dhruva API (ASR, TTS, NMT, classify, summarize)
|   |-- notifications.py # Notification feed
|   |-- schedule.py      # Calendar and event CRUD
|   |-- drafts.py        # AI draft generation and management
|   |-- sync.py          # Offline data synchronization
|   |-- offline.py       # Offline queue management
|   |-- compliance.py    # Audit trail exports
|   |-- monitoring.py    # Health probes and metrics
|   +-- hardening.py     # Rate limit administration
|-- models/              # 9 SQLAlchemy ORM models (24+ tables)
|   |-- user.py          # User model with role-based access
|   |-- citizen.py       # Citizen records
|   |-- issue.py         # Grievance and issue tracking
|   |-- document.py      # Uploaded documents
|   |-- event.py         # Schedule and calendar events
|   +-- draft.py         # AI-generated drafts
|-- schemas/             # 20+ Pydantic v2 request/response schemas
|   +-- bhashini.py      # Bhashini API request/response models
|-- repositories/        # Data access layer (query builders)
|-- services/            # Business logic layer
|   |-- agent.py         # Orchestration: route, RAG, execute, persist, approve
|   |-- memory.py        # Conversation storage and FAISS dense-vector RAG search
|   |-- document.py      # Text extraction, chunking, Groq summarization
|   |-- stt.py           # Multi-provider STT (Groq, local, OpenAI)
|   |-- bhashini.py      # Bhashini Dhruva service (ASR, TTS, NMT, classify, summarize)
|   |-- notification.py  # Aggregation from four data sources
|   |-- schedule.py      # Event lifecycle management
|   +-- draft.py         # LLM-powered draft generation (9 templates)
|-- core/                # Configuration, database, JWT security, logging
|-- compliance/          # Audit trail and GDPR export
|-- monitoring/          # Prometheus metrics and request logging
|-- hardening/           # Rate limiting middleware
|-- offline/             # Offline-first queue
+-- sync/                # Conflict resolution engine
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5.7 | UI framework |
| UI Components | Radix UI, Tailwind CSS 4, Recharts | Accessible components and charts |
| Backend | FastAPI 0.104, Python 3.13 | REST API framework |
| ORM | SQLAlchemy 2.0, Alembic | Database and migrations |
| Database | SQLite (development) / PostgreSQL 16 (production) | Persistence |
| LLM | Groq SDK, Llama 3.3 70B Versatile | Agent intelligence and draft generation |
| RAG | FAISS (faiss-cpu), sentence-transformers (all-MiniLM-L6-v2) | Dense-vector document retrieval |
| Document Extraction | PyPDF2, python-docx | PDF and DOCX text extraction |
| Speech-to-Text | Groq Whisper, faster-whisper (local), OpenAI Whisper | Multi-provider STT with fallback chain |
| Bhashini | Dhruva API (bhashini.gov.in) | Indian language ASR, TTS, neural machine translation |
| Authentication | python-jose (JWT), passlib (bcrypt) | Token-based auth |
| Logging | structlog, JSON output | Observability |
| Monitoring | Prometheus client | Metrics collection |
| Deployment | Docker, docker-compose, Nginx | Containerized deployment |

---

## AI and Intelligence Layer

### Document Ingestion Pipeline

```
File Upload (.pdf/.docx/.txt)
       |
       v
  extract_text()          <-- PyPDF2 / python-docx / raw read
       |
       v
  chunk_text()            <-- 400-word chunks, 50-word overlap
       |
       +---> generate_summary()  -> Groq LLM -> 2-3 sentence summary
       |
       v
  generate_embeddings_batch()  <-- sentence-transformers (all-MiniLM-L6-v2, 384-dim)
       |
       v
  store_embedding()       <-- Each chunk stored with SHA-256 deduplication
```

### RAG Retrieval

```
User Query
       |
       v
  search_by_text()        <-- Load stored embeddings from database
       |
       v
  generate_embedding()    <-- Encode query via sentence-transformers
       |
       v
  FAISS IndexFlatIP(384)  <-- Inner-product on L2-normalized vectors
       |
       v
  Top-5 chunks (score > 0.15) injected into agent prompt
       |
       v
  Groq LLM generates grounded response
```

### Speech-to-Text Pipeline

The STT pipeline provides three levels of voice processing with automatic provider failover:

| Endpoint | Function | Flow |
|----------|----------|------|
| `POST /api/v1/stt/transcribe` | Transcription only | Audio to text with language detection |
| `POST /api/v1/stt/classify` | Transcribe and classify | Audio to text, then LLM content classification |
| `POST /api/v1/stt/ingest` | Full pipeline | Audio to text, classify, create entity, RAG index |

**Provider chain:** Groq Whisper (primary) -> local faster-whisper (offline fallback, CPU/int8) -> OpenAI Whisper (last resort)

**Supported formats:** WAV, MP3, M4A, OGG, WebM, FLAC, AAC (maximum 25 MB)

### Bhashini Language Services

Full integration with the Bhashini Dhruva API (`dhruva-api.bhashini.gov.in`) for Indian language AI services. Supports 12+ Indian languages including Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, and Urdu.

| Endpoint | Function | Description |
|----------|----------|-------------|
| `POST /api/v1/bhashini/asr` | Speech-to-Text | Bhashini ASR for Indian languages with language selection |
| `POST /api/v1/bhashini/tts` | Text-to-Speech | Neural TTS with male/female voice selection |
| `POST /api/v1/bhashini/translate` | Translation | Neural machine translation between any supported language pair |
| `POST /api/v1/bhashini/asr-translate` | ASR + Translation | Compound: transcribe audio then translate to target language |
| `POST /api/v1/bhashini/classify-text` | Text Classification | Hybrid LLM + keyword classifier (question/issue/document) |
| `POST /api/v1/bhashini/summarize` | Summarization | LLM-powered text summarization with key points and action items |
| `GET /api/v1/bhashini/languages` | Supported Languages | List all supported languages per task |
| `GET /api/v1/bhashini/health` | Health Check | Bhashini API connectivity verification |

**Text Classification** uses a dual-strategy approach:

1. **LLM Classification (primary):** Groq Llama 3.3 analyzes text and returns category, confidence, reasoning, and extracted metadata (department, priority, citizen name).
2. **Keyword Classifier (fallback and cross-validator):** Rule-based classifier with 90+ Hindi and English governance keywords across three categories. Always runs alongside the LLM. If LLM confidence is below 65%, the keyword result overrides when it scores higher. On LLM failure, the keyword classifier provides immediate fallback.

**Voice Intelligence Pipeline:**

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

### AI Draft Generator

Nine document types with specialized LLM template prompts, configurable tone and audience, and version-controlled editing:

| Type | Description |
|------|-------------|
| Speech | Structured addresses with talking points (3-5 minutes) |
| Official Response | Authoritative replies with reference numbers and timelines |
| Press Release | Standard format with headline, dateline, lead, and boilerplate |
| Policy Brief | Executive summary, background, findings, and recommendations |
| Meeting Agenda | Numbered items with time allocations and responsible persons |
| Public Notice | Compliance requirements, effective dates, and contact information |
| Formal Letter | Indian administrative style with proper salutation and closing |
| RTI Response | Right to Information Act 2005 compliant responses |
| Government Circular | Internal directives with circular numbers and compliance deadlines |

**Lifecycle:** Draft -> Under Review -> Approved -> Published (version auto-incremented on each content edit)

### Schedule Management

Full calendar and event system with seven event types (Meeting, Hearing, Site Visit, Deadline, Review, Public Event, Other), three priority levels, and automatic 48-hour notification surfacing.

---

## Multi-Agent System

| Agent | Domain | Example Queries |
|---|---|---|
| PolicyAgent | Governance policies, schemes, regulations | "What is the water supply SLA?" |
| CitizenAgent | Citizen records, complaints, ward analytics | "Open complaints in Ward-3?" |
| OperationsAgent | Resources, departments, KPIs, scheduling | "Allocate road repair crew" |

**Routing:** Keyword-scored intent classification selects the highest-scoring agent. Default fallback: CitizenAgent.

**HITL Safety:** Any agent-proposed mutation (escalate priority, allocate resources, close issue) generates an `ActionRequest` requiring human approval before execution.

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/login` | JWT login |

### Core CRUD
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| CRUD | `/api/v1/citizens/` | Create, list, get, update, delete citizens |
| CRUD | `/api/v1/issues/` | Create, list, get, update, delete issues |
| POST | `/api/v1/documents/upload` | Upload and RAG-index document |
| GET | `/api/v1/documents/` | List documents |
| GET | `/api/v1/dashboard/` | Aggregated analytics |

### Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/agent/query` | Submit query to AI agent |
| GET | `/api/v1/agent/agents` | List available agents |
| GET | `/api/v1/agent/sessions/{id}` | Retrieve conversation history |

### Approvals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/actions/` | List action requests |
| GET | `/api/v1/actions/pending` | Pending approvals |
| POST | `/api/v1/actions/{id}/review` | Approve or reject action |

### Speech-to-Text
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/stt/transcribe` | Audio to text transcription |
| POST | `/api/v1/stt/classify` | Audio to text with content classification |
| POST | `/api/v1/stt/ingest` | Full pipeline: transcribe, classify, create entity, RAG index |

### Bhashini Language Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/bhashini/asr` | Speech-to-text for Indian languages |
| POST | `/api/v1/bhashini/tts` | Text-to-speech with voice selection |
| POST | `/api/v1/bhashini/translate` | Neural machine translation |
| POST | `/api/v1/bhashini/asr-translate` | Compound ASR + translation |
| POST | `/api/v1/bhashini/classify-text` | Hybrid LLM + keyword text classification |
| POST | `/api/v1/bhashini/summarize` | Text summarization with key points |
| GET | `/api/v1/bhashini/languages` | Supported languages per task |
| GET | `/api/v1/bhashini/health` | Bhashini API connectivity check |

### Schedule Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/schedule/` | List events with filters |
| POST | `/api/v1/schedule/` | Create event (Leader/Staff) |
| GET | `/api/v1/schedule/{id}` | Retrieve event by ID |
| PATCH | `/api/v1/schedule/{id}` | Update event |
| DELETE | `/api/v1/schedule/{id}` | Delete event |
| GET | `/api/v1/schedule/upcoming/list` | Upcoming events |

### Draft Generator
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/drafts/generate` | Generate draft with AI (Leader/Staff) |
| GET | `/api/v1/drafts/` | List drafts with filters |
| GET | `/api/v1/drafts/{id}` | Retrieve draft by ID |
| PATCH | `/api/v1/drafts/{id}` | Update draft (auto-increments version) |
| DELETE | `/api/v1/drafts/{id}` | Delete draft |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications/` | Aggregated notification feed from four sources |

### Platform Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync/push` | Push offline data |
| POST | `/api/v1/sync/pull` | Pull latest data |
| GET | `/api/v1/compliance/exports` | Audit trail exports |
| GET | `/api/v1/monitoring/metrics` | Prometheus-format metrics |

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Real-time KPIs, departmental analytics, charts |
| Issues | `/issues` | Issue tracking with filters, detail modal with TTS/Translate, voice-based issue creation with Bhashini ASR and auto-translate |
| Citizens | `/citizens` | Citizen registry with search, add, and edit |
| **Documents** | `/documents` | Document upload, voice ingest with Bhashini ASR (12 languages), AI classification with user-overridable "Create As" dropdown, TTS/Translate on detail modal, and RAG indexing |
| Intelligence | `/intelligence` | AI agent chat with document-grounded responses |
| Bhashini | `/bhashini` | Voice Intelligence (record, classify, act), Text-to-Speech, Translation |
| Approvals | `/approvals` | Human-in-the-loop review for AI-proposed actions |
| Schedule | `/schedules` | Calendar view and event management |
| Drafts | `/drafts` | AI draft generation and version-controlled editing |
| Geo-Analytics | `/geo-analytics` | Ward-level risk heatmaps |
| Predictive | `/predictive` | Four-week trend forecasting and anomaly detection |
| Compliance | `/compliance` | Audit trail and export tools |
| Monitoring | `/monitoring` | System health and performance metrics |
| Settings | `/settings` | Application configuration |
| Notifications | Bell icon (topbar) | Aggregated notification feed |

---

## Getting Started

### Prerequisites

- Python 3.13 or higher
- Node.js 18 or higher
- Groq API key ([console.groq.com](https://console.groq.com))
- Bhashini API key ([bhashini.gov.in](https://bhashini.gov.in)) -- for Indian language services

### Setup

```bash
git clone https://github.com/Sakshamyadav15/Nayam.git
cd Nayam

# Backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # Linux / macOS

pip install -r requirements.txt

# Configure environment variables (.env file)
# Required: GROQ_API_KEY, JWT_SECRET_KEY
# Optional: BHASHINI_API_KEY (for Bhashini language services)

uvicorn app.main:app --reload --port 8000

# Seed data (backend must be running)
python seed.py                    # 60 citizens, 130 issues, 5 documents, 22 events, 9 drafts, 16 action requests

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev                       # http://localhost:3000
```

### Default Credentials

```
Email:    admin@nayam.gov.in
Password: admin12345
```

### Docker Deployment

```bash
docker-compose up -d              # PostgreSQL + Backend + Nginx
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./nayam_dev.db` | Database connection URI |
| `JWT_SECRET_KEY` | -- | JWT signing secret (required) |
| `GROQ_API_KEY` | -- | Groq LLM API key (required) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | LLM model identifier |
| `BHASHINI_API_KEY` | -- | Bhashini Dhruva API key (for Indian language services) |
| `BHASHINI_INFERENCE_URL` | `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` | Bhashini inference endpoint |
| `UPLOAD_DIR` | `./uploads` | File upload storage path |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins |
| `APP_ENV` | `development` | Environment mode |
| `MAX_UPLOAD_SIZE_MB` | `10` | Maximum upload file size |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Rate limit per window |

---

## Testing

```bash
pytest -v                         # Full suite (518 tests)
pytest tests/test_auth.py         # Authentication module
pytest tests/test_documents.py    # Document and RAG tests
pytest tests/test_integration.py  # Integration tests
pytest --cov=app --cov-report=html  # Coverage report
```

---

## Security

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT tokens with configurable expiry (HS256 + bcrypt) |
| Authorization | Role-based access control: Leader, Staff, Analyst |
| Rate Limiting | Per-IP sliding window with audit trail |
| Input Validation | Pydantic v2 validation on every endpoint |
| File Security | Extension whitelist, size limits, UUID filenames |
| AI Safety | Human-in-the-loop approvals for all AI-proposed mutations |
| Observability | Structured logging with request-ID correlation, JSON output in production |
| Secret Management | All sensitive configuration loaded from environment variables |

---

## License

Internal use only. Not for public distribution.
