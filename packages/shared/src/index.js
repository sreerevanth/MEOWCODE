export function isProviderRoutable(status) {
    return status === "healthy" || status === "slow" || status === "degraded" || status === "unknown";
}
export function nowIso() {
    return new Date().toISOString();
}
export function assertNever(value) {
    throw new Error(`Unhandled value: ${String(value)}`);
}
