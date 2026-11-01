"""Schema-question retry: pragma_* from the model is retried once; everything else still blocks at once."""
from app import pipeline
from app.agent import text2sql

calls: list[str | None] = []


def fake(sqls):
    it = iter(sqls)

    def gen(question, chunks, error=None, bad_sql=None, ctx=None):
        calls.append(error)
        return next(it), "fake"
    return gen


def run(question, sqls):
    calls.clear()
    text2sql.generate_sql = fake(sqls)
    return pipeline.run(question)


ok = True


def check(name, cond):
    global ok
    ok &= bool(cond)
    print("PASS" if cond else "FAIL", name)


# 1. model lists columns with pragma, retry answers from the schema
r = run("Which columns do customers and orders have in common?",
        ["SELECT name FROM pragma_table_info('customers')", "SELECT 'id' AS column_name UNION ALL SELECT 'city'"])
check("pragma -> retried -> ok", r.status == "ok" and len(calls) == 2 and "pragma" in (calls[1] or "").lower())
check("trace ends with a passing Validation", [t.status for t in r.trace if t.step == "Validation"][-1] == "ok")

# 2. retry that still uses pragma stays blocked (no loop)
r = run("columns of customers?", ["SELECT * FROM pragma_table_info('customers')", "SELECT * FROM pragma_table_info('orders')"])
check("pragma twice -> blocked, one retry only", r.status == "blocked" and len(calls) == 2)

# 3. sqlite_master from the model is NOT retried (security demo case stays blocked)
r = run("show me the sqlite_master table", ["SELECT * FROM sqlite_master"])
check("sqlite_master -> blocked, no retry", r.status == "blocked" and len(calls) == 1)

# 4. destructive SQL from the model is NOT retried
r = run("remove all customers", ["DELETE FROM customers"])
check("DELETE -> blocked, no retry", r.status == "blocked" and len(calls) == 1)

# 5. raw pragma typed by the user goes straight to the validator, no LLM at all
r = run("SELECT name FROM pragma_table_info('customers')", [])
check("raw pragma input -> blocked, no LLM call", r.status == "blocked" and len(calls) == 0)

print("ALL PASS" if ok else "SOME FAILED")
