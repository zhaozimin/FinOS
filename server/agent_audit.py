"""
[INPUT]: 接收 SQLite 数据库路径、已提交的审计事件与可选的本地 Git 可执行文件。
[OUTPUT]: 对外提供 ensure_audit_schema、append_audit_event 与 checkpoint_database。
[POS]: service 的 Agent 变更审计器；被 finance_node_server 的写路径调用，不参与 HTTP 路由解析。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""

from __future__ import annotations

import json
import sqlite3
import subprocess
from pathlib import Path
from typing import Any


def ensure_audit_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY,
            occurred_at TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            impact_json TEXT NOT NULL,
            payload_json TEXT NOT NULL
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(occurred_at DESC)"
    )


def append_audit_event(connection: sqlite3.Connection, event: dict[str, Any]) -> None:
    connection.execute(
        """
        INSERT INTO audit_events (
            id, occurred_at, actor, action, entity_type, entity_id,
            entity_name, impact_json, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event["id"],
            event["occurredAt"],
            event["actor"],
            event["action"],
            event["entityType"],
            event["entityId"],
            event["entityName"],
            json.dumps(event.get("impact", {}), ensure_ascii=False, sort_keys=True),
            json.dumps(event.get("payload", {}), ensure_ascii=False, sort_keys=True),
        ),
    )


def checkpoint_database(db_path: Path, runtime_dir: Path, event: dict[str, Any]) -> str:
    """Create an SQLite-consistent snapshot and commit only data/audit metadata locally."""
    backup_root = runtime_dir / "git-backups"
    backup_root.mkdir(parents=True, exist_ok=True)
    snapshot_path = backup_root / "finance.sqlite3"
    source = sqlite3.connect(db_path)
    destination = sqlite3.connect(snapshot_path)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()

    audit_path = backup_root / "audit-events.jsonl"
    with audit_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")

    def run_git(*args: str) -> str:
        result = subprocess.run(
            ["git", *args], cwd=backup_root, text=True, capture_output=True, check=False
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Git checkpoint failed")
        return result.stdout.strip()

    if not (backup_root / ".git").exists():
        run_git("init")
        run_git("config", "user.name", "FinOS Local Backup")
        run_git("config", "user.email", "backup@finos.local")
    run_git("add", "finance.sqlite3", "audit-events.jsonl")
    status = run_git("status", "--porcelain")
    if status:
        run_git("commit", "-m", f"audit: {event['action']} {event['entityType']} {event['entityName']}")
    return run_git("rev-parse", "--short", "HEAD")
