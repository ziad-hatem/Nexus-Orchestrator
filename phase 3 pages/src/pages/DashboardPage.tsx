import React from 'react';
import { 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  Users, 
  Clock, 
  Zap,
  BarChart3
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: '00:00', events: 400 },
  { name: '04:00', events: 300 },
  { name: '08:00', events: 900 },
  { name: '12:00', events: 1400 },
  { name: '16:00', events: 1100 },
  { name: '20:00', events: 1800 },
  { name: '23:59', events: 1200 },
];

export function DashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h1>
        <p className="text-slate-500">Real-time performance metrics and automation health.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Events" 
          value="1.2M" 
          change="+12.5%" 
          isPositive={true} 
          icon={Activity} 
        />
        <StatCard 
          title="Active Workflows" 
          value="48" 
          change="+2" 
          isPositive={true} 
          icon={Zap} 
        />
        <StatCard 
          title="Avg. Latency" 
          value="124ms" 
          change="-12ms" 
          isPositive={true} 
          icon={Clock} 
        />
        <StatCard 
          title="Active Users" 
          value="1,402" 
          change="-4%" 
          isPositive={false} 
          icon={Users} 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={18} className="text-[#005f9e]" />
              Event Throughput
            </h3>
            <select className="text-xs font-bold text-slate-500 bg-slate-50 border-none rounded-lg px-3 py-1.5 outline-none ring-1 ring-slate-200">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#005f9e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#005f9e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="events" 
                  stroke="#005f9e" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorEvents)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#005f9e] text-white p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="z-10">
            <h3 className="text-xl font-bold mb-2">System Health</h3>
            <p className="text-blue-100 text-sm leading-relaxed">All systems are operational. No incidents reported in the last 72 hours.</p>
          </div>
          <div className="z-10 mt-8 space-y-4">
            <HealthItem label="API Gateway" status="Operational" />
            <HealthItem label="Worker Nodes" status="Operational" />
            <HealthItem label="Database" status="Operational" />
            <HealthItem label="Webhooks" status="Operational" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, isPositive, icon: Icon }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
          <Icon size={20} />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold",
          isPositive ? "text-emerald-600" : "text-red-600"
        )}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
        </div>
      </div>
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
      <p className="text-2xl font-black text-slate-900">{value}</p>
    </motion.div>
  );
}

function HealthItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-blue-100">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
        <span className="text-[10px] font-bold uppercase tracking-wider">{status}</span>
      </div>
    </div>
  );
}
