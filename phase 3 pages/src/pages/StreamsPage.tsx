import React from 'react';
import { Radio, Search, Filter, ArrowRight, Clock, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const STREAMS = [
  { id: 's1', event: 'ticket.created', source: 'Portal', time: 'Just now', status: 'Processed', color: 'blue' },
  { id: 's2', event: 'payment.failed', source: 'Stripe', time: '2m ago', status: 'Retrying', color: 'red' },
  { id: 's3', event: 'user.onboarded', source: 'Auth0', time: '5m ago', status: 'Processed', color: 'emerald' },
  { id: 's4', event: 'server.health_low', source: 'Datadog', time: '12m ago', status: 'Alert Sent', color: 'amber' },
  { id: 's5', event: 'ticket.created', source: 'API', time: '15m ago', status: 'Processed', color: 'blue' },
  { id: 's6', event: 'billing.updated', source: 'Stripe', time: '18m ago', status: 'Processed', color: 'indigo' },
];

export function StreamsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Radio className="text-[#005f9e]" />
            Event Streams
          </h1>
          <p className="text-slate-500">Live feed of all inbound and outbound system signals.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Live Connection Active
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#005f9e] transition-all outline-none" 
            placeholder="Search streams by event name, source, or status..." 
            type="text"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          <Filter size={18} />
          Filters
        </button>
        <button className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          <Clock size={18} />
          Last 24h
        </button>
      </div>

      {/* Streams List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="col-span-4">Event Signal</div>
          <div className="col-span-3">Source Origin</div>
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1"></div>
        </div>
        <div className="divide-y divide-slate-100">
          {STREAMS.map((stream, index) => (
            <motion.div 
              key={stream.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="grid grid-cols-12 px-6 py-5 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="col-span-4 flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  `bg-${stream.color}-500`
                )}></div>
                <span className="font-bold text-slate-900">{stream.event}</span>
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded text-slate-500">
                  <Shield size={12} />
                </div>
                <span className="text-sm text-slate-600">{stream.source}</span>
              </div>
              <div className="col-span-2 text-sm text-slate-500 font-medium">
                {stream.time}
              </div>
              <div className="col-span-2">
                <span className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter",
                  stream.status === 'Processed' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                )}>
                  {stream.status}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <div className="p-2 text-slate-300 group-hover:text-[#005f9e] transition-colors">
                  <ArrowRight size={18} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pagination Placeholder */}
      <div className="flex items-center justify-between pt-4">
        <p className="text-xs text-slate-500 font-medium">Showing 6 of 1,240 events</p>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed">Previous</button>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#005f9e] hover:bg-blue-50 transition-all">Next Page</button>
        </div>
      </div>
    </div>
  );
}
