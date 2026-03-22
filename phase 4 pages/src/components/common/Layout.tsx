import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Workflow, 
  PlayCircle, 
  Settings, 
  Bell, 
  HelpCircle,
  Terminal,
  Plus,
  Monitor,
  AlertCircle,
  GitBranch,
  ShieldCheck,
  LifeBuoy,
  BookOpen,
  ChevronRight,
  Search
} from 'lucide-react';
import { cn } from './Button';

export const Navbar: React.FC = () => {
  return (
    <header className="fixed top-0 w-full z-40 bg-slate-50/80 backdrop-blur-xl shadow-sm h-16 flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold tracking-tight text-blue-900">Nexus Orchestrator</span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <NavLink to="/" className={({ isActive }) => cn("transition-colors hover:text-blue-600", isActive ? "text-blue-700 border-b-2 border-blue-700 pb-2" : "text-slate-500")}>Dashboard</NavLink>
          <NavLink to="/workflows" className={({ isActive }) => cn("transition-colors hover:text-blue-600", isActive ? "text-blue-700 border-b-2 border-blue-700 pb-2" : "text-slate-500")}>Workflows</NavLink>
          <NavLink to="/executions" className={({ isActive }) => cn("transition-colors hover:text-blue-600", isActive ? "text-blue-700 border-b-2 border-blue-700 pb-2" : "text-slate-500")}>Executions</NavLink>
          <NavLink to="/settings" className={({ isActive }) => cn("transition-colors hover:text-blue-600", isActive ? "text-blue-700 border-b-2 border-blue-700 pb-2" : "text-slate-500")}>Settings</NavLink>
        </nav>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative hidden lg:block group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-primary w-64 transition-all" 
            placeholder="Search Run ID..." 
            type="text"
          />
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors active:scale-95">
          <Bell className="w-5 h-5" />
        </button>
        <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors active:scale-95">
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs ring-2 ring-white overflow-hidden">
          <img 
            alt="User Profile" 
            className="w-full h-full object-cover" 
            src="https://picsum.photos/seed/user/100/100" 
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
};

export const Sidebar: React.FC = () => {
  const location = useLocation();
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/overview' },
    { icon: Monitor, label: 'Live Monitor', path: '/executions' },
    { icon: AlertCircle, label: 'Error Logs', path: '/errors' },
    { icon: GitBranch, label: 'Node Health', path: '/health' },
    { icon: ShieldCheck, label: 'Admin Console', path: '/admin' },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 z-30 bg-slate-100 flex flex-col p-4 gap-2">
      <div className="mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface">Execution Suite</h3>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Admin Operator</p>
          </div>
        </div>
      </div>

      <button className="mb-4 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary py-2.5 px-4 rounded-xl font-medium shadow-sm hover:opacity-90 transition-all active:scale-95">
        <Plus className="w-4 h-4" />
        New Workflow
      </button>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all",
                isActive 
                  ? "text-blue-700 bg-white font-bold shadow-sm" 
                  : "text-slate-600 hover:bg-slate-200/50 hover:translate-x-1"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive && "fill-blue-700/10")} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-outline-variant/20 space-y-1">
        <NavLink to="/support" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 transition-colors rounded-lg text-xs font-semibold uppercase tracking-wider">
          <LifeBuoy className="w-4 h-4" />
          Support
        </NavLink>
        <NavLink to="/docs" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 transition-colors rounded-lg text-xs font-semibold uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          Documentation
        </NavLink>
      </div>
    </aside>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
