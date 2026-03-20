"""
NAYAM (नयम्) — Authentication Module Tests.

Tests for user registration, login, JWT validation,
password hashing, and role-based access control.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.models.user import User, UserRole


# ═══════════════════════════════════════════════════════════════════════
# PASSWORD HASHING TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestPasswordHashing:
    """Tests for bcrypt password hashing utilities."""

    def test_hash_password_returns_string(self) -> None:
        """hash_password should return a non-empty string."""
        hashed = hash_password("TestPass123")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_not_plaintext(self) -> None:
        """Hashed password should not equal the plaintext."""
        password = "SecurePass456"
        hashed = hash_password(password)
        assert hashed != password

    def test_verify_password_correct(self) -> None:
        """verify_password should return True for correct password."""
        password = "MyPassword789"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self) -> None:
        """verify_password should return False for wrong password."""
        hashed = hash_password("CorrectPassword")
        assert verify_password("WrongPassword", hashed) is False

    def test_hash_uniqueness(self) -> None:
        """Two hashes of the same password should differ (salt)."""
        password = "SamePassword"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2


# ═══════════════════════════════════════════════════════════════════════
# JWT TOKEN TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestJWTTokens:
    """Tests for JWT token creation and validation."""

    def test_create_access_token(self) -> None:
        """create_access_token should return a non-empty JWT string."""
        token = create_access_token(data={"sub": "test-user-id", "role": "Staff"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_valid_token(self) -> None:
        """decode_access_token should correctly decode a valid token."""
        data = {"sub": "user-123", "role": "Leader"}
        token = create_access_token(data=data)
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["role"] == "Leader"

    def test_decode_invalid_token(self) -> None:
        """decode_access_token should return None for invalid tokens."""
        payload = decode_access_token("invalid.token.here")
        assert payload is None

    def test_decode_tampered_token(self) -> None:
        """decode_access_token should reject tampered tokens."""
        token = create_access_token(data={"sub": "user-123"})
        tampered = token[:-5] + "XXXXX"
        payload = decode_access_token(tampered)
        assert payload is None

    def test_token_contains_expiry(self) -> None:
        """Token payload should contain an 'exp' field."""
        token = create_access_token(data={"sub": "user-123"})
        payload = decode_access_token(token)
        assert payload is not None
        assert "exp" in payload


# ═══════════════════════════════════════════════════════════════════════
# REGISTRATION ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestRegistration:
    """Tests for the /api/v1/auth/register endpoint."""

    def test_register_success(self, client: TestClient) -> None:
        """Successful registration should return 201 with token and user data."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "New User",
                "email": "new@nayam.dev",
                "password": "SecurePass123",
                "role": "Staff",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "new@nayam.dev"
        assert data["user"]["role"] == "Staff"

    def test_register_duplicate_email(self, client: TestClient, leader_user: User) -> None:
        """Registration with existing email should return 409."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Duplicate User",
                "email": leader_user.email,
                "password": "SecurePass123",
                "role": "Staff",
            },
        )
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]

    def test_register_invalid_email(self, client: TestClient) -> None:
        """Registration with invalid email format should return 422."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Bad Email",
                "email": "not-an-email",
                "password": "SecurePass123",
                "role": "Staff",
            },
        )
        assert response.status_code == 422

    def test_register_short_password(self, client: TestClient) -> None:
        """Registration with password < 8 chars should return 422."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Short Pass",
                "email": "short@nayam.dev",
                "password": "1234567",
                "role": "Staff",
            },
        )
        assert response.status_code == 422

    def test_register_missing_fields(self, client: TestClient) -> None:
        """Registration with missing required fields should return 422."""
        response = client.post(
            "/api/v1/auth/register",
            json={"name": "No Email"},
        )
        assert response.status_code == 422

    def test_register_leader_role(self, client: TestClient) -> None:
        """Registration as Leader should succeed."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Leader User",
                "email": "leader2@nayam.dev",
                "password": "LeaderPass123",
                "role": "Leader",
            },
        )
        assert response.status_code == 201
        assert response.json()["user"]["role"] == "Leader"


# ═══════════════════════════════════════════════════════════════════════
# LOGIN ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestLogin:
    """Tests for the /api/v1/auth/login endpoint."""

    def test_login_success(self, client: TestClient, leader_user: User) -> None:
        """Successful login should return token and user data."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "leader@nayam.dev",
                "password": "LeaderPass123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "leader@nayam.dev"

    def test_login_wrong_password(self, client: TestClient, leader_user: User) -> None:
        """Login with wrong password should return 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "leader@nayam.dev",
                "password": "WrongPassword",
            },
        )
        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]

    def test_login_nonexistent_user(self, client: TestClient) -> None:
        """Login with non-existent email should return 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@nayam.dev",
                "password": "SomePassword123",
            },
        )
        assert response.status_code == 401

    def test_login_missing_password(self, client: TestClient) -> None:
        """Login without password should return 422."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "leader@nayam.dev"},
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# ROLE GUARD TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestRoleGuards:
    """Tests for role-based access control."""

    def test_unauthenticated_access_denied(self, client: TestClient) -> None:
        """Requests without token should return 401."""
        response = client.get("/api/v1/citizens/")
        assert response.status_code == 401

    def test_invalid_token_denied(self, client: TestClient) -> None:
        """Requests with invalid token should return 401."""
        response = client.get(
            "/api/v1/citizens/",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401

    def test_analyst_cannot_create_citizen(
        self, client: TestClient, auth_headers_analyst: dict
    ) -> None:
        """Analyst should not be able to create citizens (requires Leader/Staff)."""
        response = client.post(
            "/api/v1/citizens/",
            json={
                "name": "Test Citizen",
                "contact_number": "9876543210",
                "ward": "Dwarka",
            },
            headers=auth_headers_analyst,
        )
        assert response.status_code == 403
        assert "permissions" in response.json()["detail"].lower()

    def test_staff_cannot_delete_citizen(
        self, client: TestClient, auth_headers_staff: dict, sample_citizen
    ) -> None:
        """Staff should not be able to delete citizens (requires Leader)."""
        response = client.delete(
            f"/api/v1/citizens/{sample_citizen.id}",
            headers=auth_headers_staff,
        )
        assert response.status_code == 403
