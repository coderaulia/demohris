import { env } from '@/lib/env';

export function LmsPlaceholderPage() {
    return (
        <article className="card">
            <h3>LMS Module Placeholder</h3>
            <p>
                LMS React migration is intentionally deferred. Existing LMS flows stay on the legacy app until domain
                cutover phases.
            </p>
            <a href={env.legacyAppUrl}>Open Legacy LMS Flow</a>
        </article>
    );
}
