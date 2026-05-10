import { Menu, Bell, User, LogOut, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar({ user, unreadCount, onLogout }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <header className="h-16 glass-panel border-x-0 border-t-0 flex items-center justify-between px-4 sm:px-8 z-10 sticky top-0 backdrop-blur-xl bg-slate-900/80">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/notifications" className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                {unreadCount}
              </span>
            )}
          </Link>
          
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 pl-4 border-l border-slate-700/50 hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200 leading-tight">{user.email}</p>
                <p className="text-xs text-brand-400 capitalize font-medium tracking-wide">{user.role}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-lg ring-2 ring-slate-800">
                {user.email.charAt(0).toUpperCase()}
              </div>
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-56 glass-card border border-slate-700/50 shadow-2xl py-2 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-700/50 sm:hidden">
                    <p className="text-sm font-semibold text-white">{user.email}</p>
                    <p className="text-xs text-brand-400 capitalize">{user.role}</p>
                  </div>
                  <Link to={`/profile/${user.role}`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors">
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <Link to={`/profile/${user.role}`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors">
                    <Settings className="w-4 h-4" /> Account Settings
                  </Link>
                  <div className="h-px bg-slate-700/50 my-1"></div>
                  <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                  MELD AI
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex flex-col gap-2">
                <Link to={`/${user.role}`} className="px-4 py-3 bg-slate-800 rounded-xl text-slate-200 font-medium">Dashboard</Link>
                <Link to={`/${user.role}/classes`} className="px-4 py-3 hover:bg-slate-800 rounded-xl text-slate-400 font-medium">Classes</Link>
                <Link to={`/profile/${user.role}`} className="px-4 py-3 hover:bg-slate-800 rounded-xl text-slate-400 font-medium">Profile</Link>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
