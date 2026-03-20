"""
NAYAM (नयम्) — Phase 4 Model Tests.

Comprehensive tests for all Phase 4 ORM models:
  • SyncQueue (sync)
  • ConflictLog (sync)
  • OfflineAction (offline)
  • ComplianceExport (compliance)
  • PerformanceMetric (monitoring)
  • RateLimitRecord (hardening)
"""

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy.orm import Session

from app.sync.models import SyncQueue, SyncOperation, SyncStatus
from app.sync.conflict_model import ConflictLog, ConflictResolution
from app.offline.models import OfflineAction, OfflineStatus
from app.compliance.models import ComplianceExport, ExportFormat, ExportStatus
from app.monitoring.models import PerformanceMetric, MetricCategory
from app.hardening.models import RateLimitRecord


# ═══════════════════════════════════════════════════════════════════
# SyncQueue Tests
# ═══════════════════════════════════════════════════════════════════


class TestSyncQueueModel:
    """Tests for the SyncQueue ORM model."""

    def test_create_sync_queue_defaults(self, db_session: Session) -> None:
        sq = SyncQueue(
            node_id="edge-01",
            operation=SyncOperation.CREATE,
            resource_type="issue",
            resource_id=uuid.uuid4(),
        )
        db_session.add(sq)
        db_session.commit()
        db_session.refresh(sq)

        assert sq.id is not None
        assert sq.node_id == "edge-01"
        assert sq.operation == SyncOperation.CREATE
        assert sq.status == SyncStatus.PENDING
        assert sq.version == 1
        assert sq.priority == 5
        assert sq.retry_count == 0
        assert sq.max_retries == 3
        assert sq.synced_at is None
        assert sq.created_at is not None

    def test_create_sync_queue_full(self, db_session: Session) -> None:
        res_id = uuid.uuid4()
        sq = SyncQueue(
            node_id="edge-02",
            operation=SyncOperation.UPDATE,
            resource_type="citizen",
            resource_id=res_id,
            payload={"name": "Updated Name", "ward": "Saket"},
            version=3,
            status=SyncStatus.IN_PROGRESS,
            priority=1,
            retry_count=1,
            checksum="abc123def456",
        )
        db_session.add(sq)
        db_session.commit()
        db_session.refresh(sq)

        assert sq.resource_id == res_id
        assert sq.payload["name"] == "Updated Name"
        assert sq.version == 3
        assert sq.status == SyncStatus.IN_PROGRESS
        assert sq.priority == 1

    def test_sync_operation_enum(self) -> None:
        assert set(SyncOperation) == {
            SyncOperation.CREATE,
            SyncOperation.UPDATE,
            SyncOperation.DELETE,
        }

    def test_sync_status_enum(self) -> None:
        assert set(SyncStatus) == {
            SyncStatus.PENDING,
            SyncStatus.IN_PROGRESS,
            SyncStatus.SYNCED,
            SyncStatus.FAILED,
            SyncStatus.CONFLICT,
        }

    def test_sync_queue_repr(self, db_session: Session) -> None:
        sq = SyncQueue(
            node_id="n1",
            operation=SyncOperation.CREATE,
            resource_type="issue",
            resource_id=uuid.uuid4(),
        )
        db_session.add(sq)
        db_session.commit()
        db_session.refresh(sq)
        assert "SyncQueue" in repr(sq)

    def test_filter_pending(self, db_session: Session) -> None:
        for status in [SyncStatus.PENDING, SyncStatus.SYNCED, SyncStatus.PENDING]:
            db_session.add(SyncQueue(
                node_id="n1",
                operation=SyncOperation.CREATE,
                resource_type="issue",
                resource_id=uuid.uuid4(),
                status=status,
            ))
        db_session.commit()
        pending = db_session.query(SyncQueue).filter_by(status=SyncStatus.PENDING).all()
        assert len(pending) == 2

    def test_sync_lifecycle(self, db_session: Session) -> None:
        """Simulate: PENDING → IN_PROGRESS → SYNCED."""
        sq = SyncQueue(
            node_id="n1",
            operation=SyncOperation.CREATE,
            resource_type="issue",
            resource_id=uuid.uuid4(),
        )
        db_session.add(sq)
        db_session.commit()
        assert sq.status == SyncStatus.PENDING

        sq.status = SyncStatus.IN_PROGRESS
        db_session.commit()
        db_session.refresh(sq)
        assert sq.status == SyncStatus.IN_PROGRESS

        sq.status = SyncStatus.SYNCED
        sq.synced_at = datetime.now(timezone.utc)
        db_session.commit()
        db_session.refresh(sq)
        assert sq.status == SyncStatus.SYNCED
        assert sq.synced_at is not None

    def test_retry_increment(self, db_session: Session) -> None:
        sq = SyncQueue(
            node_id="n1",
            operation=SyncOperation.UPDATE,
            resource_type="citizen",
            resource_id=uuid.uuid4(),
            status=SyncStatus.FAILED,
            retry_count=0,
            error_message="Connection timeout",
        )
        db_session.add(sq)
        db_session.commit()

        sq.retry_count += 1
        sq.status = SyncStatus.PENDING
        db_session.commit()
        db_session.refresh(sq)
        assert sq.retry_count == 1
        assert sq.error_message == "Connection timeout"


