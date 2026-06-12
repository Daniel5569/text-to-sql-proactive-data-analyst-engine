from dataclasses import dataclass

import sqlglot
from sqlglot import exp

ALLOWED_TABLES = {"analytics_orders", "analytics_customers"}
ALLOWED_FUNCTIONS = {"sum", "count"}
MAX_LIMIT = 1000


@dataclass(frozen=True)
class ValidationResult:
    accepted: bool
    reason: str | None = None


def validate_sql(sql: str) -> ValidationResult:
    normalized = sql.lower()
    if ";" in sql:
        return ValidationResult(False, "semicolon_rejected")
    if "--" in normalized or "/*" in normalized or "*/" in normalized:
        return ValidationResult(False, "comments_rejected")

    try:
        expressions = sqlglot.parse(sql, dialect="postgres")
    except sqlglot.errors.ParseError as exc:
        return ValidationResult(False, f"parse_error:{exc}")

    if len(expressions) != 1:
        return ValidationResult(False, "multiple_statements_rejected")

    expression = expressions[0]
    if isinstance(expression, (exp.Union, exp.Except, exp.Intersect)):
        return ValidationResult(False, "set_operations_rejected")
    if not isinstance(expression, exp.Select):
        return ValidationResult(False, "only_select_allowed")
    if expression.args.get("with_"):
        return ValidationResult(False, "cte_rejected")
    if any(isinstance(node, (exp.Union, exp.Except, exp.Intersect)) for node in expression.walk()):
        return ValidationResult(False, "set_operations_rejected")
    if any(isinstance(node, exp.Star) for node in expression.walk()):
        return ValidationResult(False, "wildcard_rejected")

    tables = {table.name for table in expression.find_all(exp.Table)}
    if not tables:
        return ValidationResult(False, "no_table_reference")
    if not tables.issubset(ALLOWED_TABLES):
        return ValidationResult(False, "table_not_allowed")

    if expression.args.get("limit") is None:
        return ValidationResult(False, "limit_required")
    limit = expression.args["limit"].expression
    if limit is None or not str(limit).isdigit():
        return ValidationResult(False, "static_limit_required")
    if int(str(limit)) > MAX_LIMIT:
        return ValidationResult(False, "limit_too_large")

    for function in expression.find_all(exp.Func):
        if function.sql_name().lower() not in ALLOWED_FUNCTIONS:
            return ValidationResult(False, "function_not_allowed")

    return ValidationResult(True)
