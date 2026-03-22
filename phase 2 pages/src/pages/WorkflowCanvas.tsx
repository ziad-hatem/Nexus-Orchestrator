import * as React from 'react';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Settings, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  MousePointer2,
  Hand,
  Plus,
  Zap,
  Cpu,
  GitBranch,
  Database,
  Archive,
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { workflowService } from '../services/api';
import { Workflow, Node, Edge } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

const nodeIcons = {
  trigger: Zap,
  process: Cpu,
  condition: GitBranch,
  action: Database,
  archive: Archive,
};

const nodeColors = {
  trigger: 'bg-primary text-on-primary',
  process: 'bg-secondary-container text-on-secondary-container',
  condition: 'bg-tertiary-container text-on-tertiary',
  action: 'bg-primary-container text-on-primary-container',
  archive: 'bg-error-container text-on-error-container',
};

export const WorkflowCanvas: React.FC = () => {
  const { id, versionId } = useParams<{ id: string; versionId?: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = React.useState<Workflow | null>(null);
  const [nodes, setNodes] = React.useState<Node[]>([
    { id: '1', type: 'trigger', label: 'Cron Schedule', description: 'Daily at 00:00 UTC', position: { x: 100, y: 100 }, config: {} },
    { id: '2', type: 'process', label: 'Data Transformer', description: 'PostgreSQL -> JSON', position: { x: 400, y: 100 }, config: {} },
    { id: '3', type: 'condition', label: 'Check Size', description: 'Records > 1000', position: { x: 700, y: 100 }, config: {} },
    { id: '4', type: 'action', label: 'Bulk Ingest', description: 'Analytical Warehouse', position: { x: 1000, y: 50 }, config: {} },
    { id: '5', type: 'archive', label: 'Log Failure', description: 'Error Logger', position: { x: 1000, y: 250 }, config: {} },
  ]);
  const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  React.useEffect(() => {
    if (id) {
      workflowService.getWorkflowById(id).then(w => {
        if (w) setWorkflow(w);
      });
    }
  }, [id]);

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    setIsSidebarOpen(true);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background z-50">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-surface-container-lowest border-b border-outline-variant">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/workflows/${id}`)}
            className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="h-8 w-px bg-outline-variant" />
          <div>
            <h1 className="text-lg font-bold text-on-surface leading-tight">
              {workflow?.name}
              <span className="text-on-surface-variant font-normal ml-2">/ {versionId || 'Draft'}</span>
            </h1>
            <p className="text-xs text-on-surface-variant">Last saved 2 minutes ago</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface-container-low rounded-xl p-1 border border-outline-variant mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8"><MousePointer2 size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Hand size={16} /></Button>
          </div>
          <Button variant="outline" className="gap-2">
            <Save size={18} />
            Save Draft
          </Button>
          <Button className="gap-2" onClick={() => setIsPublishModalOpen(true)}>
            <Send size={18} />
            Publish Version
          </Button>
          <div className="h-8 w-px bg-outline-variant mx-2" />
          <Button variant="ghost" size="icon">
            <Settings size={20} />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden relative workflow-grid bg-surface-container-low">
          {/* Canvas Toolbar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-container-lowest p-2 rounded-2xl shadow-xl border border-outline-variant z-10">
            <Button variant="ghost" size="icon"><ZoomIn size={20} /></Button>
            <div className="text-xs font-bold px-2">100%</div>
            <Button variant="ghost" size="icon"><ZoomOut size={20} /></Button>
            <div className="h-6 w-px bg-outline-variant mx-1" />
            <Button variant="ghost" size="icon"><Maximize size={20} /></Button>
            <div className="h-6 w-px bg-outline-variant mx-1" />
            <Button variant="primary" size="sm" className="rounded-lg">Auto Layout</Button>
          </div>

          {/* Nodes Container */}
          <div className="absolute inset-0 p-20">
            {nodes.map((node) => {
              const Icon = nodeIcons[node.type];
              return (
                <motion.div
                  key={node.id}
                  initial={false}
                  animate={{ x: node.position.x, y: node.position.y }}
                  onClick={() => handleNodeClick(node)}
                  className={cn(
                    "absolute w-64 p-4 rounded-2xl shadow-lg border-2 cursor-pointer transition-all",
                    selectedNode?.id === node.id ? "border-primary ring-4 ring-primary/10" : "border-transparent bg-surface-container-lowest"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", nodeColors[node.type])}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-on-surface truncate">{node.label}</h4>
                      <p className="text-xs text-on-surface-variant truncate">{node.description}</p>
                    </div>
                  </div>
                  
                  {/* Connection Points */}
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-outline-variant border-4 border-surface-container-lowest" />
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-outline-variant border-4 border-surface-container-lowest" />
                </motion.div>
              );
            })}

            {/* Mock Edges (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#c0c7d3" />
                </marker>
              </defs>
              <path d="M 364 150 L 400 150" stroke="#c0c7d3" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
              <path d="M 664 150 L 700 150" stroke="#c0c7d3" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
              <path d="M 964 150 L 1000 100" stroke="#c0c7d3" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
              <path d="M 964 150 L 1000 300" stroke="#c0c7d3" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
            </svg>
          </div>
        </div>

        {/* Inspector Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="w-96 bg-surface-container-lowest border-l border-outline-variant flex flex-col z-20"
            >
              <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                <h3 className="text-lg font-bold">Node Settings</h3>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-surface-container rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {selectedNode ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", nodeColors[selectedNode.type])}>
                        {React.createElement(nodeIcons[selectedNode.type], { size: 28 })}
                      </div>
                      <div>
                        <Badge variant="legacy">{selectedNode.type.toUpperCase()}</Badge>
                        <h4 className="text-xl font-black mt-1">{selectedNode.label}</h4>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Label</label>
                        <input 
                          type="text" 
                          value={selectedNode.label}
                          className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-sm border border-outline-variant focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Description</label>
                        <textarea 
                          className="w-full h-24 p-3 bg-surface-container-low rounded-xl text-sm border border-outline-variant focus:border-primary focus:outline-none resize-none"
                          value={selectedNode.description}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-sm font-bold flex items-center gap-2">
                        <Settings size={16} />
                        Configuration
                      </h5>
                      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Retry on failure</span>
                          <div className="w-10 h-6 rounded-full bg-primary relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-on-surface-variant">Max Retries</label>
                          <input type="number" defaultValue={3} className="w-full h-8 px-2 bg-surface-container-lowest rounded-lg text-sm border border-outline-variant" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                    <Info size={48} />
                    <p className="text-sm font-medium">Select a node to view and edit its configuration.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-surface-container-low border-t border-outline-variant">
                <Button variant="error" className="w-full gap-2">
                  Delete Node
                </Button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Node Palette (Floating) */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-8 top-8 w-12 h-12 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-10"
          >
            <ChevronRight size={24} className="rotate-180" />
          </button>
        )}
      </div>

      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Review & Publish Version"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsPublishModalOpen(false)}>Cancel</Button>
            <Button className="gap-2">
              <Send size={18} />
              Confirm & Publish
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">New Version</span>
              <span className="text-lg font-black text-primary">v2.4.13-stable</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Release Notes</label>
              <textarea 
                placeholder="Describe the changes in this version..."
                className="w-full h-32 p-3 bg-surface-container-lowest rounded-xl text-sm border border-outline-variant focus:border-primary focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold">Validation Checks</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#e8f5e9] text-[#2e7d32] text-sm font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Node connectivity verified</span>
                </div>
                <span className="text-xs">PASS</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#e8f5e9] text-[#2e7d32] text-sm font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Resource allocation within limits</span>
                </div>
                <span className="text-xs">PASS</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>Circular dependency detected</span>
                </div>
                <span className="text-xs font-bold underline cursor-pointer">FIX</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import { cn } from '../utils/cn';