# ═══════════════════════════════════════════════════════════════════
# ConflictLog Tests
# ═══════════════════════════════════════════════════════════════════


class TestConflictLogModel:
    """Tests for the ConflictLog ORM model."""

    def _make_sync_entry(self, db_session: Session) -> SyncQueue:
        sq = SyncQueue(
            node_id="edge-01",
            operation=SyncOperation.UPDATE,
            resource_type="issue",
            resource_id=uuid.uuid4(),
            status=SyncStatus.CONFLICT,
        )
        db_session.add(sq)
        db_session.commit()
        db_session.refresh(sq)
        return sq

    def test_create_conflict_log_defaults(self, db_session: Session) -> None:
        cl = ConflictLog(
            node_id="edge-01",
            resource_type="issue",
            resource_id=uuid.uuid4(),
        )
        db_session.add(cl)
        db_session.commit()
        db_session.refresh(cl)

        assert cl.id is not None
        assert cl.resolution == ConflictResolution.PENDING
        assert cl.resolved_at is None
        assert cl.detected_at is not None

    def test_create_conflict_log_with_sync_fk(self, db_session: Session) -> None:
        sq = self._make_sync_entry(db_session)
        cl = ConflictLog(
            sync_queue_id=sq.id,
            node_id="edge-01",
            resource_type="issue",
            resource_id=uuid.uuid4(),
            local_data={"status": "closed"},
            server_data={"status": "open"},
        )
        db_session.add(cl)
        db_session.commit()
        db_session.refresh(cl)

        assert cl.sync_queue_id == sq.id
        assert cl.local_data["status"] == "closed"
        assert cl.server_data["status"] == "open"

    def test_conflict_resolution_enum(self) -> None:
        assert set(ConflictResolution) == {
            ConflictResolution.PENDING,
            ConflictResolution.LOCAL_WINS,
            ConflictResolution.SERVER_WINS,
            ConflictResolution.MERGED,
            ConflictResolution.MANUAL,
        }

    def test_resolve_conflict(self, db_session: Session) -> None:
        cl = ConflictLog(
            node_id="edge-01",
            resource_type="issue",
            resource_id=uuid.uuid4(),
        )
        db_session.add(cl)
        db_session.commit()

        cl.resolution = ConflictResolution.SERVER_WINS
        cl.resolved_by = uuid.uuid4()
        cl.resolved_at = datetime.now(timezone.utc)
        cl.resolution_notes = "Server data is more recent."
        db_session.commit()
        db_session.refresh(cl)

        assert cl.resolution == ConflictResolution.SERVER_WINS
        assert cl.resolved_at is not None
        assert cl.resolution_notes is not None

    def test_conflict_log_repr(self, db_session: Session) -> None:
        cl = ConflictLog(
            node_id="n1",
            resource_type="citizen",
            resource_id=uuid.uuid4(),
        )
        db_session.add(cl)
        db_session.commit()
        db_session.refresh(cl)
        assert "ConflictLog" in repr(cl)

    def test_relationship_to_sync_queue(self, db_session: Session) -> None:
        sq = self._make_sync_entry(db_session)
        cl = ConflictLog(
            sync_queue_id=sq.id,
            node_id="edge-01",
            resource_type="issue",
            resource_id=uuid.uuid4(),
        )
        db_session.add(cl)
        db_session.commit()
        db_session.refresh(cl)

        assert cl.sync_entry is not None
        assert cl.sync_entry.id == sq.id

    def test_filter_unresolved_conflicts(self, db_session: Session) -> None:
        db_session.add(ConflictLog(node_id="n1", resource_type="issue", resource_id=uuid.uuid4(), resolution=ConflictResolution.PENDING))
        db_session.add(ConflictLog(node_id="n1", resource_type="issue", resource_id=uuid.uuid4(), resolution=ConflictResolution.SERVER_WINS))
        db_session.add(ConflictLog(node_id="n1", resource_type="issue", resource_id=uuid.uuid4(), resolution=ConflictResolution.PENDING))
        db_session.commit()

        unresolved = db_session.query(ConflictLog).filter_by(resolution=ConflictResolution.PENDING).all()
        assert len(unresolved) == 2


