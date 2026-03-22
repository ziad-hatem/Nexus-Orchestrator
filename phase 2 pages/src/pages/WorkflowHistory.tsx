import * as React from 'react';
import { 
  ArrowLeft, 
  History, 
  ExternalLink, 
  RotateCcw, 
  MoreVertical,
  User,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { workflowService } from '../services/api';
import { Workflow, WorkflowVersion } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { format } from 'date-fns';

export const WorkflowHistory: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = React.useState<Workflow | null>(null);
  const [versions, setVersions] = React.useState<WorkflowVersion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (id) {
      Promise.all([
        workflowService.getWorkflowById(id),
        workflowService.getVersions(id)
      ]).then(([w, v]) => {
        if (w) setWorkflow(w);
        setVersions(v);
        setIsLoading(false);
      });
    }
  }, [id]);

  if (isLoading) return <div className="animate-pulse space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-surface-container rounded-2xl" />)}</div>;
  if (!workflow) return <div>Not found</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(`/workflows/${id}`)}
          className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Version History</h1>
          <p className="text-on-surface-variant">{workflow.name} • {workflow.id}</p>
        </div>
      </div>

      <div className="space-y-4">
        {versions.map((version) => (
          <Card key={version.id} className="p-6 hover:bg-surface-container-low transition-colors group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4 flex-1">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  version.status === 'active' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-surface-container text-on-surface-variant'
                )}>
                  {version.status === 'active' ? <CheckCircle2 size={24} /> : <History size={24} />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-on-surface">{version.versionId}</span>
                    <Badge variant={version.status}>{version.status}</Badge>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl">
                    {version.notes}
                  </p>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <User size={14} />
                      <span>{version.publisher}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <Clock size={14} />
                      <span>{format(new Date(version.timestamp), 'MMM d, yyyy • HH:mm')}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/workflows/${id}/versions/${version.versionId}`)}>
                  <ExternalLink size={14} />
                  View Canvas
                </Button>
                {version.status !== 'active' && (
                  <Button variant="tonal" size="sm" className="gap-2">
                    <RotateCcw size={14} />
                    Rollback
                  </Button>
                )}
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-surface-container-low p-6 rounded-3xl border border-dashed border-outline-variant flex items-center justify-center gap-4">
        <AlertCircle size={20} className="text-on-surface-variant" />
        <p className="text-sm text-on-surface-variant">
          Versions older than 90 days are automatically archived to cold storage. 
          <button className="text-primary font-bold ml-1 hover:underline">View Archive</button>
        </p>
      </div>
    </div>
  );
};

import { cn } from '../utils/cn';
