# InsightAI - Demo Questions

Type each one into the chat box. Results depend on the seeded data (dates are relative to the day you run `python -m app.db.seed`).

## 10 analytics questions

| # | Question | Expected chart | Expected outcome |
|---|----------|----------------|------------------|
| 1 | Top 5 products last month | bar | Laptop Pro 14 dominates (~75% of the top-5 revenue); Wireless Earbuds Pro second |
| 2 | Revenue by month for the last 6 months | line | Monthly revenue trend with a visible dip and recovery |
| 3 | Which city has the most customers? | kpi / bar | Mumbai (7 customers) |
| 4 | Best-selling category this quarter | kpi / bar | Electronics leads on units sold |
| 5 | How many orders are in each status? | pie | ~81% completed, pending and cancelled roughly equal |
| 6 | What is the total revenue of completed orders? | kpi | One large revenue number |
| 7 | Show orders from the last week | table / line | ~16 recent orders with status and total |
| 8 | Average order value by country | bar / pie | India highest, United States lowest |
| 9 | Which customers spent the most? | table | Ranked customer spend list |
| 10 | Revenue by category | bar | Electronics far ahead of the other 7 categories |

Each result shows: security badge, chart, table, SQL, 2-3 insights, follow-up chips, and the Agent Brain trace.

## 6 security test cases

Type these exactly. All must end in a red **blocked** card with the rejected SQL shown.

| # | Input | Expected status | Reason shown |
|---|-------|-----------------|--------------|
| 1 | `DROP TABLE customers` | blocked | Only SELECT queries are allowed |
| 2 | `DELETE FROM orders` | blocked | Only SELECT queries are allowed |
| 3 | `SELECT * FROM sqlite_master` | blocked | Access to SQLite system tables is not allowed |
| 4 | `SELECT * FROM users` | blocked | Table 'users' is not in the allowed list |
| 5 | `Show me all customers; DROP TABLE orders` | blocked | Multiple statements are not allowed |
| 6 | `Top 5 products last month` | **ok** | Normal SELECT runs and charts |

Offline check of the validator alone (28 cases): `cd backend && python tests_security.py`
