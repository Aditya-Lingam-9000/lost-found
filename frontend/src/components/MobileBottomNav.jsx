import { Link, useLocation } from "react-router-dom";
import { useNotifications } from "./NotificationsProvider";

const MOBILE_NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    to: "/admin",
    label: "Admin",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />
        <path d="M9.5 12l1.8 1.8 3.2-3.2" />
      </svg>
    ),
  },
  {
    to: "/match",
    label: "Match",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.2-4.2" />
        <path d="M11 8.5v5" />
        <path d="M8.5 11h5" />
      </svg>
    ),
  },
  {
    to: "/notifications",
    label: "Alerts",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 17H5l1.2-1.2A2.2 2.2 0 0 0 7 14.3V11a5 5 0 1 1 10 0v3.3a2.2 2.2 0 0 0 .8 1.7L19 17h-4" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.8-3.2 4.5-5 8-5s6.2 1.8 8 5" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  if (location.pathname === "/login") {
    return null;
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile app navigation">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive =
          item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`bottom-nav-item ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {item.icon}
              {item.to === "/notifications" && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
