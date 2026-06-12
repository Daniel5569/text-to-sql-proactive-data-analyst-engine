import pytest

from analyst_engine.semantic_layer import resolve_question


def test_resolve_question_maps_revenue_to_governed_metric() -> None:
    resolution = resolve_question("Show revenue by month")

    assert resolution.metric == "monthly_revenue"
    assert resolution.allowed_table == "analytics_orders"


def test_resolve_question_fails_closed_for_unknown_terms() -> None:
    with pytest.raises(ValueError, match="unsupported_business_term"):
        resolve_question("Show executive salaries")
