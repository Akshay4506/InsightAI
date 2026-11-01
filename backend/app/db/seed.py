"""Create and seed the e-commerce sample.db (deterministic, relative to today).

Run from backend/:  python -m app.db.seed
"""
import random
import sqlite3
from datetime import date, timedelta

from app.config import DB_PATH

SCHEMA = """
CREATE TABLE customers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  city TEXT NOT NULL, country TEXT NOT NULL, signup_date DATE NOT NULL);
CREATE TABLE categories (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT);
CREATE TABLE products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price REAL NOT NULL, stock INTEGER NOT NULL);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL, status TEXT NOT NULL, total_amount REAL NOT NULL);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL, unit_price REAL NOT NULL);
"""

CITIES = [("Mumbai", "India"), ("Delhi", "India"), ("Bengaluru", "India"),
          ("London", "United Kingdom"), ("New York", "United States"), ("Berlin", "Germany")]
FIRST = ["Aarav", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Karan", "Meera", "Arjun", "Diya",
         "Liam", "Emma", "Noah", "Olivia", "Lukas", "Hannah", "James", "Sophie", "Ethan", "Mia"]
LAST = ["Sharma", "Patel", "Singh", "Reddy", "Iyer", "Khan", "Smith", "Jones", "Muller", "Brown"]

CATEGORIES = [
    ("Electronics", "Gadgets, audio and computing devices"),
    ("Clothing", "Apparel and footwear"),
    ("Books", "Fiction, non-fiction and technical books"),
    ("Home", "Furniture, kitchen and decor"),
    ("Sports", "Fitness and outdoor equipment"),
    ("Beauty", "Skincare and personal care"),
    ("Toys", "Games and toys for kids"),
    ("Food", "Gourmet snacks and beverages"),
]

# (name, category id, list price)
PRODUCTS = [
    ("Wireless Earbuds Pro", 1, 129.0), ("Laptop Pro 14", 1, 1299.0), ("Smartwatch S5", 1, 249.0),
    ("Bluetooth Speaker Mini", 1, 59.0), ("4K Action Camera", 1, 189.0), ("USB-C Hub 7-in-1", 1, 45.0),
    ("Mechanical Keyboard K2", 1, 99.0), ("Gaming Mouse G7", 1, 55.0),
    ("Running Shoes X2", 2, 89.0), ("Denim Jacket Classic", 2, 79.0), ("Cotton T-Shirt Pack", 2, 29.0),
    ("Wool Winter Scarf", 2, 35.0), ("Yoga Leggings", 2, 49.0), ("Leather Belt", 2, 39.0),
    ("The Data Science Handbook", 3, 42.0), ("Python in Practice", 3, 38.0), ("Midnight Garden (Novel)", 3, 16.0),
    ("Deep Learning Illustrated", 3, 55.0), ("Startup Playbook", 3, 24.0),
    ("Ceramic Dinner Set", 4, 120.0), ("Memory Foam Pillow", 4, 45.0), ("Smart LED Lamp", 4, 34.0),
    ("Air Fryer 5L", 4, 99.0), ("Cast Iron Skillet", 4, 40.0), ("Aroma Diffuser", 4, 28.0),
    ("Yoga Mat Premium", 5, 32.0), ("Adjustable Dumbbell Set", 5, 149.0), ("Trail Backpack 30L", 5, 74.0),
    ("Cycling Helmet Aero", 5, 65.0), ("Resistance Bands Kit", 5, 19.0), ("Insulated Water Bottle", 5, 25.0),
    ("Vitamin C Serum", 6, 27.0), ("Hydrating Face Cream", 6, 33.0), ("Beard Grooming Kit", 6, 36.0),
    ("Sunscreen SPF 50", 6, 18.0), ("Herbal Shampoo", 6, 14.0),
    ("Building Blocks 500pc", 7, 39.0), ("RC Racing Car", 7, 54.0), ("Plush Teddy Bear", 7, 22.0),
    ("Strategy Board Game", 7, 44.0), ("Kids Science Kit", 7, 31.0), ("Jigsaw Puzzle 1000pc", 7, 21.0),
    ("Single Origin Coffee 1kg", 8, 26.0), ("Organic Green Tea Box", 8, 15.0), ("Dark Chocolate Gift Box", 8, 23.0),
    ("Mixed Nuts Family Pack", 8, 19.0), ("Artisan Honey Jar", 8, 12.0), ("Protein Bar Box (12)", 8, 24.0),
    ("Olive Oil Extra Virgin", 8, 17.0), ("Spicy Hot Sauce Trio", 8, 13.0),
]


