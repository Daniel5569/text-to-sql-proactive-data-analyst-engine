from analyst_engine.planner import plan_query
from analyst_engine.validator import validate_sql


def test_plan_query_generates_bounded_monthly_revenue_sql() -> None:
    plan = plan_query("Show revenue by month", organization_id=1)

    assert "FROM analytics_orders" in plan.sql
    assert "LIMIT 12" in plan.sql
    assert plan.chart_type == "line"
    assert validate_sql(plan.sql).accepted is True


def test_validator_rejects_mutating_statements() -> None:
    result = validate_sql("DELETE FROM analytics_orders")

    assert result.accepted is False
    assert result.reason == "only_select_allowed"


def test_validator_rejects_unknown_tables() -> None:
    result = validate_sql("SELECT id FROM payroll LIMIT 10")

    assert result.accepted is False
    assert result.reason == "table_not_allowed"


def test_validator_requires_limit() -> None:
    result = validate_sql("SELECT order_month FROM analytics_orders")

    assert result.accepted is False
    assert result.reason == "limit_required"


def test_validator_rejects_comments_and_semicolons() -> None:
    assert validate_sql("SELECT order_month FROM analytics_orders LIMIT 10;").reason == "semicolon_rejected"
    assert (
        validate_sql("SELECT order_month FROM analytics_orders -- hide predicate\nLIMIT 10").reason
        == "comments_rejected"
    )


def test_validator_rejects_ctes_union_and_wildcards() -> None:
    assert (
        validate_sql("WITH x AS (SELECT id FROM analytics_orders LIMIT 10) SELECT id FROM x LIMIT 10").reason
        == "cte_rejected"
    )
    assert (
        validate_sql(
            "SELECT id FROM analytics_orders LIMIT 10 UNION SELECT id FROM analytics_customers LIMIT 10"
        ).reason
        == "set_operations_rejected"
    )
    assert validate_sql("SELECT * FROM analytics_orders LIMIT 10").reason == "wildcard_rejected"


def test_validator_rejects_risky_functions_and_unbounded_limits() -> None:
    assert validate_sql("SELECT pg_sleep(1) FROM analytics_orders LIMIT 10").reason == "function_not_allowed"
    assert validate_sql("SELECT order_month FROM analytics_orders LIMIT 1001").reason == "limit_too_large"
