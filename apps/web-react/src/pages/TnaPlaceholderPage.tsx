import { env } from '@/lib/env';

export function TnaPlaceholderPage() {
    return (
        <article className="card">
            <h3>TNA Module Placeholder</h3>
            <p>
                TNA remains served by legacy UI during this shell phase. This route exists to keep navigation and
                guard behavior stable while module cutovers are planned.
            </p>
            <a href={env.legacyAppUrl}>Open Legacy TNA Flow</a>
        </article>
    );
}
