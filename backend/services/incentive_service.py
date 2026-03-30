import json
import os
from datetime import datetime


class IncentiveService:
    def __init__(self, db_dir):
        self.db_dir = db_dir
        self.users_path = os.path.join(db_dir, "users.txt")

    def award_points(self, user_id, points, reason, extra=None):
        if not user_id:
            return None

        users = self._load_users()
        user = users.get(user_id, self._new_user(user_id))

        user["finder_points"] += points
        user["returns_count"] += 1 if reason in ("handover_confirmed", "match_resolved") else 0
        user["last_reward_reason"] = reason
        user["last_reward_points"] = points
        user["updated_at"] = datetime.utcnow().isoformat() + "Z"

        if extra:
            user.setdefault("reward_meta", {})
            user["reward_meta"].update(extra)

        user["badge_level"] = self._badge_level(user["returns_count"])
        user["trust_tier"] = self._trust_tier(user["finder_points"])

        users[user_id] = user
        self._save_users(users)
        return user

    def get_user_profile(self, user_id):
        users = self._load_users()
        return users.get(user_id, self._new_user(user_id))

    def _load_users(self):
        users = {}
        if not os.path.exists(self.users_path):
            return users

        with open(self.users_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    user = json.loads(line)
                    uid = user.get("user_id")
                    if uid:
                        users[uid] = user
                except Exception:
                    continue

        return users

    def _save_users(self, users):
        with open(self.users_path, "w", encoding="utf-8") as f:
            for user in users.values():
                f.write(json.dumps(user) + "\n")

    def _new_user(self, user_id):
        now = datetime.utcnow().isoformat() + "Z"
        return {
            "user_id": user_id,
            "finder_points": 0,
            "returns_count": 0,
            "badge_level": "starter",
            "trust_tier": "bronze",
            "created_at": now,
            "updated_at": now,
        }

    def _badge_level(self, returns_count):
        if returns_count >= 25:
            return "campus_guardian"
        if returns_count >= 10:
            return "community_hero"
        if returns_count >= 5:
            return "trusted_finder"
        if returns_count >= 1:
            return "good_samaritan"
        return "starter"

    def _trust_tier(self, points):
        if points >= 1200:
            return "platinum"
        if points >= 600:
            return "gold"
        if points >= 250:
            return "silver"
        return "bronze"
