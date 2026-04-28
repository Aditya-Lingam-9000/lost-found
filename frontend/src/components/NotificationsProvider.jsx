import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../utils/config/firebaseConfig";
import { apiUrl } from "../utils/config/apiConfig";
import { useSettings } from "./SettingsProvider";

const NotificationsContext = createContext(null);

async function registerPushToken(userId) {
  if (!Capacitor.isNativePlatform() || !userId) {
    return;
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    return;
  }

  await PushNotifications.register();

  const tokenListener = await PushNotifications.addListener("registration", async (token) => {
    try {
      await fetch(apiUrl("/notifications/register_device"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          token: token.value,
          platform: Capacitor.getPlatform(),
        }),
      });
    } catch (error) {
      console.error("Failed to register push token:", error);
    }
  });

  return () => {
    tokenListener.remove();
  };
}

export function NotificationsProvider({ children }) {
  const { preferences } = useSettings();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const knownNotificationIds = useRef(new Set());
  const pushCleanupRef = useRef(null);

  const syncNotifications = useCallback(async (currentUserId, scheduleDesktopAlerts = false) => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsReady(true);
      return;
    }

    try {
      const response = await fetch(apiUrl(`/notifications?user_id=${currentUserId}`));
      const data = await response.json();
      if (!data.success) {
        return;
      }

      const nextNotifications = data.notifications || [];
      const nextIds = new Set(nextNotifications.map((item) => item.notification_id));

      if (scheduleDesktopAlerts && Capacitor.isNativePlatform() && document.visibilityState === "visible") {
        const newNotifications = nextNotifications.filter((item) => !knownNotificationIds.current.has(item.notification_id));
        if (newNotifications.length > 0) {
          try {
            await LocalNotifications.schedule({
              notifications: newNotifications.slice(0, 3).map((item) => ({
                id: Number(String(item.notification_id).replace(/\D/g, "")) || Date.now(),
                title: item.title,
                body: item.message,
                schedule: { at: new Date(Date.now() + 1000) },
                actionTypeId: "MATCH_ACTIONS",
                extra: {
                  notification_id: item.notification_id,
                  match_id: item.match_id
                },
              })),
            });
          } catch(e) {}
        }
      }

      knownNotificationIds.current = nextIds;
      setNotifications(nextNotifications);
      setUnreadCount(data.unread_count ?? nextNotifications.filter((item) => item.status !== "dismissed" && item.match_state !== "verified" && item.match_state !== "resolved").length);
      setIsReady(true);
    } catch (error) {
      console.error("Failed to sync notifications:", error);
    }
  }, []);

  const markNotificationRead = useCallback(async (notificationId) => {
    if (!user?.uid || !notificationId) {
      return false;
    }

    const response = await fetch(apiUrl("/notifications/mark_read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: notificationId, user_id: user.uid }),
    });
    const data = await response.json();
    if (data.success) {
      await syncNotifications(user.uid, false);
      return true;
    }
    return false;
  }, [syncNotifications, user?.uid]);

  const dismissNotification = useCallback(async (notificationId) => {
    if (!user?.uid || !notificationId) {
      return false;
    }

    const response = await fetch(apiUrl("/notifications/dismiss"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: notificationId, user_id: user.uid }),
    });
    const data = await response.json();
    if (data.success) {
      await syncNotifications(user.uid, false);
      return true;
    }
    return false;
  }, [syncNotifications, user?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      if (currentUser) {
        syncNotifications(currentUser.uid, true);
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setIsReady(true);
      }
    });

    return () => unsubscribe();
  }, [syncNotifications]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    let isActive = true;
    const runSync = async () => {
      if (!isActive) return;
      await syncNotifications(user.uid, true);
    };

    runSync();
    const interval = window.setInterval(runSync, 12000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runSync();
      }
    };

    window.addEventListener("focus", runSync);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", runSync);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncNotifications, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !preferences.pushNotifications) {
      return undefined;
    }

    let cleanup;

    const register = async () => {
      cleanup = await registerPushToken(user.uid);
      pushCleanupRef.current = cleanup;

      if (Capacitor.isNativePlatform()) {
        try {
          await LocalNotifications.registerActionTypes({
            types: [
              {
                id: "MATCH_ACTIONS",
                actions: [
                  { id: "check_now", title: "Check Now" },
                  { id: "check_later", title: "Check Later", destructive: true }
                ]
              }
            ]
          });
        } catch (e) {}
      }
    };

    register();

    const pushListener = PushNotifications.addListener("pushNotificationActionPerformed", async (action) => {
      const notificationId = action.notification?.data?.notification_id;
      const actionId = action.actionId || action.notification?.data?.action_primary;

      if (actionId === "check_now" || action.actionId === "tap") {
        navigate("/notifications");
        if (notificationId) {
          await markNotificationRead(notificationId);
        }
      } else if (actionId === "check_later") {
        if (notificationId) {
          await dismissNotification(notificationId);
        }
      }
    });

    const localListener = LocalNotifications.addListener("localNotificationActionPerformed", async (action) => {
      const notificationId = action.notification?.extra?.notification_id;
      const actionId = action.actionId;

      if (actionId === "check_now" || actionId === "tap") {
        navigate(`/notifications?notification_id=${notificationId || ""}`);
      } else if (actionId === "check_later") {
        if (notificationId) {
          await dismissNotification(notificationId);
        }
      }
    });

    return () => {
      pushListener.then((listener) => listener.remove()).catch(() => {});
      localListener.then((listener) => listener.remove()).catch(() => {});
      if (typeof pushCleanupRef.current === "function") {
        pushCleanupRef.current();
      }
    };
  }, [markNotificationRead, dismissNotification, navigate, preferences.pushNotifications, user?.uid]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    isReady,
    refreshNotifications: () => syncNotifications(user?.uid, true),
    markNotificationRead,
    dismissNotification,
  }), [dismissNotification, isReady, markNotificationRead, notifications, syncNotifications, unreadCount, user?.uid]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}