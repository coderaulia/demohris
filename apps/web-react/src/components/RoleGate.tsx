import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/AuthProvider';

interface RoleGateProps {
    allow: Array<'superadmin' | 'hr' | 'manager' | 'employee' | 'director'>;
    children: ReactNode;
    title?: string;
    description?: string;
    redirectTo?: string;
}

export function RoleGate({
    allow,
    children,
    title = 'Access Restricted',
    description = 'Your current role does not have access to this area.',
    redirectTo,
}: RoleGateProps) {
    const auth = useAuth();
    const role = auth.role || 'employee';
    if (allow.includes(role)) {
        return <>{children}</>;
    }

    if (redirectTo) {
        return <Navigate to={redirectTo} replace />;
    }

    return (
        <Card className="border-destructive/40">
            <CardHeader>
                <CardTitle className="text-destructive">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
    );
}
