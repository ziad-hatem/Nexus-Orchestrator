import * as React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  className 
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden flex flex-col",
              className
            )}
          >
            <div className="px-6 py-4 flex items-center justify-between border-b border-outline-variant">
              <h3 className="text-lg font-bold text-on-surface">{title}</h3>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
              >
                <X size={20} className="text-on-surface-variant" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {children}
            </div>

            {footer && (
              <div className="px-6 py-4 bg-surface-container-low flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
