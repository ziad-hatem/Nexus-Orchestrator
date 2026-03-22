import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  Database, 
  Webhook, 
  Cloud, 
  Sparkles, 
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Timer,
  Inbox
} from 'lucide-react';
import { MOCK_EXECUTIONS } from '../services/mockData';
import { cn } from '../components/common/Button';

const StatsCard: React.FC<{ title: string; value: string; icon: React.ReactNode; iconColor: string; bgColor: string }> = ({
  title, value, icon, iconColor, bgColor
}) => (
  <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary mb-1">{title}</p>
      <p className="text-2xl font-extrabold text-on-surface">{value}</p>
    </div>
    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", bgColor, iconColor)}>
      {icon}
    </div>
  </div>
);

export const ExecutionsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const filteredExecutions = useMemo(() => {
    return MOCK_EXECUTIONS.filter(ex => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) || ex.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All Statuses' || ex.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 text-green-700',
      running: 'bg-blue-100 text-blue-700',
      failed: 'bg-red-100 text-red-700',
      pending: 'bg-slate-100 text-slate-700',
    };
    const colors = {
      success: 'bg-green-500',
      running: 'bg-blue-500 animate-pulse',
      failed: 'bg-red-500',
      pending: 'bg-slate-400',
    };
    
    return (
      <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", styles[status as keyof typeof styles])}>
        <span className={cn("h-1.5 w-1.5 rounded-full mr-2", colors[status as keyof typeof colors])} />
        {status}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes('Finance')) return <Database className="w-4 h-4" />;
    if (category.includes('Identity')) return <Webhook className="w-4 h-4" />;
    if (category.includes('Infrastructure')) return <Cloud className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Executions</h1>
          <p className="text-secondary text-sm font-medium">Monitoring workflow performance across all organization clusters.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-surface-container-low rounded-xl p-1 shadow-sm">
            <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-surface-container-lowest text-primary rounded-lg shadow-sm">Real-time</button>
            <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors">Historical</button>
          </div>
          <div className="h-10 w-[1px] bg-outline-variant/20 hidden lg:block" />
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest text-primary border border-outline-variant/10 rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors">
            <Filter className="w-4 h-4" />
            Advanced Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest text-primary border border-outline-variant/10 rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Total Runs" value="1,284" icon={<Inbox className="w-6 h-6" />} iconColor="text-primary" bgColor="bg-blue-50" />
        <StatsCard title="Success Rate" value="98.2%" icon={<CheckCircle2 className="w-6 h-6" />} iconColor="text-green-600" bgColor="bg-green-50" />
        <StatsCard title="Active Failure" value="12" icon={<AlertCircle className="w-6 h-6" />} iconColor="text-error" bgColor="bg-red-50" />
        <StatsCard title="Avg Duration" value="42s" icon={<Clock className="w-6 h-6" />} iconColor="text-slate-600" bgColor="bg-slate-50" />
      </div>

      <div className="bg-surface-container-low rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
          <input 
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
            placeholder="Filter by Workflow Name or ID..." 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">Status:</span>
          <select 
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary transition-all cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Success</option>
            <option>Running</option>
            <option>Failed</option>
            <option>Pending</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">Range:</span>
          <select className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary transition-all cursor-pointer">
            <option>Last 24 Hours</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Custom Range</option>
          </select>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant/10">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Run ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Workflow Name</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Trigger Source</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Started At</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Duration</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredExecutions.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <Link to={`/executions/${ex.id}`} className="text-sm font-mono font-bold text-primary hover:underline">{ex.id}</Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-primary-container">
                        {getCategoryIcon(ex.category)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{ex.name}</p>
                        <p className="text-[10px] text-secondary font-medium uppercase tracking-tighter">{ex.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(ex.status)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-secondary">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {ex.triggerSource}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary font-medium">{ex.startedAt}</td>
                  <td className="px-6 py-4 text-sm text-on-surface font-bold">{ex.duration}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 opacity-0 group-hover:opacity-100 text-outline hover:text-primary transition-all">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredExecutions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-secondary">
                    No executions found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-surface-container-low/30">
          <p className="text-xs font-medium text-secondary">Showing <span className="text-on-surface font-bold">1 - {filteredExecutions.length}</span> of <span className="text-on-surface font-bold">1,284</span> executions</p>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-primary disabled:opacity-30" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              <button className="h-8 w-8 flex items-center justify-center text-xs font-bold rounded-lg bg-primary text-on-primary shadow-md">1</button>
              <button className="h-8 w-8 flex items-center justify-center text-xs font-bold rounded-lg text-secondary hover:bg-surface-container transition-colors">2</button>
              <button className="h-8 w-8 flex items-center justify-center text-xs font-bold rounded-lg text-secondary hover:bg-surface-container transition-colors">3</button>
              <span className="px-2 text-slate-400 text-xs font-bold tracking-widest">...</span>
              <button className="h-8 w-8 flex items-center justify-center text-xs font-bold rounded-lg text-secondary hover:bg-surface-container transition-colors">321</button>
            </div>
            <button className="p-2 text-slate-600 hover:text-primary">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-12 flex items-center justify-between border-t border-outline-variant/10 pt-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">System Health: All Clusters Operational</p>
        </div>
        <div className="flex items-center gap-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">© 2026 Nexus Intelligence Corp</p>
          <div className="flex gap-4">
            <a className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline" href="#">Privacy</a>
            <a className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline" href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
