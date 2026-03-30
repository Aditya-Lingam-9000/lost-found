import json
import os
from datetime import datetime


class AuditService:
    def __init__(self, db_dir):
        self.db_dir = db_dir
        self.audit_path = os.path.join(db_dir, "audit_events.txt")

    def log_event(self, event_type, actor_id=None, entity_type=None, entity_id=None, metadata=None):
        event = {
            "event_id": self._next_event_id(),
            "event_type": event_type,
            "actor_id": actor_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat() + "Z",
        }

        with open(self.audit_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")

        return event

    def _next_event_id(self):
        if not os.path.exists(self.audit_path):
            return "E0001"

        max_id = 0
        with open(self.audit_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    event_id = event.get("event_id", "")
                    if event_id.startswith("E"):
                        num = int(event_id[1:])
                        if num > max_id:
                            max_id = num
                except Exception:
                    continue

        return f"E{str(max_id + 1).zfill(4)}"
