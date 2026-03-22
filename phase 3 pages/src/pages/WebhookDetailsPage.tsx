import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronRight, 
  Link as LinkIcon, 
  Copy, 
  Key, 
  Eye, 
  EyeOff,
  RefreshCw, 
  ShieldCheck, 
  Terminal, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { MOCK_WEBHOOK } from '../services/mockData';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { DebugPanel } from '../components/DebugPanel';

export function WebhookDetailsPage() {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(MOCK_WEBHOOK.endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
            <Link className="hover:text-[#005f9e] transition-colors" to="/">Workflows</Link>
            <ChevronRight size={14} />
            <span className="hover:text-[#005f9e] transition-colors cursor-pointer">Payment Processor</span>
            <ChevronRight size={14} />
            <span className="text-slate-900">Webhook Config</span>
          </nav>
          <h1 className="text-4xl md:text-[2.75rem] font-bold tracking-tight text-slate-900 leading-none mb-4">
            Webhook Trigger Details
          </h1>
          <p className="text-slate-500 max-w-2xl leading-relaxed">
            {MOCK_WEBHOOK.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDebugOpen(true)}
            className="bg-blue-50 text-[#005f9e] px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all"
          >
            Test Payload
          </button>
          <button className="bg-gradient-to-br from-[#005f9e] to-[#0078c7] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:opacity-95 transition-all">
            Save Changes
          </button>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Endpoint Card */}
        <section className="lg:col-span-8 bg-white rounded-xl p-8 border border-slate-200/50 flex flex-col gap-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <LinkIcon className="text-[#005f9e]" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Public Endpoint URL</h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Production Environment</p>
            </div>
          </div>
          <div className="relative group">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm text-slate-600 break-all pr-12">
              {MOCK_WEBHOOK.endpointUrl}
            </div>
            <button 
              onClick={copyToClipboard}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 rounded-lg text-[#005f9e] transition-all active:scale-90"
            >
              {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="p-4 bg-slate-50 rounded-lg border-l-4 border-[#005f9e]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Method</p>
              <p className="font-bold text-slate-900">{MOCK_WEBHOOK.method}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border-l-4 border-slate-400">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Content-Type</p>
              <p className="font-bold text-slate-900">{MOCK_WEBHOOK.contentType}</p>
            </div>
          </div>
        </section>

        {/* Secret Token Card */}
        <section className="lg:col-span-4 bg-white rounded-xl p-8 border border-slate-200/50 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Key className="text-slate-600" size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Secret Token</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Used to sign payloads for validation. Never share this secret publicly or embed it in client-side code.
            </p>
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
              <span className="font-mono text-sm text-slate-400 tracking-widest">
                {showSecret ? MOCK_WEBHOOK.secretToken : '••••••••••••••••'}
              </span>
              <button 
                onClick={() => setShowSecret(!showSecret)}
                className="text-[#005f9e] hover:bg-slate-200 p-1 rounded transition-colors"
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 text-red-600 font-semibold text-sm hover:bg-red-50 py-3 rounded-xl transition-colors mt-4">
            <RefreshCw size={16} />
            Regenerate Secret
          </button>
        </section>

        {/* Security Validation */}
        <section className="lg:col-span-5 bg-slate-50 rounded-xl p-8 border border-slate-200/50">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <ShieldCheck className="text-[#005f9e]" size={20} />
            Security Validation
          </h3>
          <div className="space-y-6">
            <ValidationStep 
              number={1} 
              title="Fetch the Signature" 
              description={<>Retrieve the <code className="bg-white px-1 py-0.5 rounded text-[#005f9e]">X-Nexus-Signature</code> header from the incoming request.</>}
            />
            <ValidationStep 
              number={2} 
              title="Hash the Body" 
              description="Compute an HMAC-SHA256 hash using your secret token and the raw request body string."
            />
            <ValidationStep 
              number={3} 
              title="Constant Time Compare" 
              description="Ensure both signatures match exactly before proceeding with automation logic."
            />
          </div>
        </section>

        {/* Code Sample */}
        <section className="lg:col-span-7 bg-[#0b1c30] rounded-xl overflow-hidden flex flex-col border border-white/5 shadow-xl">
          <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 mr-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">cURL Request Sample</span>
            </div>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Copy size={16} />
            </button>
          </div>
          <div className="p-8 font-mono text-sm overflow-x-auto text-blue-200 leading-relaxed">
            <pre><code>{`curl -X POST https://api.nexus.io/whk_09x22 \\
  -H "Content-Type: application/json" \\
  -H "X-Nexus-Signature: sha256={signature}" \\
  -d '{
    "event": "payment.succeeded",
    "data": {
      "id": "evt_99831",
      "amount": 2500,
      "currency": "usd"
    }
  }'`}</code></pre>
          </div>
          <div className="mt-auto px-8 py-4 bg-white/5 flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Status: Listening
            </span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400">Last received: 12 minutes ago</span>
          </div>
        </section>
      </div>

      {/* Footer Help */}
      <footer className="mt-12 flex items-center justify-center border-t border-slate-200 pt-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Info className="text-[#005f9e]" size={18} />
            Need more help? Read our <a className="text-[#005f9e] font-bold hover:underline" href="#">Webhook Integration Guide</a>
          </p>
          <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
          <div className="flex gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified by Nexus Shield</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TLS 1.3 Encryption</span>
          </div>
        </div>
      </footer>

      {/* Debug Panel Overlay */}
      <DebugPanel isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />
    </div>
  );
}

function ValidationStep({ number, title, description }: any) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-blue-100 text-[#005f9e] text-[10px] flex items-center justify-center font-bold">{number}</div>
      <h4 className="font-bold text-sm text-slate-900 mb-1">{title}</h4>
      <div className="text-xs text-slate-500 leading-normal">{description}</div>
    </div>
  );
}
