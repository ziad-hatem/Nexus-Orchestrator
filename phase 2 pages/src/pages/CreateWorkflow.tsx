import * as React from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Database, 
  Tag, 
  Info,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { cn } from '../utils/cn';

const steps = [
  { id: 1, label: 'Basic Info', icon: Info },
  { id: 2, label: 'Configuration', icon: Zap },
  { id: 3, label: 'Review', icon: CheckCircle2 },
];

export const CreateWorkflow: React.FC = () => {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    name: '',
    id: 'WFL-' + Math.floor(Math.random() * 10000),
    description: '',
    category: 'Production',
    trigger: 'Schedule',
    resources: '1 CPU / 2GB RAM',
    tags: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    navigate(`/workflows/${formData.id}/edit`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Create New Workflow</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto">
          Initiate a new automation pipeline. You'll be able to build the visual workflow canvas in the next step.
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4">
        {steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                currentStep === step.id ? "bg-primary text-on-primary shadow-lg scale-110" : 
                currentStep > step.id ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-surface-container text-on-surface-variant"
              )}>
                {currentStep > step.id ? <CheckCircle2 size={24} /> : <step.icon size={24} />}
              </div>
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider",
                currentStep === step.id ? "text-primary" : "text-on-surface-variant"
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "h-0.5 w-16 mb-6 transition-colors duration-300",
                currentStep > step.id ? "bg-[#2e7d32]" : "bg-outline-variant"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card className="p-8 min-h-[400px] flex flex-col">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 flex-1"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Workflow Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Enterprise Data Sync"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-12 px-4 bg-surface-container-low rounded-xl text-sm border border-outline-variant focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Workflow ID</label>
                  <input 
                    type="text" 
                    value={formData.id}
                    readOnly
                    className="w-full h-12 px-4 bg-surface-container text-on-surface-variant rounded-xl text-sm border border-outline-variant cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Description</label>
                <textarea 
                  placeholder="Describe the purpose and scope of this workflow..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full h-32 p-4 bg-surface-container-low rounded-xl text-sm border border-outline-variant focus:border-primary focus:outline-none resize-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Category</label>
                <div className="flex flex-wrap gap-2">
                  {['Production', 'Infrastructure', 'Security', 'Maintenance'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFormData({ ...formData, category: cat })}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                        formData.category === cat ? "bg-primary text-on-primary shadow-md" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1"
            >
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Zap size={20} className="text-primary" />
                  Trigger Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'Schedule', label: 'Cron Schedule', desc: 'Time-based execution' },
                    { id: 'Webhook', label: 'Webhook', desc: 'HTTP POST receiver' },
                    { id: 'Manual', label: 'Manual', desc: 'Trigger via API/UI' },
                  ].map(trigger => (
                    <button
                      key={trigger.id}
                      onClick={() => setFormData({ ...formData, trigger: trigger.id })}
                      className={cn(
                        "p-4 rounded-2xl text-left border-2 transition-all",
                        formData.trigger === trigger.id ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-low hover:border-primary/50"
                      )}
                    >
                      <p className="font-bold text-on-surface">{trigger.label}</p>
                      <p className="text-xs text-on-surface-variant mt-1">{trigger.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Database size={20} className="text-primary" />
                  Resource Allocation
                </h3>
                <select 
                  value={formData.resources}
                  onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
                  className="w-full h-12 px-4 bg-surface-container-low rounded-xl text-sm border border-outline-variant focus:border-primary focus:outline-none"
                >
                  <option>1 CPU / 2GB RAM (Standard)</option>
                  <option>2 CPU / 4GB RAM (High Performance)</option>
                  <option>4 CPU / 8GB RAM (Enterprise)</option>
                  <option>Shared Instance (Low Priority)</option>
                </select>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Tag size={20} className="text-primary" />
                  Tags & Metadata
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['Infrastructure', 'Postgres', 'AWS', 'Salesforce', 'Stripe', 'Security'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        const newTags = formData.tags.includes(tag) 
                          ? formData.tags.filter(t => t !== tag)
                          : [...formData.tags, tag];
                        setFormData({ ...formData, tags: newTags });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                        formData.tags.includes(tag) ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1"
            >
              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-on-surface">{formData.name || 'Untitled Workflow'}</h3>
                  <Badge variant="draft">DRAFT</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Workflow ID</p>
                    <p className="text-sm font-medium font-mono">{formData.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Category</p>
                    <p className="text-sm font-medium">{formData.category}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Trigger</p>
                    <p className="text-sm font-medium">{formData.trigger}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Resources</p>
                    <p className="text-sm font-medium">{formData.resources}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Description</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {formData.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
                <Info size={20} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  By creating this workflow, you are initializing a new pipeline definition. You will be redirected to the visual canvas to build your automation logic.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-8 mt-auto flex items-center justify-between border-t border-outline-variant">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft size={18} />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button 
            onClick={handleNext} 
            className="gap-2 min-w-[140px]"
            disabled={isSubmitting || (currentStep === 1 && !formData.name)}
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {currentStep === steps.length ? 'Create Workflow' : 'Continue'}
                <ArrowRight size={18} />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
