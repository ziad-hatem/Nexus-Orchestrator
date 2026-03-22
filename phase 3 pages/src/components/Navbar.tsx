import React from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';

export function Navbar() {
  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 z-50 bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center justify-between px-8 h-16 w-full mx-auto">
        <div className="flex items-center gap-8">
          <span className="text-xl font-black tracking-tight text-slate-900 lg:hidden">Nexus</span>
          <nav className="hidden xl:flex items-center gap-6 font-sans antialiased text-xs font-bold uppercase tracking-widest">
            <a className="text-slate-400 hover:text-slate-900 transition-colors" href="#">Workflows</a>
            <a className="text-[#005f9e] border-b-2 border-[#005f9e] pb-1" href="#">Triggers</a>
            <a className="text-slate-400 hover:text-slate-900 transition-colors" href="#">Logs</a>
            <a className="text-slate-400 hover:text-slate-900 transition-colors" href="#">Secrets</a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              className="pl-10 pr-4 py-1.5 bg-white border-none ring-1 ring-slate-200 rounded-full text-sm w-64 focus:ring-[#005f9e] focus:ring-2 transition-all" 
              placeholder="Search events..." 
              type="text"
            />
          </div>
          <button className="p-2 text-slate-500 hover:bg-slate-100/50 rounded-lg transition-all active:scale-95">
            <Bell size={20} />
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-100/50 rounded-lg transition-all active:scale-95">
            <HelpCircle size={20} />
          </button>
          <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
            <img 
              alt="User profile" 
              src="https://picsum.photos/seed/user/100/100"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
