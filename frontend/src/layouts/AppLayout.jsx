import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function AppLayout({ user, unreadCount, onLogout, children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar user={user} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar user={user} unreadCount={unreadCount} onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
