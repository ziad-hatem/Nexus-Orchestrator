import React, { useState } from 'react';
import { Search, ChevronDown, Plus, ArrowRight, Sparkles, Play, Zap } from 'lucide-react';
import * as Icons from 'lucide-react';
import { MOCK_TRIGGERS } from '../services/mockData';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ManualTriggerModal } from '../components/ManualTriggerModal';

export function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [manualTrigger, setManualTrigger] = useState<{ isOpen: boolean; key: string }>({ isOpen: false, key: '' });

  const filters = ['All Events', 'Support', 'Infrastructure', 'Billing', 'Growth'];

  const filteredTriggers = MOCK_TRIGGERS.filter(trigger => {
    const matchesSearch = trigger.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All Events' || trigger.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[#005f9e] font-bold tracking-widest text-[10px] uppercase mb-2 block">System Catalog</span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none mb-4">Event Trigger Configuration</h1>
            <p className="text-slate-500 max-w-2xl leading-relaxed">
              Configure internal orchestrator events to initiate automated workflows. Select from our curated library of system signals and data payloads.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm font-semibold text-[#005f9e] bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
              Manage Custom Events
            </button>
            <Link to="/configure" className="px-6 py-2 text-sm font-semibold text-white bg-gradient-to-br from-[#005f9e] to-[#0078c7] rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
              New Trigger
            </Link>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-slate-50 rounded-2xl p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#005f9e] focus:border-transparent transition-all outline-none" 
              placeholder="Filter by event key or category..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {filters.map(filter => (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
                  activeFilter === filter 
                    ? "bg-slate-200 text-slate-900 font-bold border border-slate-300" 
                    : "bg-white text-slate-500 hover:bg-slate-100"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <span>Sort by:</span>
          <div className="flex items-center text-[#005f9e] cursor-pointer">
            Most Recent <ChevronDown size={14} className="ml-1" />
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTriggers.map((trigger, index) => (
          <EventCard 
            key={trigger.id} 
            trigger={trigger} 
            index={index} 
            onManualTrigger={() => setManualTrigger({ isOpen: true, key: trigger.key })}
          />
        ))}

        {/* Custom Event Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="group relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all hover:bg-slate-100 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 text-slate-400 group-hover:text-[#005f9e] transition-colors">
            <Plus size={32} />
          </div>
          <h3 className="font-bold text-slate-900">Custom Event</h3>
          <p className="text-xs text-slate-500 mt-1">Define your own proprietary trigger key</p>
        </motion.div>

        {/* Promo Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-1 bg-[#005f9e] text-white rounded-2xl p-8 relative overflow-hidden flex flex-col justify-end min-h-[320px]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="z-10">
            <Sparkles className="text-white/50 mb-4" size={40} />
            <h2 className="text-2xl font-bold mb-4">Orchestrate with Precision</h2>
            <p className="text-blue-100 text-sm leading-relaxed mb-6">
              Events are the heartbeat of your automation. Connect these signals to logic gates and secondary actions to build resilient system workflows.
            </p>
            <button className="flex items-center gap-2 text-sm font-bold bg-white text-[#005f9e] px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
              Explore Catalog <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer Details */}
      <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {[1, 2, 3].map(i => (
              <img 
                key={i}
                alt="Team member" 
                className="w-8 h-8 rounded-full border-2 border-white" 
                src={`https://picsum.photos/seed/user${i}/100/100`}
                referrerPolicy="no-referrer"
              />
            ))}
            <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">+12</div>
          </div>
          <span className="text-xs text-slate-500">These events are shared across 14 team members.</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Listeners</span>
            <span className="text-sm font-bold text-slate-900">1,402 active triggers</span>
          </div>
          <div className="h-10 w-[1px] bg-slate-200"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Synced</span>
            <span className="text-sm font-bold text-slate-900">2 mins ago</span>
          </div>
        </div>
      </div>

      {/* Manual Trigger Modal */}
      <ManualTriggerModal 
        isOpen={manualTrigger.isOpen} 
        onClose={() => setManualTrigger({ ...manualTrigger, isOpen: false })} 
        triggerKey={manualTrigger.key}
      />
    </div>
  );
}

interface EventCardProps {
  trigger: any;
  index: number;
  onManualTrigger: () => void;
  key?: React.Key;
}

function EventCard({ trigger, index, onManualTrigger }: EventCardProps) {
  const Icon = (Icons as any)[trigger.icon] || Zap;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative bg-white rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/5 cursor-pointer ring-1 ring-slate-200/50"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#005f9e] group-hover:bg-[#005f9e] group-hover:text-white transition-colors duration-300">
          <Icon size={24} />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onManualTrigger();
            }}
            className="p-2 bg-slate-50 text-slate-400 hover:text-[#005f9e] hover:bg-blue-50 rounded-lg transition-all active:scale-90"
            title="Manual Trigger"
          >
            <Play size={16} fill="currentColor" />
          </button>
          <span className={cn(
            "px-2 py-1 text-[10px] font-bold rounded uppercase tracking-tighter",
            trigger.category === 'Billing' ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
          )}>
            {trigger.category}
          </span>
        </div>
      </div>
      <Link to={`/trigger/${trigger.id}`} className="block">
        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-[#005f9e] transition-colors">{trigger.key}</h3>
        <p className="text-sm text-slate-500 mb-6 line-clamp-2">{trigger.description}</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Payload Snippet</span>
            <span className="text-blue-400">JSON</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg font-mono text-xs text-slate-600 border border-slate-100">
            {trigger.payloadSnippet.split('\n').map((line: string, i: number) => (
              <code key={i} className="block">{line}</code>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