# ═══════════════════════════════════════════════════════════════════
# OfflineAction Tests
# ═══════════════════════════════════════════════════════════════════


class TestOfflineActionModel:
    """Tests for the OfflineAction ORM model."""

    def test_create_offline_action_defaults(self, db_session: Session) -> None:
        oa = OfflineAction(
            node_id="edge-03",
            action_type="create_issue",
            resource_type="issue",
        )
        db_session.add(oa)
        db_session.commit()
        db_session.refresh(oa)

        assert oa.id is not None
        assert oa.status == OfflineStatus.CACHED
        assert oa.queued_at is None
        assert oa.created_at is not None

    def test_create_offline_action_full(self, db_session: Session) -> None:
        user_id = uuid.uuid4()
        res_id = uuid.uuid4()
        oa = OfflineAction(
            node_id="edge-03",
            user_id=user_id,
            action_type="update_citizen",
            resource_type="citizen",
            resource_id=res_id,
            payload={"name": "Jane Doe", "ward": "Vikaspuri"},
            checksum="sha256hex",
        )
        db_session.add(oa)
        db_session.commit()
        db_session.refresh(oa)

        assert oa.user_id == user_id
        assert oa.resource_id == res_id
        assert oa.payload["ward"] == "Vikaspuri"

    def test_offline_status_enum(self) -> None:
        assert set(OfflineStatus) == {
            OfflineStatus.CACHED,
            OfflineStatus.QUEUED,
            OfflineStatus.SYNCED,
            OfflineStatus.FAILED,
        }

    def test_offline_action_lifecycle(self, db_session: Session) -> None:
        """CACHED → QUEUED → SYNCED."""
        oa = OfflineAction(
            node_id="e1", action_type="create_issue", resource_type="issue",
        )
        db_session.add(oa)
        db_session.commit()
        assert oa.status == OfflineStatus.CACHED

        oa.status = OfflineStatus.QUEUED
        oa.queued_at = datetime.now(timezone.utc)
        db_session.commit()
        db_session.refresh(oa)
        assert oa.status == OfflineStatus.QUEUED
        assert oa.queued_at is not None

        oa.status = OfflineStatus.SYNCED
        db_session.commit()
        db_session.refresh(oa)
        assert oa.status == OfflineStatus.SYNCED

    def test_offline_action_repr(self, db_session: Session) -> None:
        oa = OfflineAction(
            node_id="e1", action_type="create_issue", resource_type="issue",
        )
        db_session.add(oa)
        db_session.commit()
        db_session.refresh(oa)
        assert "OfflineAction" in repr(oa)

    def test_filter_by_node(self, db_session: Session) -> None:
        for node in ["e1", "e1", "e2"]:
            db_session.add(OfflineAction(
                node_id=node, action_type="create_issue", resource_type="issue",
            ))
        db_session.commit()

        e1 = db_session.query(OfflineAction).filter_by(node_id="e1").all()
        assert len(e1) == 2


# ═══════════════════════════════════════════════════════════════════
# ComplianceExport Tests
# ═══════════════════════════════════════════════════════════════════


