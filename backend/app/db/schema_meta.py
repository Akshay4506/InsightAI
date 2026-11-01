"""Business-friendly descriptions of tables/columns.

These are embedded into ChromaDB and injected into the Text-to-SQL prompt.
Written like a senior analyst briefing a new hire.
"""

TABLE_DESCRIPTIONS = {
    "customers": (
        "People who buy from us. One row per customer. Use city/country for geographic "
        "breakdowns and signup_date for acquisition/cohort questions. "
        "To count customers use COUNT(*) or COUNT(DISTINCT id)."
    ),
    "categories": (
        "Product categories (Electronics, Clothing, Books, Home, Sports, Beauty, Toys, Food). "
        "Join products.category_id = categories.id to group sales by category."
    ),
    "products": (
        "Catalogue of items we sell. One row per product. price is the current list price; "
        "stock is units on hand. For sales performance always go through order_items, "
        "never use price alone as revenue."
    ),
    "orders": (
        "Customer purchase records. Use order_date (ISO 'YYYY-MM-DD') for time filters. "
        "status is 'completed', 'pending' or 'cancelled'. Exclude status='cancelled' from "
        "revenue totals. total_amount is the order-level total in USD."
    ),
    "order_items": (
        "Line items linking orders to products. Revenue = quantity * unit_price. "
        "unit_price is the price actually charged at purchase time (may differ from "
        "products.price). Join orders for dates/status and products for names."
    ),
}

COLUMN_DESCRIPTIONS = {
    "customers.signup_date": "Date the customer registered (YYYY-MM-DD).",
    "customers.city": "Customer's city: one of 6 cities.",
    "customers.country": "Customer's country: one of 4 countries.",
    "products.price": "Current list price in USD.",
    "products.stock": "Units currently in inventory.",
    "orders.order_date": "Date the order was placed (YYYY-MM-DD). Use date('now', ...) for relative periods.",
    "orders.status": "One of 'completed', 'pending', 'cancelled'.",
    "orders.total_amount": "Order total in USD (sum of its line items).",
    "order_items.quantity": "Units of the product on this line.",
    "order_items.unit_price": "Price per unit charged on this line, in USD.",
}

BUSINESS_RULES = [
    "Revenue = SUM(order_items.quantity * order_items.unit_price), joined to orders, excluding orders.status = 'cancelled'.",
    "'Last month' means the previous calendar month: order_date >= date('now','start of month','-1 month') AND order_date < date('now','start of month').",
    "'This quarter' means the current calendar quarter: order_date >= date('now','start of month','-' || ((CAST(strftime('%m','now') AS INTEGER)-1) % 3) || ' months').",
    "'Last week' / 'last 7 days' means order_date >= date('now','-7 days').",
    "Group months with strftime('%Y-%m', order_date). Always ORDER BY the month ascending for time series.",
    "Always give computed columns readable aliases (revenue, order_count, month, ...).",
]
