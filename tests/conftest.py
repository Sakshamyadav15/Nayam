"""
NAYAM (नयम्) — Test Configuration & Fixtures.

Provides a test database session, FastAPI test client,
and reusable fixtures for all test modules.
"""

import os
import uuid
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.main import app
from app.models.user import User, UserRole
from app.models.citizen import Citizen
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.document import Document

# ── In-Memory SQLite Engine for Tests ────────────────────────────────
SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ── Fixtures ─────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def setup_database() -> Generator[None, None, None]:
    """Create all tables before each test and drop them after."""
    # Reset the in-memory rate-limiter between tests (Phase 4)
    from app.hardening.rate_limiter import reset_rate_limiter
    reset_rate_limiter()

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Provide a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient with overridden DB dependency."""

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def leader_user(db_session: Session) -> User:
    """Create and return a Leader user for testing."""
    user = User(
        id=uuid.uuid4(),
        name="Test Leader",
        email="leader@nayam.dev",
        password_hash=hash_password("LeaderPass123"),
        role=UserRole.LEADER,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def staff_user(db_session: Session) -> User:
    """Create and return a Staff user for testing."""
    user = User(
        id=uuid.uuid4(),
        name="Test Staff",
        email="staff@nayam.dev",
        password_hash=hash_password("StaffPass123"),
        role=UserRole.STAFF,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def analyst_user(db_session: Session) -> User:
    """Create and return an Analyst user for testing."""
    user = User(
        id=uuid.uuid4(),
        name="Test Analyst",
        email="analyst@nayam.dev",
        password_hash=hash_password("AnalystPass123"),
        role=UserRole.ANALYST,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def leader_token(leader_user: User) -> str:
    """Create a JWT token for the leader user."""
    return create_access_token(data={"sub": str(leader_user.id), "role": leader_user.role.value})


@pytest.fixture()
def staff_token(staff_user: User) -> str:
    """Create a JWT token for the staff user."""
    return create_access_token(data={"sub": str(staff_user.id), "role": staff_user.role.value})


@pytest.fixture()
def analyst_token(analyst_user: User) -> str:
    """Create a JWT token for the analyst user."""
    return create_access_token(data={"sub": str(analyst_user.id), "role": analyst_user.role.value})


@pytest.fixture()
def auth_headers_leader(leader_token: str) -> dict:
    """Authorization headers for Leader."""
    return {"Authorization": f"Bearer {leader_token}"}


@pytest.fixture()
def auth_headers_staff(staff_token: str) -> dict:
    """Authorization headers for Staff."""
    return {"Authorization": f"Bearer {staff_token}"}


@pytest.fixture()
def auth_headers_analyst(analyst_token: str) -> dict:
    """Authorization headers for Analyst."""
    return {"Authorization": f"Bearer {analyst_token}"}


@pytest.fixture()
def sample_citizen(db_session: Session) -> Citizen:
    """Create and return a sample citizen for testing."""
    citizen = Citizen(
        id=uuid.uuid4(),
        name="Ramesh Kumar",
        contact_number="9876543210",
        ward="Saket",
    )
    db_session.add(citizen)
    db_session.commit()
    db_session.refresh(citizen)
    return citizen


@pytest.fixture()
def sample_issue(db_session: Session, sample_citizen: Citizen) -> Issue:
    """Create and return a sample issue for testing."""
    issue = Issue(
        id=uuid.uuid4(),
        citizen_id=sample_citizen.id,
        department="Water Supply",
        description="Irregular water supply in Saket since last week.",
        status=IssueStatus.OPEN,
        priority=IssuePriority.HIGH,
    )
    db_session.add(issue)
    db_session.commit()
    db_session.refresh(issue)
    return issue


@pytest.fixture()
def sample_document(db_session: Session, leader_user: User) -> Document:
    """Create and return a sample document for testing."""
    document = Document(
        id=uuid.uuid4(),
        title="Test Document",
        uploaded_by=leader_user.id,
        file_path="./uploads/test_file.pdf",
        extracted_text="[Test extracted text]",
        summary="[Test summary]",
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    return document