class TestComplianceExportModel:
    """Tests for the ComplianceExport ORM model."""

    def test_create_export_defaults(self, db_session: Session) -> None:
        ce = ComplianceExport(
            requested_by=uuid.uuid4(),
            report_type="audit_summary",
        )
        db_session.add(ce)
        db_session.commit()
        db_session.refresh(ce)

        assert ce.id is not None
        assert ce.export_format == ExportFormat.JSON
        assert ce.status == ExportStatus.REQUESTED
        assert ce.record_count == 0
        assert ce.completed_at is None

    def test_create_export_full(self, db_session: Session) -> None:
        ce = ComplianceExport(
            requested_by=uuid.uuid4(),
            report_type="access_log",
            export_format=ExportFormat.CSV,
            status=ExportStatus.COMPLETED,
            parameters={"ward": "Karol Bagh", "from": "2026-01-01"},
            record_count=1500,
            file_path="./exports/access_log_2026.csv",
            file_size_bytes=204800,
            completed_at=datetime.now(timezone.utc),
        )
        db_session.add(ce)
        db_session.commit()
        db_session.refresh(ce)

        assert ce.export_format == ExportFormat.CSV
        assert ce.status == ExportStatus.COMPLETED
        assert ce.record_count == 1500
        assert ce.parameters["ward"] == "Karol Bagh"

    def test_export_format_enum(self) -> None:
        assert set(ExportFormat) == {ExportFormat.PDF, ExportFormat.CSV, ExportFormat.JSON}

    def test_export_status_enum(self) -> None:
        assert set(ExportStatus) == {
            ExportStatus.REQUESTED,
            ExportStatus.PROCESSING,
            ExportStatus.COMPLETED,
            ExportStatus.FAILED,
        }

    def test_export_lifecycle(self, db_session: Session) -> None:
        """REQUESTED → PROCESSING → COMPLETED."""
        ce = ComplianceExport(
            requested_by=uuid.uuid4(),
            report_type="full_dump",
        )
        db_session.add(ce)
        db_session.commit()
        assert ce.status == ExportStatus.REQUESTED

        ce.status = ExportStatus.PROCESSING
        db_session.commit()
        db_session.refresh(ce)
        assert ce.status == ExportStatus.PROCESSING

        ce.status = ExportStatus.COMPLETED
        ce.completed_at = datetime.now(timezone.utc)
        ce.record_count = 500
        ce.file_path = "/exports/full.json"
        db_session.commit()
        db_session.refresh(ce)
        assert ce.status == ExportStatus.COMPLETED
        assert ce.completed_at is not None

    def test_export_failure(self, db_session: Session) -> None:
        ce = ComplianceExport(
            requested_by=uuid.uuid4(),
            report_type="audit_summary",
            status=ExportStatus.FAILED,
            error_message="Disk full",
        )
        db_session.add(ce)
        db_session.commit()
        db_session.refresh(ce)
        assert ce.error_message == "Disk full"

    def test_compliance_export_repr(self, db_session: Session) -> None:
        ce = ComplianceExport(
            requested_by=uuid.uuid4(),
            report_type="audit_summary",
        )
        db_session.add(ce)
        db_session.commit()
        db_session.refresh(ce)
        assert "ComplianceExport" in repr(ce)


# ═══════════════════════════════════════════════════════════════════
# PerformanceMetric Tests
# ═══════════════════════════════════════════════════════════════════


