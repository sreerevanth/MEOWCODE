const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export function startProviderHealthScheduler(runCheck) {
    return setInterval(() => {
        void runCheck().catch(() => {
            // Scheduler errors are non-fatal
        });
    }, HEALTH_CHECK_INTERVAL_MS);
}
