import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  Info, 
  Calendar, 
  CheckCircle2, 
  Loader2, 
  Hourglass,
  AlertTriangle,
  RotateCw,
  XCircle
} from 'lucide-react';
import { MOCK_EXECUTIONS, MOCK_STEPS } from '../services/mockData';
import { cn, Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

export const RunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  const execution = MOCK_EXECUTIONS.find(ex => ex.id === id);
  const steps = MOCK_STEPS[id || ''] || [];

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-bold text-on-surface">Execution Not Found</h2>
        <p className="text-secondary mb-6">The execution ID you are looking for does not exist.</p>
        <Button onClick={() => navigate('/executions')}>Back to Executions</Button>
      </div>
    );
  }

  const handleAbort = () => {
    setIsAborting(true);
    setTimeout(() => {
      setIsAborting(false);
      setIsCancelModalOpen(false);
      // In a real app, we'd update the status via API
      navigate('/executions');
    }, 1500);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            <Link to="/executions" className="hover:text-primary transition-colors">Executions</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-on-surface">{execution.id}</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">{execution.id}</h1>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1",
              execution.status === 'running' ? "bg-blue-100 text-blue-700 ring-blue-200" : "bg-green-100 text-green-700 ring-green-200"
            )}>
              {execution.status === 'running' && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
              {execution.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<RotateCw className="w-4 h-4" />}>Refresh Logs</Button>
          <Button 
            variant="error" 
            icon={<XCircle className="w-4 h-4" />}
            onClick={() => setIsCancelModalOpen(true)}
          >
            Cancel Run
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Execution Metadata
            </h2>
            <div className="space-y-5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tighter">Correlation ID</span>
                <code className="text-sm font-mono text-primary bg-surface-container-low px-2 py-1 rounded select-all">{execution.correlationId}</code>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tighter">Started At</span>
                <span className="text-sm font-medium">{execution.startedAt}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tighter">Trigger Source</span>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{execution.triggerSource}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tighter">Retry Count</span>
                  <span className="text-sm font-medium">0 of 3</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tighter">WF Version</span>
                  <span className="text-sm font-medium">{execution.version}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="bg-surface-container-low rounded-xl p-5 border-l-4 border-primary">
            <p className="text-[11px] font-bold text-primary uppercase mb-1">Production Environment</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">This workflow is running on the <strong>{execution.cluster}</strong>. Changes to configuration require Editor privileges.</p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/30 flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Execution Lifecycle</h3>
              <div className="flex gap-4 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                <span>Total Duration: {execution.duration}</span>
                <span>Memory: 128MB</span>
              </div>
            </div>
            
            <div className="p-6 relative">
              <div className="absolute left-[33px] top-10 bottom-10 w-[2px] bg-slate-100" />
              <div className="space-y-8">
                {steps.map((step) => (
                  <div key={step.id} className={cn("relative pl-12 group", step.status === 'pending' && "opacity-50")}>
                    <div className={cn(
                      "absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white z-10",
                      step.status === 'success' ? "bg-green-50 text-green-600" : 
                      step.status === 'running' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {step.status === 'success' && <CheckCircle2 className="w-4 h-4 fill-current" />}
                      {step.status === 'running' && <RotateCw className="w-4 h-4 animate-spin" />}
                      {step.status === 'pending' && <Hourglass className="w-4 h-4" />}
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">{step.name}</h4>
                        <p className="text-[11px] text-on-surface-variant/60">Module: {step.module}</p>
                      </div>
                      {step.duration && (
                        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{step.duration}</span>
                      )}
                      {step.status === 'running' && (
                        <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse">Running...</span>
                      )}
                    </div>

                    {step.logs.length > 0 && (
                      <div className="bg-surface-container-low rounded-lg p-3 font-mono text-[11px] text-slate-600 border border-outline-variant/10">
                        {step.logs.map((log, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                            <span className={cn("w-1.5 h-1.5 rounded-full", log.type === 'success' ? "bg-green-400" : "bg-slate-300")} />
                            <span className={cn(log.type === 'success' && "text-green-700")}>
                              [{log.timestamp}] {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.codeSnippet && (
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-blue-300 border border-blue-900/20">
                        {step.codeSnippet.split('\n').map((line, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                            <span className="text-blue-500/50">{line.substring(0, 3)}</span>
                            <span>{line.substring(4)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Active Run?"
        icon={<AlertTriangle className="w-8 h-8 text-error" />}
        footer={
          <>
            <Button 
              variant="error" 
              className="w-full" 
              isLoading={isAborting}
              onClick={handleAbort}
            >
              Abort Execution
            </Button>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Keep Running
            </Button>
          </>
        }
      >
        <div className="bg-surface-container-low p-4 rounded-xl mb-6">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Are you sure you want to cancel run <span className="font-mono font-bold text-primary">{execution.id}</span>? 
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant mt-3">
            This will immediately terminate all active nodes in this execution. This action is logged in the audit trail.
          </p>
        </div>
        <div className="flex items-center justify-center gap-4 mb-2">
          {['Org Admin', 'Editor', 'Operator'].map(role => (
            <div key={role} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-outline" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{role}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
