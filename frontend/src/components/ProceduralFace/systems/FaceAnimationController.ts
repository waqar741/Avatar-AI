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

    // Timing
    private elapsedTime = 0;

    // Blink subsystem
    private nextBlinkAt = 3 + Math.random() * 3;
    private blinkTimer = 0;
    private isBlinking = false;

    // Thinking state tracking — for staggered entry timing
    private thinkingElapsed = 0;
    private wasThinking = false;

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

        // Track thinking-state elapsed time for staggered cognitive drift
        if (state === 'THINKING') {
            this.thinkingElapsed += delta;
            this.wasThinking = true;
        } else {
            if (this.wasThinking) {
                this.thinkingElapsed = 0;
                this.wasThinking = false;
            }
        }

        // 1. Update phoneme tracking
        this.updatePhonemeTracking(state, audioTime);

        // 2. Get phoneme-driven mouth params
        const phonemeParams = this.phonemeMapper.update(this.activePhoneme, delta);

        // 3. Set expression blend targets from state
        this.expressionBlender.setStateTarget(state);

        // 4. Get blended expression params
        const blendedParams = this.expressionBlender.update(delta, phonemeParams);

        // 5. Layer autonomous behaviors on top
        this.updateBlink(delta, state, blendedParams);
        this.updateIdleBreathing(blendedParams);
        this.updateMicroMovement(state, blendedParams);
        this.updateThinkingCognitiveDrift(state, blendedParams);

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
            // console.log(`[LipSync] Found active phoneme ${frame.value} for elapsed time ${elapsed.toFixed(3)}s`);
        } else {
            // Purge stale frames
            const originalLength = this.phonemeQueue.length;
            this.phonemeQueue = this.phonemeQueue.filter(f => f.end > elapsed);
            if (originalLength !== this.phonemeQueue.length && this.phonemeQueue.length > 0) {
                // console.log(`[LipSync] Purged ${originalLength - this.phonemeQueue.length} stale frames. Next frame starts at ${this.phonemeQueue[0].start}s`);
            }
            if (this.phonemeQueue.length === 0) {
                this.activePhoneme = 'X';
            }
        }
    }

    private updateBlink(delta: number, state: ConversationState, params: FaceParams): void {
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
                params.blink = progress * 2;
            } else if (progress < 1.0) {
                params.blink = (1 - progress) * 2;
            } else {
                params.blink = 0;
                this.isBlinking = false;
                this.blinkTimer = 0;
                // Thinking: longer blink intervals (4–8s) — focused concentration
                // Idle: normal intervals (3–6s)
                if (state === 'THINKING') {
                    this.nextBlinkAt = 4 + Math.random() * 4;
                } else {
                    this.nextBlinkAt = 3 + Math.random() * 3;
                }
            }
        }
    }

    private updateIdleBreathing(params: FaceParams): void {
        // Gentle sine-wave breathing scaled by the blend's idleBreath weight
        const breathCycle = Math.sin(this.elapsedTime * 1.5) * 0.5 + 0.5;
        params.idleBreath = breathCycle * params.idleBreath;
    }

    private updateMicroMovement(state: ConversationState, params: FaceParams): void {
        // Very subtle procedural head micro-movement for organic feel
        // Reduced during speaking/thinking since those states have their own motion
        if (state === 'SPEAKING' || state === 'THINKING') return;

        const t = this.elapsedTime;
        params.headTiltX += Math.sin(t * 0.7) * 0.012;
        params.headTiltZ += Math.sin(t * 0.5 + 1.0) * 0.008;

        // Subtle eye wander during idle
        if (state === 'IDLE') {
            params.eyeFocusX += Math.sin(t * 0.3) * 0.06;
            params.eyeFocusY += Math.cos(t * 0.4 + 0.5) * 0.04;
        }
    }

    /**
     * Thinking-specific cognitive micro-drift.
     * Low-frequency sinusoidal overlays that layer on top of the
     * ExpressionBlender's THINKING_PRESET base values.
     *
     * Design intent:
     * - Eye gaze drifts subtly around the upper-right quadrant (not fixed)
     * - Head oscillates very slowly around the tilt position
     * - Brow asymmetry has micro-variation
     * - All driven by elapsed time, no randomness spikes
     */
    private updateThinkingCognitiveDrift(state: ConversationState, params: FaceParams): void {
        if (state !== 'THINKING') return;

        const t = this.thinkingElapsed;

        // Smooth entry ramp: 0→1 over ~400ms for natural onset
        const entryRamp = Math.min(1, t * 2.5);

        // Eye micro-drift around the preset upper-right gaze position
        // Very low frequency (0.4–0.6 Hz) for deliberate, not jittery, feel
        params.eyeFocusX += Math.sin(t * 0.4) * 0.04 * entryRamp;
        params.eyeFocusY += Math.sin(t * 0.55 + 0.8) * 0.03 * entryRamp;

        // Head micro-oscillation — slow, deliberate
        params.headTiltZ += Math.sin(t * 0.3 + 0.5) * 0.008 * entryRamp;
        params.headTiltY += Math.sin(t * 0.25) * 0.006 * entryRamp;
        params.headTiltX += Math.sin(t * 0.35 + 1.2) * 0.005 * entryRamp;

        // Brow asymmetry micro-variation — very subtle living detail
        params.browAsymmetry += Math.sin(t * 0.5 + 2.0) * 0.05 * entryRamp;
    }
}
