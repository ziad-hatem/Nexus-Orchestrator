import React, { useState } from 'react';
import { ArrowLeft, Pointer, Webhook, Activity, Edit, Shield, ChevronDown, Check, ArrowRight, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function ConfigureTriggerPage() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('webhook');
  const [triggerName, setTriggerName] = useState('Stripe Payment Success');
  const [isSigningEnabled, setIsSigningEnabled] = useState(true);

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <Link to="/" className="flex items-center gap-2 text-[#005f9e] font-semibold mb-2 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] uppercase tracking-widest">Back to Catalog</span>
        </Link>
        <h1 className="text-[2.75rem] font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
          Configure Trigger
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">
          Define how this workflow should be initiated. Triggers can be reactive events or intentional manual executions.
        </p>
      </div>

      {/* Trigger Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <TriggerOption 
          id="manual"
          icon={Pointer}
          title="Manual Execution"
          description="Run the workflow on demand via UI or CLI tool. Ideal for maintenance or one-off tasks."
          selected={selectedType === 'manual'}
          onClick={() => setSelectedType('manual')}
        />
        <TriggerOption 
          id="webhook"
          icon={Webhook}
          title="Webhook Listener"
          description="Trigger via HTTP POST request from external apps (GitHub, Stripe, custom apps)."
          selected={selectedType === 'webhook'}
          onClick={() => setSelectedType('webhook')}
        />
        <TriggerOption 
          id="internal"
          icon={Activity}
          title="Internal System Event"
          description="React to changes within Nexus Core like database updates or health check alerts."
          selected={selectedType === 'internal'}
          onClick={() => setSelectedType('internal')}
        />
      </div>

      {/* Configuration Form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200"
      >
        <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Webhook Details</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">Configure parameters for the incoming payload listener.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Ready to connect</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Trigger Name */}
          <div className="max-w-xl">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Trigger Name</label>
            <div className="relative group">
              <input 
                className="w-full bg-white border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#005f9e] rounded-xl px-4 py-3 text-sm text-slate-900 transition-all placeholder-slate-300" 
                type="text" 
                value={triggerName}
                onChange={(e) => setTriggerName(e.target.value)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#005f9e] transition-colors">
                <Edit size={18} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 italic">A friendly name to identify this trigger in your logs.</p>
          </div>

          {/* Description */}
          <div className="max-w-xl">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Optional Description</label>
            <textarea 
              className="w-full bg-white border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#005f9e] rounded-xl px-4 py-3 text-sm text-slate-900 transition-all resize-none" 
              placeholder="Explain the purpose of this webhook..." 
              rows={3}
            ></textarea>
          </div>

          {/* Security Section */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  <Shield size={20} className="text-[#005f9e]" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Security & Verification</h4>
              </div>
              <ChevronDown size={20} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900">Endpoint Signing</span>
                <span className="text-[10px] text-slate-500">Verify payload integrity with secret headers</span>
              </div>
              <button 
                onClick={() => setIsSigningEnabled(!isSigningEnabled)}
                className={cn(
                  "w-10 h-5 rounded-full relative transition-colors duration-200",
                  isSigningEnabled ? "bg-[#005f9e]" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200",
                  isSigningEnabled ? "right-1" : "left-1"
                )}></div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-slate-50 flex items-center justify-between">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all">
            Discard Changes
          </button>
          <div className="flex items-center gap-4">
            <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-[#005f9e] bg-white border border-slate-200 hover:bg-slate-50 transition-all active:scale-95">
              Save as Draft
            </button>
            <button 
              onClick={() => navigate('/trigger/wh1')}
              className="bg-gradient-to-br from-[#005f9e] to-[#0078c7] px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 transition-all active:scale-95 flex items-center gap-2"
            >
              Save & Continue
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Help Card */}
      <div className="mt-8 flex items-start gap-4 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
        <Info className="text-blue-600 mt-1" size={20} />
        <div>
          <h5 className="text-sm font-bold text-blue-900 mb-1">Need help with Webhooks?</h5>
          <p className="text-xs text-blue-800 leading-relaxed max-w-2xl">
            Our Webhook system supports HMAC verification and automatic retries. You will receive a unique endpoint URL after saving this configuration. Check the <a className="underline font-bold" href="#">API Documentation</a> for payload schema requirements.
          </p>
        </div>
      </div>
    </div>
  );
}

function TriggerOption({ id, icon: Icon, title, description, selected, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-xl p-6 transition-all duration-300 cursor-pointer border-2",
        selected 
          ? "shadow-lg shadow-blue-900/5 border-[#005f9e]" 
          : "border-transparent hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
      )}
    >
      {selected && (
        <div className="absolute -top-3 right-6 bg-[#005f9e] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
          <Check size={10} strokeWidth={4} /> Selected
        </div>
      )}
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center mb-6 transition-colors",
        selected ? "bg-[#005f9e] text-white" : "bg-slate-50 text-[#005f9e] group-hover:bg-blue-100"
      )}>
        <Icon size={24} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-4">{description}</p>
      <div className={cn(
        "flex items-center gap-1.5 text-[#005f9e] text-xs font-bold uppercase tracking-wider transition-opacity",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        {selected ? "Configuring" : "Select"} <ArrowRight size={14} />
      </div>
      {selected && (
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mt-4">
          <div className="h-full bg-[#005f9e] w-full"></div>
        </div>
      )}
    </div>
  );
}
