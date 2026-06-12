from dataclasses import dataclass

from .semantic_layer import resolve_question


@dataclass(frozen=True)
class QueryPlan:
    question: str
    metric: str
    sql: str
    chart_type: str
    title: str


def plan_query(question: str, organization_id: int) -> QueryPlan:
    resolution = resolve_question(question)
    if resolution.intent == "monthly_revenue":
        return QueryPlan(
            question=question,
            metric=resolution.metric,
            sql=(
                "SELECT order_month, SUM(revenue_cents) AS revenue_cents "
                "FROM analytics_orders "
                f"WHERE organization_id = {organization_id} "
                "GROUP BY order_month "
                "ORDER BY order_month "
                "LIMIT 12"
            ),
            chart_type="line",
            title="Monthly revenue",
        )
    if resolution.intent == "active_customers":
        return QueryPlan(
            question=question,
            metric=resolution.metric,
            sql=(
                "SELECT status, COUNT(*) AS customer_count "
                "FROM analytics_customers "
                f"WHERE organization_id = {organization_id} "
                "GROUP BY status "
                "ORDER BY status "
                "LIMIT 10"
            ),
            chart_type="bar",
            title="Customers by status",
        )
    raise ValueError("unsupported_intent")
