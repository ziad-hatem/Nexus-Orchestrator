import React from 'react';
import { BookOpen, Search, ChevronRight, Play, Webhook, Shield, Zap, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

export function DocsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <header className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#005f9e] mx-auto">
          <BookOpen size={32} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Documentation</h1>
        <p className="text-slate-500 max-w-xl mx-auto">Everything you need to know about building, scaling, and securing your automation workflows.</p>
        
        <div className="relative max-w-2xl mx-auto pt-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm focus:ring-2 focus:ring-[#005f9e] outline-none transition-all" 
            placeholder="Search for guides, API references, or tutorials..." 
            type="text"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DocCategory 
          icon={Play}
          title="Getting Started"
          description="New to Nexus? Learn the core concepts of triggers, actions, and workflows in under 5 minutes."
          links={['Quickstart Guide', 'Core Concepts', 'Your First Workflow']}
        />
        <DocCategory 
          icon={Webhook}
          title="Webhook Integration"
          description="Connect external services like Stripe, GitHub, or custom apps using our secure webhook system."
          links={['Payload Verification', 'Retry Logic', 'IP Allowlisting']}
        />
        <DocCategory 
          icon={Terminal}
          title="API Reference"
          description="Deep dive into our REST API. Full documentation for every endpoint and data model."
          links={['Authentication', 'Rate Limits', 'Error Codes']}
        />
        <DocCategory 
          icon={Shield}
          title="Security Best Practices"
          description="Learn how to keep your automation secure using secrets, signing, and RBAC."
          links={['Secret Management', 'Audit Logs', 'Compliance']}
        />
      </div>

      <div className="bg-slate-900 rounded-3xl p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold mb-4">Need personalized help?</h2>
            <p className="text-blue-100 leading-relaxed mb-6">Our engineering team is available for architectural reviews and deep technical support.</p>
            <button className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors">
              Contact Support
            </button>
          </div>
          <div className="flex gap-4">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <Zap className="text-yellow-400 mb-4" size={24} />
              <h4 className="font-bold mb-1">Community</h4>
              <p className="text-xs text-blue-200">Join 5k+ developers on Discord.</p>
            </div>
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <Terminal className="text-blue-400 mb-4" size={24} />
              <h4 className="font-bold mb-1">Changelog</h4>
              <p className="text-xs text-blue-200">See what's new in v2.4.0.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocCategory({ icon: Icon, title, description, links }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#005f9e] mb-6">
        <Icon size={24} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">{description}</p>
      <div className="space-y-3">
        {links.map((link: string) => (
          <a key={link} href="#" className="flex items-center justify-between group text-sm font-bold text-[#005f9e]">
            {link}
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </a>
        ))}
      </div>
    </motion.div>
  );
}