class TestPerformanceMetricModel:
    """Tests for the PerformanceMetric ORM model."""

    def test_create_metric_defaults(self, db_session: Session) -> None:
        pm = PerformanceMetric(
            category=MetricCategory.API_LATENCY,
            endpoint="/api/v1/issues",
            method="GET",
            value=45.2,
        )
        db_session.add(pm)
        db_session.commit()
        db_session.refresh(pm)

        assert pm.id is not None
        assert pm.value == pytest.approx(45.2)
        assert pm.unit == "ms"
        assert pm.recorded_at is not None

    def test_create_metric_full(self, db_session: Session) -> None:
        pm = PerformanceMetric(
            category=MetricCategory.DB_QUERY,
            endpoint="get_risk_scores_by_ward",
            method=None,
            value=12.8,
            unit="ms",
            status_code=200,
            node_id="edge-01",
            metadata_json={"query": "SELECT * FROM risk_scores WHERE ward = ?"},
        )
        db_session.add(pm)
        db_session.commit()
        db_session.refresh(pm)

        assert pm.category == MetricCategory.DB_QUERY
        assert pm.node_id == "edge-01"
        assert pm.metadata_json is not None

    def test_metric_category_enum(self) -> None:
        expected = {
            "API_LATENCY", "DB_QUERY", "SYNC_LATENCY", "CACHE_HIT",
            "MEMORY_USAGE", "CPU_USAGE", "ERROR_RATE", "THROUGHPUT",
        }
        assert {m.name for m in MetricCategory} == expected

    def test_performance_metric_repr(self, db_session: Session) -> None:
        pm = PerformanceMetric(
            category=MetricCategory.SYNC_LATENCY,
            value=2.5,
            unit="s",
        )
        db_session.add(pm)
        db_session.commit()
        db_session.refresh(pm)
        assert "PerformanceMetric" in repr(pm)

    def test_filter_by_category(self, db_session: Session) -> None:
        db_session.add(PerformanceMetric(category=MetricCategory.API_LATENCY, value=50.0))
        db_session.add(PerformanceMetric(category=MetricCategory.DB_QUERY, value=10.0))
        db_session.add(PerformanceMetric(category=MetricCategory.API_LATENCY, value=60.0))
        db_session.commit()

        api = db_session.query(PerformanceMetric).filter_by(category=MetricCategory.API_LATENCY).all()
        assert len(api) == 2

    def test_sync_latency_under_threshold(self, db_session: Session) -> None:
        """NFR: Sync latency < 3 seconds."""
        pm = PerformanceMetric(
            category=MetricCategory.SYNC_LATENCY,
            value=1.8,
            unit="s",
        )
        db_session.add(pm)
        db_session.commit()
        db_session.refresh(pm)
        assert pm.value < 3.0


# ═══════════════════════════════════════════════════════════════════
# RateLimitRecord Tests
# ═══════════════════════════════════════════════════════════════════


class TestRateLimitRecordModel:
    """Tests for the RateLimitRecord ORM model."""

    def test_create_rate_limit_defaults(self, db_session: Session) -> None:
        rl = RateLimitRecord(
            client_ip="192.168.1.100",
            endpoint="/api/v1/issues",
        )
        db_session.add(rl)
        db_session.commit()
        db_session.refresh(rl)

        assert rl.id is not None
        assert rl.client_ip == "192.168.1.100"
        assert rl.request_count == 1
        assert rl.window_seconds == 60
        assert rl.blocked == 0
        assert rl.created_at is not None

    def test_create_rate_limit_blocked(self, db_session: Session) -> None:
        user_id = uuid.uuid4()
        rl = RateLimitRecord(
            client_ip="10.0.0.1",
            user_id=user_id,
            endpoint="/api/v1/agent/query",
            request_count=101,
            window_seconds=60,
            blocked=1,
        )
        db_session.add(rl)
        db_session.commit()
        db_session.refresh(rl)

        assert rl.blocked == 1
        assert rl.user_id == user_id
        assert rl.request_count == 101

    def test_rate_limit_record_repr(self, db_session: Session) -> None:
        rl = RateLimitRecord(client_ip="1.2.3.4", endpoint="/test")
        db_session.add(rl)
        db_session.commit()
        db_session.refresh(rl)
        assert "RateLimitRecord" in repr(rl)

    def test_filter_blocked(self, db_session: Session) -> None:
        db_session.add(RateLimitRecord(client_ip="1.1.1.1", endpoint="/a", blocked=0))
        db_session.add(RateLimitRecord(client_ip="2.2.2.2", endpoint="/b", blocked=1))
        db_session.add(RateLimitRecord(client_ip="3.3.3.3", endpoint="/c", blocked=1))
        db_session.commit()

        blocked = db_session.query(RateLimitRecord).filter_by(blocked=1).all()
        assert len(blocked) == 2

    def test_ipv6_support(self, db_session: Session) -> None:
        rl = RateLimitRecord(
            client_ip="2001:0db8:85a3:0000:0000:8a2e:0370:7334",
            endpoint="/api/v1/issues",
        )
        db_session.add(rl)
        db_session.commit()
        db_session.refresh(rl)
        assert "2001" in rl.client_ip


