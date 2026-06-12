import json
import time
from typing import Any

import asyncpg

from .config import settings


class Database:
    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        self.pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def fetch_request(self, analysis_request_id: str) -> asyncpg.Record | None:
        assert self.pool is not None
        return await self.pool.fetchrow(
            """
            SELECT ar.*, o.slug AS organization_slug
            FROM analysis_requests ar
            JOIN organizations o ON o.id = ar.organization_id
            WHERE ar.id = $1
            """,
            analysis_request_id,
        )

    async def set_request_status(self, analysis_request_id: str, status: str) -> None:
        assert self.pool is not None
        await self.pool.execute(
            "UPDATE analysis_requests SET status = $2, updated_at = now() WHERE id = $1",
            analysis_request_id,
            status,
        )

    async def add_audit_event(
        self, analysis_request_id: str, event_type: str, payload: dict[str, Any]
    ) -> None:
        assert self.pool is not None
        await self.pool.execute(
            "INSERT INTO audit_events (analysis_request_id, event_type, payload_json) VALUES ($1, $2, $3::jsonb)",
            analysis_request_id,
            event_type,
            json.dumps(payload),
        )

    async def record_query_attempt(
        self,
        analysis_request_id: str,
        sql: str,
        validation_status: str,
        rejection_reason: str | None = None,
        execution_ms: int | None = None,
        row_count: int | None = None,
    ) -> None:
        assert self.pool is not None
        await self.pool.execute(
            """
            INSERT INTO query_attempts
              (analysis_request_id, generated_sql, validation_status, rejection_reason, execution_ms, row_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            analysis_request_id,
            sql,
            validation_status,
            rejection_reason,
            execution_ms,
            row_count,
        )

    async def execute_readonly(self, sql: str) -> tuple[list[dict[str, Any]], int]:
        assert self.pool is not None
        started = time.perf_counter()
        async with self.pool.acquire() as connection:
            async with connection.transaction(readonly=True):
                await connection.execute("SET LOCAL statement_timeout = '5000ms'")
                rows = await connection.fetch(sql)
        execution_ms = int((time.perf_counter() - started) * 1000)
        return [dict(row) for row in rows], execution_ms

    async def insert_chart_payload(
        self, analysis_request_id: str, chart_type: str, title: str, payload: dict[str, Any]
    ) -> None:
        assert self.pool is not None
        await self.pool.execute(
            """
            INSERT INTO chart_payloads (analysis_request_id, chart_type, title, payload_json)
            VALUES ($1, $2, $3, $4::jsonb)
            """,
            analysis_request_id,
            chart_type,
            title,
            json.dumps(payload, default=str),
        )


database = Database()
