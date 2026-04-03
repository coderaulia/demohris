import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppProviders } from '@/providers/AppProviders';
import { router } from '@/router';
import '@/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing root element');

createRoot(rootElement).render(
    <StrictMode>
        <AppErrorBoundary>
            <AppProviders>
                <RouterProvider router={router} />
            </AppProviders>
        </AppErrorBoundary>
    </StrictMode>
);
