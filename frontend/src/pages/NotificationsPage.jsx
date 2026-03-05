import { useEffect, useState } from "react";

import { fetchNotifications, markNotificationRead } from "../services/api";

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

export default function NotificationsPage({ onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");

  async function loadNotifications() {
    try {
      const result = await fetchNotifications(100);
      setNotifications(result.notifications || []);
      onUnreadCountChange?.(result.unread_count || 0);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      setNotifications([]);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(notificationId) {
    try {
      await markNotificationRead(notificationId);
      await loadNotifications();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="card">
      <div className="section-header-row">
        <h2>Notifications</h2>
        <button className="secondary" onClick={loadNotifications}>Refresh</button>
      </div>

      {message && <div className="inline-message inline-message-soft">{message}</div>}

      <table className="student-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Message</th>
            <th>Time</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.message}</td>
              <td>{formatDate(item.created_at)}</td>
              <td>{item.read ? "Read" : "Unread"}</td>
              <td>
                <button
                  className="secondary"
                  onClick={() => handleMarkRead(item.id)}
                  disabled={item.read}
                >
                  Mark Read
                </button>
              </td>
            </tr>
          ))}
          {notifications.length === 0 && (
            <tr>
              <td colSpan={5}>No notifications.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

