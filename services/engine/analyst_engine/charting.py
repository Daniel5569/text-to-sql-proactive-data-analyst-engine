from typing import Any


def build_chart_payload(rows: list[dict[str, Any]], chart_type: str, title: str) -> dict[str, Any]:
    return {
        "type": chart_type,
        "title": title,
        "data": rows,
        "encoding": {
            "x": list(rows[0].keys())[0] if rows else "dimension",
            "y": list(rows[0].keys())[1] if rows and len(rows[0]) > 1 else "value",
        },
    }
