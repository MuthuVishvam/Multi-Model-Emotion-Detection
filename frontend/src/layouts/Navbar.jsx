import { Search, Menu, Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function Navbar({ user, unreadCount, onLogout }) {
  if (!user) return null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-9 pr-4 py-2 w-64 text-sm bg-slate-100 border-none rounded-full focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link to="/notifications" className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </Link>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-700 leading-tight">{user.email}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold border border-blue-200">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <button 
            onClick={onLogout}
            className="ml-2 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
