import React, { useState } from 'react';
import { X, Send, Play, Code, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function ManualTriggerModal({ isOpen, onClose, triggerKey }: { isOpen: boolean; onClose: () => void; triggerKey: string }) {
  const [payload, setPayload] = useState('{\n  "user_id": "usr_9921",\n  "action": "manual_sync",\n  "timestamp": "' + new Date().toISOString() + '"\n}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-2xl shadow-2xl z-[110] overflow-hidden"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#005f9e] text-white flex items-center justify-center">
                  <Play size={20} fill="currentColor" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Manual Trigger</h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">Key: <code className="text-[#005f9e] font-bold">{triggerKey}</code></p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Code size={14} />
                    Input Payload (JSON)
                  </label>
                  <span className="text-[10px] font-bold text-blue-500 uppercase">Valid JSON</span>
                </div>
                <div className="relative group">
                  <textarea 
                    className="w-full bg-slate-900 text-blue-200 font-mono text-xs p-4 rounded-xl border-none ring-1 ring-slate-800 focus:ring-2 focus:ring-[#005f9e] transition-all resize-none leading-relaxed" 
                    rows={8}
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                  ></textarea>
                  <div className="absolute bottom-4 right-4 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                    {payload.length} chars
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Info className="text-amber-600 mt-0.5" size={18} />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Manual triggers bypass standard rate limits. Ensure the payload matches the expected schema for the downstream workflow steps.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button onClick={onClose} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleExecute}
                disabled={isExecuting || success}
                className={cn(
                  "px-8 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2",
                  success ? "bg-emerald-500 shadow-emerald-900/20" : "bg-[#005f9e] shadow-blue-900/20"
                )}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Executing...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 size={18} />
                    Success
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Execute Workflow
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
