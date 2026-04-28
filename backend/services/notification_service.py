import json
import os
from datetime import datetime
import threading

# Firebase check
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


class NotificationService:
    def __init__(self, db_dir):
        self.db_dir = db_dir
        self.notifications_path = os.path.join(db_dir, "notifications.txt")
        self.devices_path = os.path.join(db_dir, "device_tokens.txt")
        self.firebase_initialized = False
        self._init_firebase()

    def _init_firebase(self):
        if not FIREBASE_AVAILABLE:
            print("NotificationService: firebase-admin not installed. Remote push disabled.")
            return

        # Look for credentials in backend/ or root
        cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-adminsdk.json")
        if not os.path.exists(cred_path):
            # Try current working directory
            cred_path = "firebase-adminsdk.json"

        if os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                self.firebase_initialized = True
                print("NotificationService: Firebase initialized successfully.")
            except Exception as e:
                print(f"NotificationService: Failed to initialize Firebase: {e}")
        else:
            print("NotificationService: firebase-adminsdk.json not found. Remote push disabled.")

    def create_match_notifications(self, match_record, lost_item, found_item):
        if not match_record or not lost_item or not found_item:
            return []

        score = match_record.get("score", 0)
        match_id = match_record.get("match_id")
        chat_id = match_record.get("chat_id")
        created_at = datetime.utcnow().isoformat() + "Z"

        notifications = []
        notifications.append(self._build_notification(
            user_id=lost_item.get("user_id"),
            match_id=match_id,
            chat_id=chat_id,
            item_role="lost",
            item_name=lost_item.get("item_name", "Unknown item"),
            counterpart_name=found_item.get("item_name", "Found item"),
            counterpart_role="found",
            match_score=score,
            match_state="pending",
            created_at=created_at,
        ))
        notifications.append(self._build_notification(
            user_id=found_item.get("user_id"),
            match_id=match_id,
            chat_id=chat_id,
            item_role="found",
            item_name=found_item.get("item_name", "Unknown item"),
            counterpart_name=lost_item.get("item_name", "Lost item"),
            counterpart_role="lost",
            match_score=score,
            match_state="pending",
            created_at=created_at,
        ))

        for notification in notifications:
            self._append_record(notification)
            # Trigger background remote push if tokens exist
            threading.Thread(target=self._send_remote_push, args=(notification,)).start()

        return notifications

    def _send_remote_push(self, notification):
        if not self.firebase_initialized:
            return

        user_id = notification.get("user_id")
        devices = self._load_jsonl(self.devices_path)
        tokens = [d.get("token") for d in devices if d.get("user_id") == user_id and d.get("enabled")]

        if not tokens:
            return

        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=notification.get("title"),
                body=notification.get("message"),
            ),
            data={
                "notification_id": str(notification.get("notification_id")),
                "match_id": str(notification.get("match_id")),
                "action_primary": "check_now",
            },
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="match_alerts",
                    click_action="MATCH_ACTIONS",
                    tag=str(notification.get("notification_id")),
                )
            )
        )

        try:
            response = messaging.send_multicast(message)
            print(f"Push Sent: {response.success_count} successful, {response.failure_count} failed")
        except Exception as e:
            print(f"Failed to send push: {e}")

    def update_match_notifications(self, match_id, match_state=None, completed_at=None, verification_status=None):
        notifications = self._load_records()
        changed = False
        now = datetime.utcnow().isoformat() + "Z"

        for notification in notifications:
            if notification.get("match_id") != match_id:
                continue
            if match_state:
                notification["match_state"] = match_state
            if completed_at:
                notification["completed_at"] = completed_at
            if verification_status:
                notification["verification_status"] = verification_status
            if notification.get("match_state") in {"verified", "resolved"}:
                notification["status"] = "archived"
                notification["updated_at"] = now
            changed = True

        if changed:
            self._save_records(notifications)

        return changed

    def mark_read(self, notification_id, user_id):
        return self._set_delivery_state(notification_id, user_id, "read")

    def dismiss(self, notification_id, user_id):
        return self._set_delivery_state(notification_id, user_id, "dismissed")

    def get_user_notifications(self, user_id):
        notifications = [
            self._normalize_notification(record)
            for record in self._load_records()
            if record.get("user_id") == user_id
        ]
        notifications.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return notifications

    def get_unread_count(self, user_id):
        count = 0
        for notification in self.get_user_notifications(user_id):
            if notification.get("status") == "dismissed":
                continue
            if notification.get("match_state") in {"verified", "resolved"}:
                continue
            count += 1
        return count

    def register_device(self, user_id, token, platform="android", enabled=True):
        if not user_id or not token:
            return None

        devices = self._load_jsonl(self.devices_path)
        now = datetime.utcnow().isoformat() + "Z"
        existing = None
        for device in devices:
            if device.get("token") == token:
                existing = device
                break

        record = existing or {
            "device_id": self._next_id(devices, "D"),
            "created_at": now,
        }
        record.update({
            "user_id": user_id,
            "token": token,
            "platform": platform,
            "enabled": bool(enabled),
            "updated_at": now,
        })

        if existing:
            for idx, device in enumerate(devices):
                if device.get("token") == token:
                    devices[idx] = record
                    break
        else:
            devices.append(record)

        self._save_jsonl(self.devices_path, devices)
        return record

    def _build_notification(
        self,
        user_id,
        match_id,
        chat_id,
        item_role,
        item_name,
        counterpart_name,
        counterpart_role,
        match_score,
        match_state,
        created_at,
    ):
        score_pct = round(float(match_score or 0) * 100 if float(match_score or 0) <= 1 else float(match_score or 0), 1)
        title = "New match found"
        message = (
            f"{item_name} matched with {counterpart_name} at {score_pct:.1f}% confidence. "
            f"Open the notification to review the item details."
        )
        detail_message = (
            f"{item_role.title()} item: {item_name} | {counterpart_role.title()} item: {counterpart_name} | "
            f"Match percentage: {score_pct:.1f}%"
        )
        return {
            "notification_id": self._next_id(self._load_records(), "N"),
            "user_id": user_id,
            "match_id": match_id,
            "chat_id": chat_id,
            "title": title,
            "message": message,
            "detail_message": detail_message,
            "item_name": item_name,
            "counterpart_name": counterpart_name,
            "item_role": item_role,
            "counterpart_role": counterpart_role,
            "match_score": score_pct,
            "match_state": match_state,
            "status": "unread",
            "action_primary": "check_now",
            "action_secondary": "check_later",
            "created_at": created_at,
            "updated_at": created_at,
            "opened_at": None,
            "dismissed_at": None,
            "resolved_at": None,
            "verification_status": "pending",
        }

    def _set_delivery_state(self, notification_id, user_id, state):
        notifications = self._load_records()
        changed = False
        now = datetime.utcnow().isoformat() + "Z"
        for notification in notifications:
            if notification.get("notification_id") != notification_id:
                continue
            if user_id and notification.get("user_id") != user_id:
                continue
            notification["status"] = state
            notification["updated_at"] = now
            if state == "read":
                notification["opened_at"] = now
            elif state == "dismissed":
                notification["dismissed_at"] = now
            changed = True
            break

        if changed:
            self._save_records(notifications)
        return changed

    def _normalize_notification(self, record):
        item = dict(record)
        item["is_disabled"] = item.get("match_state") in {"verified", "resolved"}
        item["is_unread"] = item.get("status") == "unread"
        item["is_active_badge"] = item.get("status") != "dismissed" and item.get("match_state") not in {"verified", "resolved"}
        return item

    def _load_records(self):
        return self._load_jsonl(self.notifications_path)

    def _append_record(self, record):
        with open(self.notifications_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(record) + "\n")

    def _save_records(self, records):
        self._save_jsonl(self.notifications_path, records)

    def _load_jsonl(self, path):
        records = []
        if not os.path.exists(path):
            return records
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except Exception:
                    continue
        return records

    def _save_jsonl(self, path, records):
        with open(path, "w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record) + "\n")

    def _next_id(self, records, prefix):
        max_count = 0
        for record in records:
            for key in ("notification_id", "device_id"):
                item_id = str(record.get(key) or "")
                if item_id.startswith(prefix):
                    try:
                        count = int(item_id[len(prefix):])
                    except Exception:
                        continue
                    if count > max_count:
                        max_count = count
        return f"{prefix}{str(max_count + 1).zfill(4)}"
