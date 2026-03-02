export class PerformanceMonitor {
    private frameCount: number = 0;
    private lastTime: number = performance.now();
    private fpsWarningLogged: boolean = false;
    private readonly WARNING_THRESHOLD: number = 45;

    private loopId: number = 0;
    private active: boolean = false;

    public start() {
        if (this.active) return;
        this.active = true;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.loop();
    }

    public stop() {
        this.active = false;
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
        }
    }

    private loop = () => {
        if (!this.active) return;

        this.frameCount++;
        const now = performance.now();
        const elapsed = now - this.lastTime;

        if (elapsed >= 1000) { // Calculate precisely every 1000ms 
            const fps = (this.frameCount * 1000) / elapsed;

            if (fps < this.WARNING_THRESHOLD && !this.fpsWarningLogged) {
                console.warn(`[Performance] FPS dropped to ${fps.toFixed(1)}. Avatar interactions may feel sluggish. Consider reducing geometry bounds.`);
                this.fpsWarningLogged = true;
            } else if (fps >= this.WARNING_THRESHOLD && this.fpsWarningLogged) {
                // Recover lock silently allowing re-trigger
                this.fpsWarningLogged = false;
            }

            this.frameCount = 0;
            this.lastTime = now;
        }

        this.loopId = requestAnimationFrame(this.loop);
    };
}
