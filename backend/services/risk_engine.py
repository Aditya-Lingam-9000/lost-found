import json
import os
from datetime import datetime, timedelta


class RiskEngine:
    def __init__(self, db_dir):
        self.db_dir = db_dir
        self.claims_path = os.path.join(db_dir, "claims.txt")
        self.attempts_path = os.path.join(db_dir, "verification_attempts.txt")

    def score_claim(self, claimant_id, match_record, item_priority="normal"):
        now = datetime.utcnow()
        recent_claims = self._count_recent_claims(claimant_id, now - timedelta(days=7))
        failed_attempts = self._count_recent_failed_attempts(claimant_id, now - timedelta(days=7))

        score = 10
        score += min(recent_claims * 10, 35)
        score += min(failed_attempts * 12, 36)

        if item_priority == "high_value":
            score += 14
        elif item_priority == "critical_id":
            score += 20

        if claimant_id in {match_record.get("finder_user_id"), None, "UNKNOWN_USER"}:
            score += 30

        score = min(score, 100)
        level = self._risk_level(score)
        return {
            "score": score,
            "level": level,
            "recent_claims_7d": recent_claims,
            "failed_attempts_7d": failed_attempts,
        }

    def _count_recent_claims(self, claimant_id, since_dt):
        if not os.path.exists(self.claims_path):
            return 0
        count = 0
        with open(self.claims_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    if record.get("claimant_id") != claimant_id:
                        continue
                    created_at = record.get("created_at")
                    if self._is_after(created_at, since_dt):
                        count += 1
                except Exception:
                    continue
        return count

    def _count_recent_failed_attempts(self, claimant_id, since_dt):
        if not os.path.exists(self.attempts_path):
            return 0
        count = 0
        with open(self.attempts_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    if record.get("claimant_id") != claimant_id:
                        continue
                    if record.get("result") != "failed":
                        continue
                    created_at = record.get("created_at")
                    if self._is_after(created_at, since_dt):
                        count += 1
                except Exception:
                    continue
        return count

    def _is_after(self, iso_ts, since_dt):
        if not iso_ts:
            return False
        try:
            dt = datetime.fromisoformat(iso_ts.replace("Z", ""))
            return dt >= since_dt
        except Exception:
            return False

    def _risk_level(self, score):
        if score >= 70:
            return "high"
        if score >= 40:
            return "medium"
        return "low"
