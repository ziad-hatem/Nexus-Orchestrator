import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, ChevronDown, Trash2, Send, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_ATTEMPTS } from '../services/mockData';
import { cn } from '../lib/utils';

export function DebugPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>('a2');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
          />
          <motion.section 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-[450px] bg-white border-l border-slate-200 flex flex-col shadow-2xl z-[70]"
          >
            {/* Status Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Trigger Test</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Listening for events...</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] px-2 mb-4">Recent Attempts</div>
              
              {MOCK_ATTEMPTS.map((attempt) => (
                <div 
                  key={attempt.id}
                  className={cn(
                    "rounded-xl p-4 transition-all duration-200 border",
                    attempt.status === 'Rejected' 
                      ? "bg-white border-red-100 shadow-sm" 
                      : "bg-slate-50/50 hover:bg-slate-50 border-transparent hover:border-slate-200"
                  )}
                >
                  <div 
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === attempt.id ? null : attempt.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        attempt.status === 'Accepted' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {attempt.status === 'Accepted' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                      </div>
                      <div>
                        <div className={cn("text-sm font-bold", attempt.status === 'Rejected' && "text-red-700")}>
                          {attempt.status}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">{attempt.timestamp} • {attempt.size}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="text-[10px] font-bold text-[#005f9e] hover:underline uppercase tracking-wider">View Details</button>
                      <ChevronDown 
                        size={18} 
                        className={cn("text-slate-400 transition-transform", expandedId === attempt.id && "rotate-180")} 
                      />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedId === attempt.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                          {attempt.response && (
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">System Response</label>
                              <div className="p-3 bg-red-50/50 rounded-lg border border-red-100/50">
                                <div className="flex items-center gap-2 text-red-700 text-xs font-bold mb-1">
                                  <AlertCircle size={14} />
                                  {attempt.response.code} {attempt.response.message}
                                </div>
                                <p className="text-xs text-red-600">{attempt.response.details}</p>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Incoming Payload (Raw)</label>
                            <div className="p-3 bg-slate-900 rounded-lg font-mono text-[11px] text-blue-200 leading-relaxed overflow-x-auto">
                              <pre>{attempt.payload}</pre>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-colors">
                <Trash2 size={16} />
                Clear History
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#005f9e] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-transform">
                <Send size={16} />
                Send Test Event
              </button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
