import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useNotifications } from "../components/NotificationsProvider";

function getStatusLabel(notification) {
  if (notification.match_state === "verified") return "Verified";
  if (notification.match_state === "resolved") return "Completed";
  if (notification.status === "dismissed") return "Dismissed";
  if (notification.status === "read") return "Seen";
  return "New";
}

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notifications, unreadCount, markNotificationRead, dismissNotification, refreshNotifications } = useNotifications();

  const selectedNotificationId = searchParams.get("notification_id");

  const selectedNotification = useMemo(
    () => notifications.find((item) => item.notification_id === selectedNotificationId) || null,
    [notifications, selectedNotificationId],
  );

  useEffect(() => {
    if (selectedNotificationId) {
      markNotificationRead(selectedNotificationId);
    }
  }, [markNotificationRead, selectedNotificationId]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  return (
    <main className="main-content container notifications-page">
      <div className="section-header notifications-header">
        <div>
          <h2>Notifications</h2>
          <p className="settings-desc">Match alerts, recovery updates, and case status changes.</p>
        </div>
        <Link to="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>

      <div className="notifications-summary card md-elevation-1">
        <div>
          <p className="settings-label">Active alerts</p>
          <h3>{unreadCount}</h3>
        </div>
        <div>
          <p className="settings-desc">Tap a card to review the match, or dismiss it if you want to check later.</p>
        </div>
      </div>

      {selectedNotification && (
        <section className="notification-detail card md-elevation-1">
          <p className="settings-label">Selected notification</p>
          <h3>{selectedNotification.title}</h3>
          <p>{selectedNotification.detail_message}</p>
          <div className="notification-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/match?match_id=${selectedNotification.match_id}`)}
            >
              View Match
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await dismissNotification(selectedNotification.notification_id);
              }}
            >
              Check Later
            </button>
          </div>
        </section>
      )}

      <section className="notifications-list">
        {notifications.length === 0 ? (
          <div className="card md-elevation-1 notifications-empty">
            <h3>No notifications yet</h3>
            <p>When the matcher finds a candidate pair, it will appear here and in the bell badge.</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const isDisabled = notification.match_state === "verified" || notification.match_state === "resolved" || notification.status === "dismissed";
            return (
              <article
                key={notification.notification_id}
                className={`card notification-card md-elevation-1 ${isDisabled ? "notification-card-disabled" : ""} ${selectedNotificationId === notification.notification_id ? "selected" : ""}`}
              >
                <div className="notification-card-head">
                  <div>
                    <p className="settings-label">{notification.title}</p>
                    <h3>{notification.item_name}</h3>
                  </div>
                  <span className={`badge ${isDisabled ? "pending" : "success"}`}>{getStatusLabel(notification)}</span>
                </div>

                <p className="notification-main-copy">{notification.message}</p>
                <p className="notification-detail-copy">{notification.detail_message}</p>

                <div className="notification-score-row">
                  <span className="notification-score-chip">Match {notification.match_score}%</span>
                  <span className="notification-score-chip">{notification.counterpart_name}</span>
                </div>

                <div className="notification-card-actions">
                  {!isDisabled && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        await markNotificationRead(notification.notification_id);
                        navigate(`/notifications?notification_id=${notification.notification_id}`);
                      }}
                    >
                      Check Now
                    </button>
                  )}
                  {!isDisabled && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={async () => {
                        await dismissNotification(notification.notification_id);
                      }}
                    >
                      Check Later
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/match?match_id=${notification.match_id}`)}
                  >
                    Open Match
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
