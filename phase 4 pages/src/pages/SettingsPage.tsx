import React, { useState } from 'react';
import { Image, Wand2, Download, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { generateImage, editImage } from '../services/geminiService';
import { cn } from '../components/common/Button';

export const SettingsPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const url = await generateImage(prompt);
      setGeneratedImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!generatedImage || !editPrompt.trim()) return;
    setIsEditing(true);
    setError(null);
    try {
      const url = await editImage(generatedImage, editPrompt);
      setGeneratedImage(url);
      setEditPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit image");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Settings</h1>
        <p className="text-secondary text-sm font-medium">Configure your environment and explore AI capabilities.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="tonal-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-on-surface">Nano Banana 2: AI Lab</h2>
                <p className="text-sm text-secondary">Generate and edit assets using Gemini 3.1 Flash Image.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Generation Prompt</label>
                <div className="flex gap-3">
                  <textarea 
                    className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none h-24"
                    placeholder="Describe the image you want to create (e.g., 'A futuristic data center with blue neon lights, cinematic lighting')..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleGenerate} 
                  isLoading={isGenerating}
                  disabled={!prompt.trim() || isGenerating}
                  icon={<Image className="w-4 h-4" />}
                >
                  Generate Asset
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-error rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {generatedImage && (
                <div className="space-y-6 pt-6 border-t border-outline-variant/10">
                  <div className="relative group rounded-2xl overflow-hidden border border-outline-variant/20 shadow-lg bg-slate-900">
                    <img 
                      src={generatedImage} 
                      alt="Generated" 
                      className="w-full h-auto max-h-[500px] object-contain mx-auto"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <a 
                        href={generatedImage} 
                        download="nexus-asset.png"
                        className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-slate-700 hover:text-primary transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button 
                        onClick={() => setGeneratedImage(null)}
                        className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-slate-700 hover:text-error transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Edit Generated Asset</label>
                    <div className="flex gap-3">
                      <input 
                        className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        placeholder="Describe changes (e.g., 'Add a robot in the foreground')..."
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                      />
                      <Button 
                        variant="secondary"
                        onClick={handleEdit}
                        isLoading={isEditing}
                        disabled={!editPrompt.trim() || isEditing}
                        icon={<Wand2 className="w-4 h-4" />}
                      >
                        Apply Edits
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="tonal-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Account Details</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-surface-container-high overflow-hidden">
                  <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Ziad Hatem</p>
                  <p className="text-xs text-secondary">ziadhatemdev@gmail.com</p>
                </div>
              </div>
              <div className="pt-4 border-t border-outline-variant/10">
                <p className="text-[10px] font-bold text-outline uppercase mb-1">Role</p>
                <span className="px-2 py-0.5 bg-blue-50 text-primary text-[10px] font-bold rounded uppercase">Admin Operator</span>
              </div>
            </div>
          </section>

          <section className="tonal-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">System Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-secondary">API Status</span>
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-secondary">Region</span>
                <span className="text-xs font-mono font-bold">us-east-1</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-secondary">Version</span>
                <span className="text-xs font-mono font-bold">v4.12.0-stable</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
