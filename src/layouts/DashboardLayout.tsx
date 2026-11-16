import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Video,
  ClipboardCheck,
  BarChart3,
  FileText,
  Settings,
  Menu,
  X,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/classrooms', label: 'Classrooms', icon: BookOpen },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/monitoring', label: 'Live Monitoring', icon: Video },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/classrooms/', title: 'Classrooms / Classroom Details' },
  { prefix: '/classrooms', title: 'Classrooms' },
  { prefix: '/students/', title: 'Students / Student Profile' },
  { prefix: '/students', title: 'Students' },
  { prefix: '/monitoring', title: 'Live Monitoring' },
  { prefix: '/attendance', title: 'Attendance' },
  { prefix: '/analytics', title: 'Analytics' },
  { prefix: '/reports', title: 'Reports' },
  { prefix: '/settings', title: 'Settings' },
];

export function DashboardLayout() {
  const { teacher } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle =
    ROUTE_TITLES.find((r) => location.pathname.startsWith(r.prefix))?.title || 'Workspace';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-6 py-5 border-b border-slate-200">
        <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
          AI Classroom Analytics
        </span>
        <span className="text-xs text-slate-500 block mt-0.5 truncate">
          Engagement & Attention Insights
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-slate-900 truncate">{teacher?.name || 'Teacher Workspace'}</div>
          <div className="text-xs text-slate-500 truncate">{teacher?.email || ''}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:z-30 no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-semibold text-slate-900 truncate">{pageTitle}</div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/api/project/download-zip"
              download="AI-Classroom-Engagement-Analytics.zip"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Spring Boot + React ZIP</span>
            </a>
            <button
              type="button"
              onClick={() => navigate('/monitoring')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Start Monitoring</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
