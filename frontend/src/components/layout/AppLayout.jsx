import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Menu, 
  X, 
  Bell, 
  Settings, 
  LogOut, 
  User,
  Home,
  Video,
  BookOpen,
  BarChart3,
  Users,
  FileText,
} from 'lucide-react';
import { Button, Avatar, Dropdown } from './common/BaseComponents';

export const Navbar = ({ onSidebarToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications] = useState(3);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="glass sticky top-0 z-40 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Menu Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={onSidebarToggle}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Menu size={24} className="text-white" />
            </button>
            <div className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-secondary-400 text-transparent bg-clip-text">
              MELD
            </div>
          </div>

          {/* Center - Search (hidden on mobile) */}
          <div className="hidden md:block flex-1 max-w-md mx-8">
            <input
              type="text"
              placeholder="Search classes, lessons..."
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Right Side - Icons and Profile */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Bell size={20} className="text-white" />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>

            {/* Settings */}
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Settings size={20} className="text-white" />
            </button>

            {/* Profile Dropdown */}
            <Dropdown
              trigger={
                <button className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Avatar src={user?.profileImage} alt={user?.name} size="sm" status="online" />
                  <span className="hidden sm:inline text-sm text-white font-medium">{user?.name}</span>
                </button>
              }
            >
              <div className="py-2">
                <a href="/profile" className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 text-slate-200">
                  <User size={16} />
                  <span>Profile</span>
                </a>
                <a href="/settings" className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 text-slate-200">
                  <Settings size={16} />
                  <span>Settings</span>
                </a>
                <hr className="my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-800 text-slate-200"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </Dropdown>
          </div>
        </div>
      </div>
    </nav>
  );
};

export const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: user?.role === 'teacher' ? '/teacher' : '/student' },
    { icon: Video, label: 'Live Classes', href: user?.role === 'teacher' ? '/teacher/live' : '/student/live' },
    { icon: BookOpen, label: 'Lessons', href: user?.role === 'teacher' ? '/teacher/lessons' : '/student/lessons' },
    { icon: BarChart3, label: 'Analytics', href: user?.role === 'teacher' ? '/teacher/analytics' : '/student/analytics' },
    ...(user?.role === 'teacher'
      ? [
        { icon: Users, label: 'Students', href: '/teacher/students' },
        { icon: FileText, label: 'Reports', href: '/teacher/reports' },
      ]
      : []),
    ...(user?.role === 'admin'
      ? [
        { icon: Users, label: 'Users', href: '/admin/users' },
        { icon: Video, label: 'Classes', href: '/admin/classes' },
        { icon: FileText, label: 'Reports', href: '/admin/reports' },
      ]
      : []),
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative left-0 top-0 h-screen w-64 glass border-r border-white/10 flex flex-col transition-transform duration-300 z-40 lg:z-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Close button (mobile) */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg"
        >
          <X size={24} className="text-white" />
        </button>

        {/* Logo */}
        <div className="p-6 pt-8 lg:pt-6 border-b border-white/10">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-secondary-400 text-transparent bg-clip-text">
            MELD
          </h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <button
                  onClick={() => {
                    navigate(item.href);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    location.pathname === item.href
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <Button variant="outline" className="w-full text-white border-white/20">
            Need Help?
          </Button>
        </div>
      </aside>
    </>
  );
};

export const AppShell = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navbar onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
