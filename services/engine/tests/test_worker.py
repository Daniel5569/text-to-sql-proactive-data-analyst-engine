from typing import Any

import pytest

from analyst_engine import worker


def test_parse_stream_payload_accepts_valid_payload() -> None:
    payload = worker.parse_stream_payload(
        {"payload": '{"analysisRequestId":"req-1","organizationSlug":"demo-co","semanticProfile":"saas"}'}
    )

    assert payload == {
        "analysisRequestId": "req-1",
        "organizationSlug": "demo-co",
        "semanticProfile": "saas",
    }


def test_parse_stream_payload_rejects_invalid_payloads() -> None:
    assert worker.parse_stream_payload({"payload": "not-json"}) is None
    assert worker.parse_stream_payload({"payload": '["not-object"]'}) is None
    assert worker.parse_stream_payload({"payload": '{"analysisRequestId":"req-1"}'}) is None


class FakeRequest(dict):
    def __getattr__(self, item: str) -> Any:
        return self[item]


class FakeDatabase:
    def __init__(self, question: str) -> None:
        self.question = question
        self.statuses: list[tuple[str, str]] = []
        self.query_attempts: list[dict[str, Any]] = []
        self.chart_payloads: list[dict[str, Any]] = []
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def fetch_request(self, analysis_request_id: str) -> FakeRequest:
        assert analysis_request_id == "req-1"
        return FakeRequest(id="req-1", organization_id=1, question=self.question)

    async def set_request_status(self, analysis_request_id: str, status: str) -> None:
        self.statuses.append((analysis_request_id, status))

    async def add_audit_event(
        self, analysis_request_id: str, event_type: str, payload: dict[str, Any]
    ) -> None:
        self.events.append((event_type, payload))

    async def record_query_attempt(
        self,
        analysis_request_id: str,
        sql: str,
        validation_status: str,
        rejection_reason: str | None = None,
        execution_ms: int | None = None,
        row_count: int | None = None,
    ) -> None:
        self.query_attempts.append(
            {
                "sql": sql,
                "validation_status": validation_status,
                "rejection_reason": rejection_reason,
                "execution_ms": execution_ms,
                "row_count": row_count,
            }
        )

    async def execute_readonly(self, sql: str) -> tuple[list[dict[str, Any]], int]:
        return [{"order_month": "2026-05-01", "revenue_cents": 175000}], 14

    async def insert_chart_payload(
        self, analysis_request_id: str, chart_type: str, title: str, payload: dict[str, Any]
    ) -> None:
        self.chart_payloads.append({"chart_type": chart_type, "title": title, "payload": payload})


@pytest.mark.asyncio
async def test_process_job_completes_valid_revenue_question(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_db = FakeDatabase("Show revenue by month")
    monkeypatch.setattr(worker, "database", fake_db)

    await worker.process_job(
        {"analysisRequestId": "req-1", "organizationSlug": "demo-co", "semanticProfile": "saas"}
    )

    assert fake_db.statuses[0] == ("req-1", "running")
    assert fake_db.statuses[-1] == ("req-1", "completed")
    assert fake_db.query_attempts[0]["validation_status"] == "accepted"
    assert fake_db.chart_payloads[0]["chart_type"] == "line"


@pytest.mark.asyncio
async def test_process_job_fails_closed_for_unsupported_business_term(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_db = FakeDatabase("Show executive salaries")
    monkeypatch.setattr(worker, "database", fake_db)

    await worker.process_job(
        {"analysisRequestId": "req-1", "organizationSlug": "demo-co", "semanticProfile": "saas"}
    )

    assert fake_db.statuses[-1] == ("req-1", "failed")
    assert any(event_type == "analysis.failed" for event_type, _ in fake_db.events)


class FakeRedisForReclaim:
    def __init__(self) -> None:
        self.acked: list[str] = []
        self.claimed_message_ids: list[str] = []

    async def xpending_range(self, *args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        assert kwargs["idle"] == 60000
        return [{"message_id": "1670000000000-0", "time_since_delivered": 65000}]

    async def xclaim(self, *args: Any, **kwargs: Any) -> list[tuple[str, dict[str, str]]]:
        self.claimed_message_ids = list(kwargs["message_ids"])
        return [
            (
                "1670000000000-0",
                {
                    "payload": (
                        '{"analysisRequestId":"req-1","organizationSlug":"demo-co",'
                        '"semanticProfile":"saas"}'
                    )
                },
            )
        ]

    async def xack(self, stream_key: str, group: str, message_id: str) -> None:
        assert stream_key == worker.STREAM_KEY
        assert group == worker.CONSUMER_GROUP
        self.acked.append(message_id)


@pytest.mark.asyncio
async def test_reclaim_stale_pending_uses_xclaim(monkeypatch: pytest.MonkeyPatch) -> None:
    processed: list[dict[str, str]] = []

    async def fake_process_job(payload: dict[str, str]) -> None:
        processed.append(payload)

    fake_redis = FakeRedisForReclaim()
    monkeypatch.setattr(worker, "process_job", fake_process_job)

    claimed_count = await worker.reclaim_stale_pending(fake_redis)  # type: ignore[arg-type]

    assert claimed_count == 1
    assert fake_redis.claimed_message_ids == ["1670000000000-0"]
    assert fake_redis.acked == ["1670000000000-0"]
    assert processed[0]["analysisRequestId"] == "req-1"
