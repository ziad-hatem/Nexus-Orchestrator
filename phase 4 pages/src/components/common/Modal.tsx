import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  icon,
  maxWidth = 'max-w-md'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/20",
              maxWidth
            )}
          >
            <div className="flex justify-end p-4 absolute right-0 top-0">
              <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {icon && (
              <div className="flex justify-center pt-8 pb-4">
                <div className="h-16 w-16 bg-error-container rounded-full flex items-center justify-center">
                  {icon}
                </div>
              </div>
            )}

            <div className="px-8 pb-8 text-center">
              <h3 className="text-2xl font-bold tracking-tight text-on-surface mb-3">{title}</h3>
              <div className="text-left">
                {children}
              </div>
              {footer && (
                <div className="mt-8 flex flex-col gap-3">
                  {footer}
                </div>
              )}
            </div>
            
            <div className="h-1.5 w-full bg-gradient-to-r from-primary-container via-primary to-primary-container" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
