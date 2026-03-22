import * as React from 'react';
import { 
  Filter, 
  Search, 
  MoreVertical, 
  Clock, 
  User, 
  ArrowRight,
  Activity,
  GitBranch,
  AlertCircle,
  Archive
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { workflowService } from '../services/api';
import { Workflow } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Modal } from '../components/Modal';

export const WorkflowDirectory: React.FC = () => {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [archiveModalOpen, setArchiveModalOpen] = React.useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<Workflow | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    workflowService.getWorkflows().then(data => {
      setWorkflows(data);
      setIsLoading(false);
    });
  }, []);

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { label: 'Active Workflows', value: '12', icon: Activity, color: 'text-primary' },
    { label: 'Draft Versions', value: '4', icon: GitBranch, color: 'text-secondary' },
    { label: 'Failed Executions', value: '2', icon: AlertCircle, color: 'text-error' },
  ];

  const handleArchiveClick = (e: React.MouseEvent, workflow: Workflow) => {
    e.stopPropagation();
    setSelectedWorkflow(workflow);
    setArchiveModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Workflow Directory</h1>
          <p className="text-on-surface-variant mt-1">Manage and monitor your enterprise automation pipelines.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Filter size={18} />
            Filters
          </Button>
          <Button className="gap-2" onClick={() => navigate('/workflows/new')}>
            Create Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="flex items-center gap-4 p-6">
            <div className={cn("w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center", stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-on-surface-variant font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-on-surface">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4 bg-surface-container-low p-2 rounded-2xl border border-outline-variant">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, ID, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-transparent rounded-xl text-sm focus:outline-none"
          />
        </div>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex items-center gap-2 px-2">
          <Button variant="ghost" size="sm" className="text-xs">All</Button>
          <Button variant="ghost" size="sm" className="text-xs">Active</Button>
          <Button variant="ghost" size="sm" className="text-xs">Draft</Button>
          <Button variant="ghost" size="sm" className="text-xs">Archived</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-surface-container animate-pulse" />
          ))
        ) : filteredWorkflows.map((workflow) => (
          <Card 
            key={workflow.id} 
            onClick={() => navigate(`/workflows/${workflow.id}`)}
            className="group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                    {workflow.id}
                  </span>
                  <Badge variant={workflow.status as any}>{workflow.status}</Badge>
                </div>
                <h3 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors">
                  {workflow.name}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => handleArchiveClick(e, workflow)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error-container hover:text-error transition-colors text-on-surface-variant"
                >
                  <Archive size={18} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant line-clamp-2 mb-6 h-10">
              {workflow.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {workflow.tags.map(tag => (
                <span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Clock size={14} />
                  <span>{formatDistanceToNow(new Date(workflow.lastModified))} ago</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <User size={14} />
                  <span>{workflow.modifiedBy.split('@')[0]}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <span>View Details</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Archive Workflow"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveModalOpen(false)}>Cancel</Button>
            <Button variant="error">Archive Workflow</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-error mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <div className="text-center">
            <p className="text-on-surface font-medium">Are you sure you want to archive this workflow?</p>
            <p className="text-sm text-on-surface-variant mt-2">
              Archiving <span className="font-bold text-on-surface">"{selectedWorkflow?.name}"</span> will immediately stop all active triggers and scheduled executions. This action can be reversed by an administrator.
            </p>
          </div>
          <div className="bg-surface-container p-4 rounded-xl border border-outline-variant">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Impact Summary</h4>
            <ul className="text-sm space-y-2 text-on-surface">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-error" />
                <span>3 Active Triggers will be disabled</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-error" />
                <span>2 Scheduled Cron jobs will be paused</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-error" />
                <span>API endpoints will return 404</span>
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import { cn } from '../utils/cn';
