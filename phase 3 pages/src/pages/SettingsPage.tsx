import React from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Globe, Database, CreditCard, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function SettingsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <SettingsIcon className="text-[#005f9e]" />
          Platform Settings
        </h1>
        <p className="text-slate-500">Manage your account, workspace, and security preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation */}
        <div className="lg:col-span-3 space-y-1">
          <SettingsNavLink icon={User} label="Profile" active />
          <SettingsNavLink icon={Bell} label="Notifications" />
          <SettingsNavLink icon={Shield} label="Security" />
          <SettingsNavLink icon={Globe} label="Workspace" />
          <SettingsNavLink icon={Database} label="Data & Storage" />
          <SettingsNavLink icon={CreditCard} label="Billing" />
        </div>

        {/* Content */}
        <div className="lg:col-span-9 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Profile Information</h3>
              <p className="text-xs text-slate-500 font-medium">This information will be visible to other workspace members.</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden">
                    <img src="https://picsum.photos/seed/user/200/200" alt="Avatar" referrerPolicy="no-referrer" />
                  </div>
                  <button className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold uppercase flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    Change
                  </button>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Ziad Hatem</h4>
                  <p className="text-xs text-slate-500">ziadhatemdev@gmail.com</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-slate-50 border-none ring-1 ring-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#005f9e] outline-none transition-all" 
                    defaultValue="Ziad Hatem"
                    type="text" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Title</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-slate-50 border-none ring-1 ring-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#005f9e] outline-none transition-all" 
                    defaultValue="Senior Orchestrator"
                    type="text" 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bio</label>
                  <textarea 
                    className="w-full px-4 py-2.5 bg-slate-50 border-none ring-1 ring-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#005f9e] outline-none transition-all resize-none" 
                    rows={4}
                    defaultValue="Passionate about automation and building resilient cloud architectures."
                  ></textarea>
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button className="flex items-center gap-2 px-6 py-2.5 bg-[#005f9e] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                <Save size={18} />
                Save Changes
              </button>
            </div>
          </motion.div>

          <div className="bg-red-50 rounded-2xl border border-red-100 p-8 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-red-900 mb-1">Danger Zone</h3>
              <p className="text-xs text-red-700 font-medium">Permanently delete your account and all associated workspace data.</p>
            </div>
            <button className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavLink({ icon: Icon, label, active }: any) {
  return (
    <button className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
      active ? "bg-blue-50 text-[#005f9e]" : "text-slate-500 hover:bg-slate-100"
    )}>
      <Icon size={18} />
      {label}
    </button>
  );
}
