import React, { useState } from 'react';
import { Sparkles, Send, Loader2, Download, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export function GeminiImagePage() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      const imageUrl = await geminiService.generateImage(prompt);
      setGeneratedImage(imageUrl);
    } catch (err) {
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="mb-12">
        <Link to="/" className="flex items-center gap-2 text-[#005f9e] font-semibold mb-2 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] uppercase tracking-widest">Back to Dashboard</span>
        </Link>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4 flex items-center gap-3">
          <Sparkles className="text-[#005f9e]" />
          Visual Assets Generator
        </h1>
        <p className="text-slate-500 max-w-2xl leading-relaxed">
          Generate custom icons, background patterns, or visual placeholders for your workflow triggers using Gemini 3.1 Flash.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Prompt Description</label>
            <textarea 
              className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#005f9e] rounded-xl px-4 py-3 text-sm text-slate-900 transition-all resize-none mb-4" 
              placeholder="e.g., A minimalist 3D icon of a golden credit card with a blue glow, high quality, digital art..." 
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-gradient-to-br from-[#005f9e] to-[#0078c7] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Visual
                </>
              )}
            </button>
          </div>

          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
            <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <ImageIcon size={16} />
              Pro Tips
            </h4>
            <ul className="text-xs text-blue-800 space-y-2 leading-relaxed">
              <li>• Be specific about style (e.g., "flat design", "3D render", "isometric").</li>
              <li>• Mention colors to match your brand palette.</li>
              <li>• Use keywords like "high resolution" or "clean background".</li>
            </ul>
          </div>
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 rounded-2xl aspect-square relative overflow-hidden flex items-center justify-center border-4 border-white shadow-2xl">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-white/50"
                >
                  <Loader2 className="animate-spin" size={48} />
                  <p className="text-sm font-medium tracking-wide">Gemini is painting your vision...</p>
                </motion.div>
              ) : generatedImage ? (
                <motion.div 
                  key="image"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full relative group"
                >
                  <img 
                    src={generatedImage} 
                    alt="Generated visual" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <a 
                      href={generatedImage} 
                      download="nexus-asset.png"
                      className="p-3 bg-white rounded-full text-slate-900 hover:scale-110 transition-transform"
                    >
                      <Download size={24} />
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 text-white/20"
                >
                  <ImageIcon size={80} strokeWidth={1} />
                  <p className="text-sm font-medium tracking-wide">Your generated asset will appear here</p>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="absolute bottom-6 left-6 right-6 bg-red-500 text-white p-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