def build(path=DB_PATH, seed: int = 42) -> None:
    """Drop and recreate the database file with deterministic seed data."""
    rnd = random.Random(seed)
    today = date.today()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)

    customers = []
    for i in range(1, 41):
        city, country = CITIES[(i - 1) % 6]
        name = f"{rnd.choice(FIRST)} {rnd.choice(LAST)}"
        email = f"{name.lower().replace(' ', '.')}{i}@example.com"
        signup = today - timedelta(days=rnd.randint(200, 700))
        customers.append((i, name, email, city, country, signup.isoformat()))
    con.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?)", customers)
    con.executemany("INSERT INTO categories VALUES (?,?,?)",
                    [(i + 1, n, d) for i, (n, d) in enumerate(CATEGORIES)])
    con.executemany("INSERT INTO products VALUES (?,?,?,?,?)",
                    [(i + 1, n, c, p, rnd.randint(10, 400)) for i, (n, c, p) in enumerate(PRODUCTS)])

    # "Wireless Earbuds Pro" (id 1) is the clear star product; Laptop Pro 14 is second.
    weights = [1.0] * len(PRODUCTS)
    weights[0], weights[1], weights[2], weights[8] = 9.0, 4.0, 3.0, 3.0
    for idx in (14, 25, 41):
        weights[idx] = 2.0
    ids = list(range(1, len(PRODUCTS) + 1))

    order_id = item_id = 0
    orders, items = [], []
    start = today - timedelta(days=180)
    for _ in range(320):
        order_id += 1
        d = start + timedelta(days=rnd.randint(0, 180))
        if rnd.random() < 0.25:  # recent months are busier (growth story)
            d = today - timedelta(days=rnd.randint(0, 60))
        status = rnd.choices(["completed", "pending", "cancelled"], [78, 12, 10])[0]
        total = 0.0
        for pid in set(rnd.choices(ids, weights, k=rnd.choice([2, 3, 3, 4]))):
            item_id += 1
            qty = rnd.choices([1, 2, 3, 4, 5], [45, 28, 15, 8, 4])[0]
            unit = round(PRODUCTS[pid - 1][2] * rnd.choice([1.0, 1.0, 0.95, 0.9]), 2)
            total += qty * unit
            items.append((item_id, order_id, pid, qty, unit))
        orders.append((order_id, rnd.randint(1, 40), d.isoformat(), status, round(total, 2)))
    con.executemany("INSERT INTO orders VALUES (?,?,?,?,?)", orders)
    con.executemany("INSERT INTO order_items VALUES (?,?,?,?,?)", items)
    con.commit()
    con.close()


if __name__ == "__main__":
    build()
    c = sqlite3.connect(DB_PATH)
    for t in ("customers", "categories", "products", "orders", "order_items"):
        print(t, c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
    print(c.execute("SELECT status, COUNT(*) FROM orders GROUP BY status").fetchall())
    print(c.execute("""SELECT p.name, SUM(oi.quantity*oi.unit_price) r FROM order_items oi
        JOIN products p ON p.id=oi.product_id JOIN orders o ON o.id=oi.order_id
        WHERE o.status!='cancelled' GROUP BY p.name ORDER BY r DESC LIMIT 3""").fetchall())
