import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function KpiDrilldownPage() {
    const { mode, group } = useParams();
    const decodedMode = String(mode || 'kpi');
    const decodedGroup = decodeURIComponent(String(group || ''));

    return (
        <div className="space-y-4">
            <Link to="/kpi">
                <Button type="button" variant="outline">
                    <ArrowLeft className="size-4" />
                    Back To KPI Reporting
                </Button>
            </Link>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Compass className="size-4 text-primary" />
                        Drill-down Boundary
                    </CardTitle>
                    <CardDescription>
                        This route preserves the legacy drill-down interaction pattern while deeper record pages are being migrated slice-by-slice.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Badge variant="outline">Mode: {decodedMode}</Badge>
                    <Badge variant="outline">Department: {decodedGroup || '-'}</Badge>
                    <p className="text-sm text-muted-foreground">
                        Next safe expansion: record list pages for this group using verified read endpoints only.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
