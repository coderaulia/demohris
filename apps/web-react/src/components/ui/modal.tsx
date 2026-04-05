import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Button } from './button';

interface ModalProps {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    actions?: ReactNode;
    className?: string;
}

export function Modal({ open, title, description, onClose, children, actions, className }: ModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className={cn('w-full max-w-2xl rounded-2xl border bg-card shadow-2xl', className)}>
                <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
                </div>
                <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
                {actions ? <div className="flex justify-end gap-2 border-t p-5">{actions}</div> : null}
            </div>
        </div>
    );
}
