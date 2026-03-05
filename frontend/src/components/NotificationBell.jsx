import { Link } from "react-router-dom";

export default function NotificationBell({ unreadCount = 0 }) {
  return (
    <Link to="/notifications" className="notification-bell" aria-label="Notifications">
      <span className="notification-bell__icon" aria-hidden="true">{"\u{1F514}"}</span>
      {unreadCount > 0 && <span className="notification-bell__badge">{unreadCount}</span>}
    </Link>
  );
}
