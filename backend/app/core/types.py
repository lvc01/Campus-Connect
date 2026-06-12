"""
Portable SQLAlchemy column types that work across PostgreSQL and SQLite.

PostgreSQL-specific types like JSONB and ARRAY cannot be used with SQLite
(which we use for testing). This module provides type factories that
return the PG-optimised type when targeting PostgreSQL and a compatible
fallback for SQLite.
"""

from sqlalchemy import JSON, Text
from sqlalchemy.types import TypeDecorator


class PortableJSON(TypeDecorator):
    """
    A JSON column that uses JSONB on PostgreSQL and JSON elsewhere.

    This ensures the ORM models work with both PostgreSQL (production)
    and SQLite (testing) without conditional imports in every model file.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        """Use JSONB on PostgreSQL for indexing support; plain JSON otherwise."""
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


class PortableARRAY(TypeDecorator):
    """
    An array column that uses ARRAY(String) on PostgreSQL and JSON elsewhere.

    On PostgreSQL, native arrays enable efficient ``@>`` containment queries.
    On SQLite (tests), we store the list as a JSON array.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        """Use native ARRAY on PostgreSQL; JSON list on SQLite."""
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import ARRAY
            from sqlalchemy import String
            return dialect.type_descriptor(ARRAY(String))
        return dialect.type_descriptor(JSON())
