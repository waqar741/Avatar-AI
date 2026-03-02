import type { FaceParams } from '../types/face.types';
import { createNeutralParams } from '../types/face.types';
import { PhonemeMapper } from './PhonemeMapper';
import { ExpressionBlender } from './ExpressionBlender';
import type { ConversationState } from '../../../systems/ConversationStateMachine';
import type { PhonemeFrame } from '../../../types/phoneme.types';

/**
 * Central single-source-of-truth for all procedural face parameters.
 * Integrates PhonemeMapper, ExpressionBlender, and autonomous idle behaviors.
 * Updated once per frame via `update()`. All geometry reads from `getParams()`.
 */
export class FaceAnimationController {
    private params: FaceParams = createNeutralParams();
    private phonemeMapper = new PhonemeMapper();
    private expressionBlender = new ExpressionBlender();

    // Idle subsystems
    private elapsedTime = 0;
    private nextBlinkAt = 3 + Math.random() * 3;
    private blinkTimer = 0;
    private isBlinking = false;

    // Phoneme queue tracking
    private phonemeQueue: PhonemeFrame[] = [];
    private activePhoneme = 'X';
    private audioStartTime: number | null = null;

    /** Push incoming phoneme frames from the backend stream. */
    public pushPhonemes(frames: PhonemeFrame[]): void {
        this.phonemeQueue.push(...frames);
    }

    /** Hard clear on interrupt. */
    public clearPhonemes(): void {
        this.phonemeQueue = [];
        this.activePhoneme = 'X';
        this.audioStartTime = null;
        this.phonemeMapper.reset();
    }

    /**
     * Master per-frame update. Call from useFrame.
     * @param delta - seconds since last frame
     * @param state - current ConversationState
     * @param audioTime - current AudioContext time (0 if no audio)
     */
    public update(delta: number, state: ConversationState, audioTime: number): void {
        this.elapsedTime += delta;

        // 1. Update phoneme tracking
        this.updatePhonemeTracking(state, audioTime);

        // 2. Get phoneme-driven mouth params
        const phonemeParams = this.phonemeMapper.update(this.activePhoneme, delta);

        // 3. Set expression blend targets from state
        this.expressionBlender.setStateTarget(state);

        // 4. Get blended expression params
        const blendedParams = this.expressionBlender.update(delta, phonemeParams);

        // 5. Layer autonomous behaviors on top
        this.updateBlink(delta, blendedParams);
        this.updateIdleBreathing(delta, blendedParams);
        this.updateMicroMovement(delta, state, blendedParams);

        // 6. Store final params
        this.params = blendedParams;
    }

    /** Read current face parameters. Pure getter, no mutations. */
    public getParams(): Readonly<FaceParams> {
        return this.params;
    }

    // --- Private autonomous subsystems ---

    private updatePhonemeTracking(state: ConversationState, audioTime: number): void {
        if (state !== 'SPEAKING') {
            this.activePhoneme = 'X';
            this.audioStartTime = null;
            return;
        }

        if (this.audioStartTime === null) {
            if (audioTime <= 0) return;
            this.audioStartTime = audioTime;
        }

        const elapsed = audioTime - this.audioStartTime;
        if (elapsed < 0 || this.phonemeQueue.length === 0) {
            this.activePhoneme = 'X';
            return;
        }

        // Find the active phoneme frame matching current audio time
        const frame = this.phonemeQueue.find(f => elapsed >= f.start && elapsed <= f.end);
        if (frame) {
            this.activePhoneme = frame.value;
        } else {
            // Purge stale frames
            this.phonemeQueue = this.phonemeQueue.filter(f => f.end > elapsed);
            if (this.phonemeQueue.length === 0) {
                this.activePhoneme = 'X';
            }
        }
    }

    private updateBlink(delta: number, params: FaceParams): void {
        // Autonomous blink every 3–6 seconds
        this.blinkTimer += delta;

        if (!this.isBlinking && this.blinkTimer >= this.nextBlinkAt) {
            this.isBlinking = true;
            this.blinkTimer = 0;
        }

        if (this.isBlinking) {
            // Quick blink: ramp up to 1 then back to 0 over ~0.15s
            const blinkDuration = 0.15;
            const progress = this.blinkTimer / blinkDuration;
            if (progress < 0.5) {
                params.blink = progress * 2; // 0 → 1
            } else if (progress < 1.0) {
                params.blink = (1 - progress) * 2; // 1 → 0
            } else {
                params.blink = 0;
                this.isBlinking = false;
                this.blinkTimer = 0;
                this.nextBlinkAt = 3 + Math.random() * 3;
            }
        }
    }

    private updateIdleBreathing(_delta: number, params: FaceParams): void {
        // Gentle sine-wave breathing scaled by the blend's idleBreath weight
        const breathCycle = Math.sin(this.elapsedTime * 1.5) * 0.5 + 0.5; // 0–1
        params.idleBreath = breathCycle * params.idleBreath; // Modulate by blended weight
    }

    private updateMicroMovement(_delta: number, state: ConversationState, params: FaceParams): void {
        // Very subtle procedural head micro-movement for organic feel
        const intensity = (state === 'SPEAKING' || state === 'THINKING') ? 0.3 : 1.0;
        params.headTiltX += Math.sin(this.elapsedTime * 0.7) * 0.015 * intensity + params.headTiltX;
        params.headTiltZ += Math.sin(this.elapsedTime * 0.5 + 1.0) * 0.01 * intensity + params.headTiltZ;

        // Subtle eye wander during idle
        if (state === 'IDLE') {
            params.eyeFocusX = Math.sin(this.elapsedTime * 0.3) * 0.08;
            params.eyeFocusY = Math.cos(this.elapsedTime * 0.4 + 0.5) * 0.05;
        }
    }
}
