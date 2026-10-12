import os
import re
import socket
import logging
import threading
from datetime import datetime
import sqlalchemy
from sqlalchemy import create_engine, text, event
from sqlalchemy.exc import (
    OperationalError,
    InterfaceError,
    DisconnectionError,
    TimeoutError as SATimeoutError,
    DatabaseError,
)

logger = logging.getLogger("argus.failover")

SENTINEL_FILE_NAME = ".failover_active"


def normalize_db_uri(uri: str | None) -> str | None:
    """Normalize database URI prefix for SQLAlchemy (postgres:// -> postgresql+psycopg2://)."""
    if not uri:
        return uri
    uri = uri.strip().strip('"').strip("'")
    if uri.startswith("postgres://"):
        return uri.replace("postgres://", "postgresql+psycopg2://", 1)
    elif uri.startswith("postgresql://") and not uri.startswith("postgresql+"):
        return uri.replace("postgresql://", "postgresql+psycopg2://", 1)
    return uri


def redact_uri(uri: str | None) -> str:
    """Redact password from URI for safe logging and status reporting."""
    if not uri:
        return "None"
    return re.sub(r":([^@]+)@", ":****@", uri)


def is_connection_or_operational_error(exc: Exception | None) -> bool:
    """Determine whether an exception is an operational/connection/timeout error."""
    if exc is None:
        return False

    if isinstance(exc, (OperationalError, InterfaceError, DisconnectionError, SATimeoutError, ConnectionError, socket.timeout)):
        return True

    try:
        import psycopg2
        if isinstance(exc, (psycopg2.OperationalError, psycopg2.InterfaceError)):
            return True
    except ImportError:
        pass

    msg = str(exc).lower()
    connection_indicators = [
        "could not connect",
        "connection refused",
        "connection reset",
        "server closed the connection",
        "terminating connection",
        "connection timed out",
        "timeout",
        "timed out",
        "broken pipe",
        "closed unexpectedly",
        "cannot assign requested address",
        "network is unreachable",
        "no route to host",
        "failed to connect",
        "canceling statement due to statement timeout",
        "ssl connection has been closed",
    ]
    return any(ind in msg for ind in connection_indicators)


def test_db_connection(uri: str, timeout: int = 3) -> tuple[bool, Exception | None]:
    """Perform a fast pre-flight connection test to verify reachability."""
    if not uri:
        return False, ValueError("Empty database URI")
    temp_engine = None
    try:
        connect_args = {"connect_timeout": timeout} if "postgresql" in uri else {}
        temp_engine = create_engine(
            uri,
            connect_args=connect_args,
            pool_pre_ping=False,
        )
        with temp_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as e:
        return False, e
    finally:
        if temp_engine:
            try:
                temp_engine.dispose()
            except Exception:
                pass


