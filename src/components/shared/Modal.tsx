import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  onClose,
  title,
  size = 'md'
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className={`relative bg-white dark:bg-veritas-darker-blue/95 rounded-3xl shadow-2xl border border-slate-200 dark:border-veritas-eggshell/10 w-full ${sizeClasses[size]}`}>
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-veritas-eggshell/10">
              <h2 className="text-xl font-semibold text-veritas-primary dark:text-veritas-eggshell">{title}</h2>
              <button
                onClick={onClose}
                className="text-veritas-primary/60 hover:text-veritas-primary dark:text-veritas-eggshell/60 dark:hover:text-veritas-eggshell transition-colors duration-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10"
              >
                <X size={24} />
              </button>
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
