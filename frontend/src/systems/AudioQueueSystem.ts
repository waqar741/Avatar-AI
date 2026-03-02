export class AudioQueueSystem {
    private queue: AudioBuffer[] = [];
    private isPlaying: boolean = false;
    private sourceNode: AudioBufferSourceNode | null = null;
    public audioContext: AudioContext;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    public async enqueueBase64Audio(base64Data: string): Promise<void> {
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (e) {
                console.warn("Could not resume strict browser audio context", e);
            }
        }

        try {
            const arrayBuffer = this.base64ToArrayBuffer(base64Data);
            // Must copy buffer internally when decoding concurrently
            const decodedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.queue.push(decodedBuffer);

            if (!this.isPlaying) {
                this.playNext();
            }
        } catch (error) {
            console.error("Audio decode error:", error);
        }
    }

    private playNext(): void {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            this.sourceNode = null;
            return;
        }

        this.isPlaying = true;
        const buffer = this.queue.shift()!;

        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = buffer;
        this.sourceNode.connect(this.audioContext.destination);

        this.sourceNode.onended = () => {
            // Proceed natively strictly syncing to buffer runtime boundary
            this.playNext();
        };

        this.sourceNode.start(0);
    }

    public isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    public stopAndClear(): void {
        if (this.sourceNode) {
            this.sourceNode.onended = null;
            this.sourceNode.stop();
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        this.queue = [];
        this.isPlaying = false;
    }

    public dispose(): void {
        this.stopAndClear();
        if (this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}