class DatabaseFailoverManager:
    """
    Manages automatic sticky database connection failover and write-safety enforcement.
    
    - Attempts connection to primary URI first.
    - If unreachable, times out, or throws an operational error, falls back to fallback URI.
    - Ensures failover is sticky across the application lifecycle to prevent node flapping.
    - Enforces write-safety:
        1. Immediately executes 'UPDATE _sync_meta SET last_writer = 'db2', updated_at = NOW() WHERE id = 1;'
           upon failing over.
        2. Executes the same write-safety update whenever an INSERT, UPDATE, or DELETE is run
           on the fallback database.
    - Supports explicit health recovery checks to return to primary when healthy.
    """

    def __init__(self):
        self.lock = threading.RLock()
        self.app = None
        self.db = None
        self.primary_uri: str | None = None
        self.fallback_uri: str | None = None
        self.primary_engine = None
        self.fallback_engine = None
        self.is_fallback: bool = False
        self.last_failover_reason: str | None = None
        self.last_failover_timestamp: str | None = None
        self.sentinel_path: str = os.path.abspath(SENTINEL_FILE_NAME)

    def _is_sentinel_active(self) -> bool:
        return os.path.exists(self.sentinel_path)

    def _set_sentinel(self, active: bool):
        try:
            if active:
                with open(self.sentinel_path, "w", encoding="utf-8") as f:
                    f.write(f"failed_over_at={datetime.utcnow().isoformat()}Z\nreason={self.last_failover_reason}\n")
            else:
                if os.path.exists(self.sentinel_path):
                    os.remove(self.sentinel_path)
        except Exception as e:
            logger.warning(f"Failed to update failover sentinel file ({active}): {e}")

    def init_app(self, app, db, primary_uri: str, fallback_uri: str | None = None):
        """Initialize failover manager with Flask application, SQLAlchemy extension, and URIs."""
        self.app = app
        self.db = db
        self.primary_uri = normalize_db_uri(primary_uri)
        self.fallback_uri = normalize_db_uri(fallback_uri)
        self.sentinel_path = os.path.join(app.root_path or os.getcwd(), SENTINEL_FILE_NAME)

        logger.info(f"DatabaseFailoverManager initialized. Primary: {redact_uri(self.primary_uri)} | Fallback: {redact_uri(self.fallback_uri)}")

        # Clear any stale sentinel file on process restart so primary is always attempted first on boot
        self._set_sentinel(False)
        self.is_fallback = False

        # Attempt to probe primary first
        connect_ok = False
        connect_err = None
        if self.primary_uri:
            logger.info("Attempting connection to primary database (db1)...")
            connect_ok, connect_err = test_db_connection(self.primary_uri, timeout=3)

        if not connect_ok:
            if self.fallback_uri:
                logger.warning(
                    f"Primary database connection failed at startup: {connect_err}. "
                    f"Failing over immediately to fallback database (db2)."
                )
                self.is_fallback = True
                self.last_failover_reason = f"Startup connection error: {connect_err}"
                self.last_failover_timestamp = datetime.utcnow().isoformat() + "Z"
                self._set_sentinel(True)
            else:
                logger.error(f"Primary database connection failed and no fallback URI configured: {connect_err}")

        # Determine active URI for Flask-SQLAlchemy configuration
        active_uri = self.fallback_uri if (self.is_fallback and self.fallback_uri) else self.primary_uri
        app.config["SQLALCHEMY_DATABASE_URI"] = active_uri
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "connect_args": {"connect_timeout": 5} if "postgresql" in (active_uri or "") else {},
        }

        # Initialize Flask-SQLAlchemy with the active configuration
        self.db.init_app(app)

        with app.app_context():
            # Create / capture engines
            active_engine = self.db.engine
            if self.is_fallback:
                self.fallback_engine = active_engine
                self._attach_write_safety_listener(self.fallback_engine)
                if self.primary_uri:
                    self.primary_engine = self._create_engine(self.primary_uri, is_fallback=False)
            else:
                self.primary_engine = active_engine
                self._attach_primary_error_listener(self.primary_engine)
                if self.fallback_uri:
                    self.fallback_engine = self._create_engine(self.fallback_uri, is_fallback=True)

            # If already failed over at startup, execute write-safety metadata update immediately
            if self.is_fallback:
                self._execute_sync_meta_update(trigger="Startup failover")

        # Register request hooks
        self._register_hooks(app)

    def _create_engine(self, uri: str, is_fallback: bool):
        connect_args = {"connect_timeout": 5} if "postgresql" in uri else {}
        engine = create_engine(
            uri,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args=connect_args,
        )
        if is_fallback:
            self._attach_write_safety_listener(engine)
        else:
            self._attach_primary_error_listener(engine)
        return engine

    def _attach_primary_error_listener(self, engine):
        """
        Listen for DBAPI/connection errors on primary engine.
        Automatically triggers sticky failover immediately when a connection failure occurs.
        """
        if getattr(engine, "_primary_error_attached", False):
            return

        @event.listens_for(engine, "handle_error")
        def on_primary_handle_error(exception_context):
            orig = getattr(exception_context, "original_exception", None) or getattr(exception_context, "sqlalchemy_exception", None)
            is_conn = getattr(exception_context, "is_connection_error", False) or is_connection_or_operational_error(orig)
            if is_conn:
                logger.warning(f"[FAILOVER] Connection/operational error detected on primary engine: {orig}. Triggering sticky failover.")
                self.failover_to_fallback(reason=str(orig))

        engine._primary_error_attached = True

    def _attach_write_safety_listener(self, engine):
        """
        Enforce write safety on fallback engine:
        Whenever an INSERT, UPDATE, or DELETE executes while connected to the fallback database,
        execute an update on the metadata table (_sync_meta).
        """
        if getattr(engine, "_write_safety_attached", False):
            return

        @event.listens_for(engine, "before_cursor_execute")
        def on_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            stmt_clean = statement.strip().upper()
            if stmt_clean.startswith(("INSERT", "UPDATE", "DELETE")):
                # CRITICAL: Prevent recursion when updating _sync_meta itself
                if "_SYNC_META" in stmt_clean:
                    return

                try:
                    # Execute write safety update on a separate cursor on the same connection/transaction
                    raw_conn = getattr(cursor, "connection", None)
                    if raw_conn:
                        meta_cur = raw_conn.cursor()
                        try:
                            meta_cur.execute(
                                "UPDATE _sync_meta SET last_writer = 'db2', updated_at = NOW() WHERE id = 1;"
                            )
                        finally:
                            meta_cur.close()
                    else:
                        cursor.execute(
                            "UPDATE _sync_meta SET last_writer = 'db2', updated_at = NOW() WHERE id = 1;"
                        )
                except Exception as meta_err:
                    logger.warning(f"[WRITE SAFETY] Failed updating _sync_meta on statement write: {meta_err}")

        engine._write_safety_attached = True
        logger.info("[WRITE SAFETY] Attached write safety listener to fallback database engine.")

    def _execute_sync_meta_update(self, trigger: str = "Failover"):
        """Immediately update _sync_meta on the fallback database."""
        if not self.fallback_engine:
            return
        try:
            with self.fallback_engine.begin() as conn:
                conn.execute(
                    text("UPDATE _sync_meta SET last_writer = 'db2', updated_at = NOW() WHERE id = 1;")
                )
            logger.info(f"[WRITE SAFETY] Updated _sync_meta (last_writer='db2') on fallback database. Trigger: {trigger}")
        except Exception as err:
            logger.error(f"[WRITE SAFETY] Error executing immediate _sync_meta update on fallback: {err}")

    def failover_to_fallback(self, reason: str = "Connection error"):
        """
        Trigger sticky failover to the fallback database.
        Remains bound to fallback until restart or explicit health-recovery check.
        """
        with self.lock:
            if self.is_fallback:
                return  # Sticky failover already active

            if not self.fallback_uri:
                logger.error("[FAILOVER] Cannot failover: No fallback URI configured!")
                return

            self.is_fallback = True
            self.last_failover_reason = reason
            self.last_failover_timestamp = datetime.utcnow().isoformat() + "Z"
            self._set_sentinel(True)

            logger.warning(f"[FAILOVER] Sticky failover engaged! Switching to fallback database (db2). Reason: {reason}")

            # Dispose primary engine pool to close dead connections
            if self.primary_engine:
                try:
                    self.primary_engine.dispose()
                except Exception as e:
                    logger.warning(f"[FAILOVER] Error disposing primary engine: {e}")

            # Ensure fallback engine is ready
            if not self.fallback_engine:
                self.fallback_engine = self._create_engine(self.fallback_uri, is_fallback=True)

            # Rebind default engine in Flask-SQLAlchemy state and remove active session
            if self.app:
                try:
                    with self.app.app_context():
                        if "sqlalchemy" in getattr(self.app, "extensions", {}):
                            self.app.extensions["sqlalchemy"].engines[None] = self.fallback_engine
                        if self.db:
                            self.db.session.remove()
                except Exception as ex:
                    logger.warning(f"[FAILOVER] Error rebinding engine/session to fallback: {ex}")

            # Enforce write safety immediately upon failing over
            self._execute_sync_meta_update(trigger="Immediate failover")

    def check_and_recover_primary(self) -> dict:
        """
        Explicit health-recovery check.
        Tests whether primary database is reachable again.
        If healthy, clears sticky failover and restores connection to primary.
        """
        with self.lock:
            if not self.is_fallback:
                return {
                    "success": True,
                    "status": "healthy",
                    "active_database": "db1",
                    "message": "Application is already connected to primary database (db1).",
                }

            if not self.primary_uri:
                return {
                    "success": False,
                    "status": "unhealthy",
                    "active_database": "db2",
                    "message": "Primary URI is not configured.",
                }

            logger.info("[HEALTH RECOVERY] Running explicit health-recovery probe for primary database (db1)...")
            success, err = test_db_connection(self.primary_uri, timeout=3)

            if not success:
                logger.warning(f"[HEALTH RECOVERY] Primary database (db1) is still unhealthy: {err}")
                return {
                    "success": False,
                    "status": "unhealthy",
                    "active_database": "db2",
                    "message": f"Primary database is still unreachable or timed out: {str(err)}",
                    "error": str(err),
                }

            # Primary is healthy: restore connection
            logger.info("[HEALTH RECOVERY] Primary database (db1) is healthy! Restoring primary connection.")
            self.is_fallback = False
            self.last_failover_reason = None
            self.last_failover_timestamp = None
            self._set_sentinel(False)

            # Ensure primary engine is ready
            if not self.primary_engine:
                self.primary_engine = self._create_engine(self.primary_uri, is_fallback=False)

            # Rebind Flask-SQLAlchemy default engine and clear active session
            if self.app:
                try:
                    with self.app.app_context():
                        if "sqlalchemy" in getattr(self.app, "extensions", {}):
                            self.app.extensions["sqlalchemy"].engines[None] = self.primary_engine
                        if self.db:
                            self.db.session.remove()
                except Exception as ex:
                    logger.warning(f"[HEALTH RECOVERY] Error rebinding engine/session to primary: {ex}")

            # Dispose fallback pool
            if self.fallback_engine:
                try:
                    self.fallback_engine.dispose()
                except Exception as e:
                    logger.warning(f"[HEALTH RECOVERY] Error disposing fallback engine: {e}")

            return {
                "success": True,
                "status": "recovered",
                "active_database": "db1",
                "message": "Successfully recovered and restored primary database (db1).",
            }

    def get_status(self) -> dict:
        """Return diagnostic status information for the failover system."""
        return {
            "active_database": "db2" if self.is_fallback else "db1",
            "is_fallback": self.is_fallback,
            "sticky": True,
            "primary_uri": redact_uri(self.primary_uri),
            "fallback_uri": redact_uri(self.fallback_uri),
            "last_failover_reason": self.last_failover_reason,
            "last_failover_timestamp": self.last_failover_timestamp,
        }

    def _register_hooks(self, app):
        """Register Flask request hooks to ensure sticky synchronization across worker processes."""
        @app.before_request
        def before_request_failover_sync():
            # Check if peer worker triggered failover via sentinel file
            if not self.is_fallback and self._is_sentinel_active():
                logger.warning("[FAILOVER] Peer worker activated failover sentinel. Synchronizing worker to fallback (db2).")
                self.failover_to_fallback(reason="Synchronized from peer worker failover sentinel")

        @app.teardown_request
        def teardown_request_error_check(exc):
            if exc and not self.is_fallback and is_connection_or_operational_error(exc):
                logger.error(f"[FAILOVER] Connection/operational error detected during request teardown: {exc}")
                self.failover_to_fallback(reason=f"Request teardown error: {exc}")


failover_manager = DatabaseFailoverManager()
