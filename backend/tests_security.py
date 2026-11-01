"""Security regression checks for the validator. Run: python tests_security.py"""
from app.agent.validator import validate

BLOCK = [
    "DROP TABLE customers",
    "DELETE FROM orders",
    "SELECT * FROM sqlite_master",
    "SELECT * FROM users",
    "Show me all customers; DROP TABLE orders",
    "SELECT 1; SELECT 2",
    "INSERT INTO customers VALUES (1)",
    "UPDATE orders SET status='x'",
    "PRAGMA table_info(orders)",
    "ATTACH DATABASE 'x.db' AS x",
    "SELECT * FROM orders -- ; DROP TABLE orders",
    "SELECT * FROM main.sqlite_schema",
    "SELECT * FROM orders, secrets",
    "SELECT * FROM orders o JOIN hidden h ON 1=1",
    "SELECT * FROM (SELECT * FROM users)",
    "WITH x AS (SELECT * FROM users) SELECT * FROM x",
    "SELECT * FROM pragma_table_info('orders')",
    "WITH x AS (SELECT 1) REPLACE INTO customers SELECT * FROM x",
    "REPLACE INTO customers VALUES (1)",
    "WITH d AS (DELETE FROM orders RETURNING *) SELECT * FROM d",
    "SELECT * FROM temp.foo",
]
ALLOW = [
    "SELECT replace(name,'a','b') FROM customers",
    "SELECT * FROM customers",
    "SELECT p.name, SUM(oi.quantity*oi.unit_price) r FROM order_items oi JOIN products p ON p.id=oi.product_id "
    "JOIN orders o ON o.id=oi.order_id WHERE o.status!='cancelled' GROUP BY p.name ORDER BY r DESC LIMIT 5;",
    "WITH m AS (SELECT strftime('%Y-%m',order_date) mo, total_amount t FROM orders) SELECT mo, SUM(t) FROM m GROUP BY mo",
    "SELECT city, COUNT(*) FROM customers GROUP BY city",
    "SELECT * FROM orders, customers WHERE orders.customer_id = customers.id",
    "SELECT name FROM products WHERE category_id IN (SELECT id FROM categories WHERE name='Books')",
    "SELECT * FROM customers WHERE name = 'DROP TABLE x'",
    "SELECT * FROM orders -- recent first",
]

if __name__ == "__main__":
    bad = 0
    for q in BLOCK:
        ok, why = validate(q)
        print(("PASS" if not ok else "FAIL"), "block", repr(q[:60]), "->", why)
        bad += ok
    for q in ALLOW:
        ok, why = validate(q)
        print(("PASS" if ok else "FAIL"), "allow", repr(q[:60]), "->", why)
        bad += not ok
    raise SystemExit(1 if bad else 0)
