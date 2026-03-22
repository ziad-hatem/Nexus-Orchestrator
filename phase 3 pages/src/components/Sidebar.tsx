import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitBranch, 
  Radio, 
  Settings, 
  BookOpen, 
  Plus, 
  LifeBuoy, 
  CloudCheck,
  Activity,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar() {
  return (
    <aside className="h-screen w-64 fixed left-0 top-0 hidden lg:flex flex-col bg-slate-50 border-r border-slate-200 py-6 px-4 gap-2 z-40">
      <div className="px-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#005f9e] to-[#0078c7] rounded-xl flex items-center justify-center text-white">
            <Activity size={24} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Nexus Core</h2>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">v2.4.0-stable</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <SidebarLink to="/" icon={GitBranch} label="Automation" />
        <SidebarLink to="/gemini-images" icon={Sparkles} label="AI Assets" />
        <SidebarLink to="/streams" icon={Radio} label="Event Streams" />
        <SidebarLink to="/settings" icon={Settings} label="Settings" />
        <SidebarLink to="/docs" icon={BookOpen} label="Documentation" />
      </nav>

      <div className="mt-auto px-4 space-y-4">
        <Link to="/configure" className="w-full bg-gradient-to-br from-[#005f9e] to-[#0078c7] text-white py-3 rounded-xl font-semibold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
          <Plus size={16} />
          New Trigger
        </Link>
        <div className="pt-4 border-t border-slate-200">
          <a className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-900 text-xs font-medium" href="#">
            <LifeBuoy size={16} /> Support
          </a>
          <a className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-900 text-xs font-medium" href="#">
            <CloudCheck size={16} /> API Status
          </a>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "px-4 py-3 flex items-center gap-3 rounded-xl transition-all active:translate-x-1",
        isActive 
          ? "bg-blue-50 text-blue-700" 
          : "text-slate-500 hover:bg-slate-100"
      )}
    >
      <Icon size={20} />
      <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
    </NavLink>
  );
}
