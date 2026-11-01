"""CLI smoke test: run questions through the pipeline. Usage: python run_questions.py ["question" ...]"""
import sys

from app import pipeline

DEFAULTS = [
    "Top 5 products last month",
    "Revenue by month for the last 6 months",
    "Which city has the most customers?",
    "Best-selling category this quarter",
    "How many orders are in each status?",
    "What is the total revenue of completed orders?",
    "Show orders from the last week",
    "Average order value by country",
    "Which customers spent the most?",
    "DROP TABLE customers",
    "DELETE FROM orders",
    "SELECT * FROM sqlite_master",
    "SELECT * FROM users",
    "Show me all customers; DROP TABLE orders",
]

if __name__ == "__main__":
    for q in sys.argv[1:] or DEFAULTS:
        res = pipeline.run(q)
        steps = " | ".join(f"{s.step} {s.ms}ms {s.status}" for s in res.trace)
        print(f"\nQ: {q}\n  status={res.status} chart={res.chart.type}({res.chart.x},{res.chart.y}) "
              f"rows={len(res.data)} total={res.total_ms}ms")
        print(f"  sql: {res.sql}")
        if res.error:
            print(f"  error: {res.error}")
        for i in res.insights:
            print(f"  * {i}")
        print(f"  trace: {steps}")
