import { ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DeferredModulePageProps {
    title: string;
    description: string;
    boundaries?: string[];
}

export function DeferredModulePage({ title, description, boundaries = [] }: DeferredModulePageProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    This section is intentionally read-first/deferred to preserve contract parity and mutation safety during backend cutover.
                </p>
                <div className="flex flex-wrap gap-2">
                    {boundaries.length === 0 ? (
                        <Badge variant="outline">Deferred by migration strategy</Badge>
                    ) : (
                        boundaries.map(item => (
                            <Badge key={item} variant="outline">{item}</Badge>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
