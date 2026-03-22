import * as React from 'react';
import { Search, Bell, User } from 'lucide-react';
import { currentUser } from '../constants/mockData';

export const Topbar: React.FC = () => {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input 
            type="text" 
            placeholder="Search workflows, versions, or activity..."
            className="w-full h-10 pl-10 pr-4 bg-surface-container-low rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors relative">
          <Bell size={20} className="text-on-surface-variant" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface-container-lowest" />
        </button>
        
        <div className="h-8 w-px bg-outline-variant mx-2" />
        
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-on-surface">{currentUser.name}</p>
            <p className="text-xs text-on-surface-variant capitalize">{currentUser.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container overflow-hidden border-2 border-primary/10">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              <User size={20} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