# ═══════════════════════════════════════════════════════════════════
# Cross-Model & Config Tests
# ═══════════════════════════════════════════════════════════════════


class TestPhase4Config:
    """Verify Phase 4 configuration settings exist."""

    def test_config_has_offline_sync_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert hasattr(s, "OFFLINE_MODE_ENABLED")
        assert s.OFFLINE_MODE_ENABLED is False
        assert s.SYNC_INTERVAL_SECONDS == 30
        assert s.SYNC_MAX_RETRIES == 3
        assert s.SYNC_BATCH_SIZE == 50
        assert s.DEFAULT_NODE_ID == "central"

    def test_config_has_hardening_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert s.RATE_LIMIT_REQUESTS == 100
        assert s.RATE_LIMIT_WINDOW_SECONDS == 60
        assert s.ENFORCE_HTTPS is False
        assert s.TOKEN_ROTATION_ENABLED is False
        assert s.TOKEN_ROTATION_DAYS == 7

    def test_config_has_compliance_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert s.COMPLIANCE_EXPORT_DIR == "./exports"
        assert s.COMPLIANCE_RETENTION_DAYS == 730

    def test_config_has_monitoring_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert s.ENABLE_PERFORMANCE_TRACKING is True
        assert s.METRICS_RETENTION_DAYS == 90
        assert s.HEALTH_CHECK_INTERVAL_SECONDS == 30


class TestPhase4ModelImports:
    """Verify Phase 4 models are exported from the models package."""

    def test_all_phase4_models_importable(self) -> None:
        from app.models import (
            SyncQueue,
            ConflictLog,
            OfflineAction,
            ComplianceExport,
            PerformanceMetric,
            RateLimitRecord,
        )
        assert SyncQueue is not None
        assert ConflictLog is not None
        assert OfflineAction is not None
        assert ComplianceExport is not None
        assert PerformanceMetric is not None
        assert RateLimitRecord is not None


class TestOfflineToSyncIntegration:
    """Integration tests: OfflineAction → SyncQueue → ConflictLog flow."""

    def test_full_offline_sync_conflict_flow(self, db_session: Session) -> None:
        """Simulate: offline action → sync queue → conflict detected."""
        # 1. Create offline action
        res_id = uuid.uuid4()
        oa = OfflineAction(
            node_id="edge-01",
            action_type="update_issue",
            resource_type="issue",
            resource_id=res_id,
            payload={"status": "closed"},
        )
        db_session.add(oa)
        db_session.commit()

        # 2. Move to sync queue
        oa.status = OfflineStatus.QUEUED
        oa.queued_at = datetime.now(timezone.utc)
        sq = SyncQueue(
            node_id=oa.node_id,
            operation=SyncOperation.UPDATE,
            resource_type=oa.resource_type,
            resource_id=res_id,
            payload=oa.payload,
        )
        db_session.add(sq)
        db_session.commit()

        # 3. Conflict detected
        sq.status = SyncStatus.CONFLICT
        cl = ConflictLog(
            sync_queue_id=sq.id,
            node_id=oa.node_id,
            resource_type="issue",
            resource_id=res_id,
            local_data={"status": "closed"},
            server_data={"status": "in_progress"},
        )
        db_session.add(cl)
        db_session.commit()

        # 4. Resolve conflict
        cl.resolution = ConflictResolution.SERVER_WINS
        cl.resolved_at = datetime.now(timezone.utc)
        sq.status = SyncStatus.SYNCED
        sq.synced_at = datetime.now(timezone.utc)
        oa.status = OfflineStatus.SYNCED
        db_session.commit()

        db_session.refresh(oa)
        db_session.refresh(sq)
        db_session.refresh(cl)

        assert oa.status == OfflineStatus.SYNCED
        assert sq.status == SyncStatus.SYNCED
        assert cl.resolution == ConflictResolution.SERVER_WINS
