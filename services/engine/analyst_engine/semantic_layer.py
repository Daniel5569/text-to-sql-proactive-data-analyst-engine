from dataclasses import dataclass


@dataclass(frozen=True)
class SemanticResolution:
    metric: str
    allowed_table: str
    allowed_columns: tuple[str, ...]
    intent: str


SUPPORTED_TERMS: dict[str, SemanticResolution] = {
    "revenue": SemanticResolution(
        metric="monthly_revenue",
        allowed_table="analytics_orders",
        allowed_columns=("order_month", "revenue_cents", "organization_id"),
        intent="monthly_revenue",
    ),
    "active customers": SemanticResolution(
        metric="active_customers",
        allowed_table="analytics_customers",
        allowed_columns=("id", "status", "organization_id"),
        intent="active_customers",
    ),
}


def resolve_question(question: str) -> SemanticResolution:
    normalized = question.lower()
    for term, resolution in SUPPORTED_TERMS.items():
        if term in normalized:
            return resolution
    raise ValueError("unsupported_business_term")
