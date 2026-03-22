import * as React from 'react';
import { 
  ArrowLeft, 
  Settings, 
  Play, 
  History, 
  Edit3, 
  Activity, 
  Clock, 
  Database, 
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workflowService } from '../services/api';
import { Workflow, Execution } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { format } from 'date-fns';

export const WorkflowDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = React.useState<Workflow | null>(null);
  const [executions, setExecutions] = React.useState<Execution[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (id) {
      Promise.all([
        workflowService.getWorkflowById(id),
        workflowService.getExecutions(id)
      ]).then(([w, e]) => {
        if (w) setWorkflow(w);
        setExecutions(e);
        setIsLoading(false);
      });
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Workflow not found</h2>
        <Button className="mt-4" onClick={() => navigate('/')}>Back to Directory</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-on-surface">{workflow.name}</h1>
            <Badge variant={workflow.status as any}>{workflow.status}</Badge>
          </div>
          <p className="text-on-surface-variant">{workflow.id} • {workflow.category}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/workflows/${id}/history`)}>
            <History size={18} />
            History
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/workflows/${id}/edit`)}>
            <Edit3 size={18} />
            Edit Draft
          </Button>
          <Button className="gap-2">
            <Play size={18} />
            Run Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Activity size={20} className="text-primary" />
              Pipeline Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Trigger</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  {workflow.trigger}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Resources</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Database size={14} className="text-primary" />
                  {workflow.resources}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Success Rate</p>
                <p className="text-sm font-medium text-[#2e7d32]">98.2%</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Avg. Duration</p>
                <p className="text-sm font-medium">12.4s</p>
              </div>
            </div>
            
            <div className="mt-10 h-48 w-full bg-surface-container-low rounded-2xl flex items-center justify-center border border-dashed border-outline-variant">
              <p className="text-on-surface-variant text-sm italic">Execution throughput visualization would render here.</p>
            </div>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Recent Executions</h3>
              <Button variant="ghost" size="sm" className="gap-2">
                View All
                <ExternalLink size={14} />
              </Button>
            </div>
            <div className="space-y-3">
              {executions.map((execution) => (
                <Card key={execution.id} className="flex items-center justify-between p-4 hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      execution.status === 'completed' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-error-container text-on-error-container'
                    )}>
                      {execution.status === 'completed' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Execution #{execution.id.toUpperCase()}</p>
                      <p className="text-xs text-on-surface-variant">
                        {format(new Date(execution.timestamp), 'MMM d, yyyy • HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Duration</p>
                      <p className="text-sm font-medium">{execution.duration}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Records</p>
                      <p className="text-sm font-medium">{execution.recordsProcessed.toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <ArrowRight size={18} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <Card className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-4">Workflow Owner</h3>
            <div className="flex items-center gap-3">
              <img src={workflow.ownerAvatar} alt={workflow.owner} className="w-12 h-12 rounded-full border-2 border-primary/10" />
              <div>
                <p className="font-bold text-on-surface">{workflow.owner}</p>
                <p className="text-xs text-on-surface-variant">Lead Infrastructure Engineer</p>
              </div>
            </div>
            <Button variant="tonal" className="w-full mt-6">Contact Owner</Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-4">Active Version</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-black text-primary">{workflow.latestVersion}</span>
              <Badge variant="active">Production</Badge>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              Deployed on {format(new Date(workflow.lastModified), 'MMM d, yyyy')} by {workflow.modifiedBy.split('@')[0]}
            </p>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/workflows/${id}/versions/${workflow.latestVersion}`)}>
              <ExternalLink size={16} />
              View Canvas
            </Button>
          </Card>

          <Card className="p-6 bg-primary-container text-on-primary-container">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-80 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium flex items-center justify-between">
                Clone Workflow
                <ArrowRight size={14} />
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium flex items-center justify-between">
                Export Definition (JSON)
                <ArrowRight size={14} />
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium flex items-center justify-between">
                API Documentation
                <ArrowRight size={14} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

import { cn } from '../utils/cn';
