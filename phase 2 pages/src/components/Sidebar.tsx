import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitBranch, 
  Activity, 
  Settings, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from './Button';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: 'Workflows', path: '/' },
    { icon: GitBranch, label: 'Versions', path: '/versions' },
    { icon: Activity, label: 'Monitoring', path: '/monitoring' },
    { icon: Database, label: 'Resources', path: '/resources' },
    { icon: ShieldCheck, label: 'Security', path: '/security' },
  ];

  const bottomItems = [
    { icon: HelpCircle, label: 'Support', path: '/support' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className={cn(
      'h-screen flex flex-col bg-surface-container-low border-r border-outline-variant transition-all duration-300 relative z-20',
      isCollapsed ? 'w-20' : 'w-64'
    )}>
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg primary-gradient flex items-center justify-center text-white font-bold shrink-0">
          N
        </div>
        {!isCollapsed && (
          <span className="font-bold text-lg tracking-tight text-primary">Nexus</span>
        )}
      </div>

      <div className="px-3 mb-6">
        <Button 
          className={cn("w-full justify-start gap-3 rounded-xl", isCollapsed && "px-0 justify-center")}
          size="lg"
        >
          <Plus size={20} />
          {!isCollapsed && <span>New Workflow</span>}
        </Button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
              isActive 
                ? 'bg-primary-container text-on-primary-container' 
                : 'text-on-surface-variant hover:bg-surface-container'
            )}
          >
            <item.icon size={20} />
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-6 space-y-1 border-t border-outline-variant">
        {bottomItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
              isActive 
                ? 'bg-primary-container text-on-primary-container' 
                : 'text-on-surface-variant hover:bg-surface-container'
            )}
          >
            <item.icon size={20} />
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
};
