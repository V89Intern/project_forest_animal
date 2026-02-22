"""
db.py — PostgreSQL connection helper
"""
from __future__ import annotations

import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

_pool: ThreadedConnectionPool | None = None

def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        url = os.environ["DATABASE_URL"]
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=url)
    return _pool


def get_conn():
    """Return a pooled connection.  Caller must call pool.putconn(conn) when done."""
    return _get_pool().getconn()


def put_conn(conn) -> None:
    _get_pool().putconn(conn)


def query(sql: str, params=None, *, fetch: str = "none"):
    """
    Convenience wrapper.
    fetch: "one" | "all" | "none"
    Returns rows or lastrowid depending on fetch.
    """
    conn = get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                if fetch == "one":
                    return cur.fetchone()
                if fetch == "all":
                    return cur.fetchall()
                return None
    finally:
        put_conn(conn)


def init_db() -> None:
    """Run init.sql DDL + seeds on startup (idempotent with IF NOT EXISTS)."""
    sql_file = Path(__file__).parent / "init.sql"
    ddl = sql_file.read_text(encoding="utf-8")
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(ddl)
        print("[db] Schema initialised / verified OK.", flush=True)
    finally:
        put_conn(conn)
