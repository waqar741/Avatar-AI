import type { FaceParams } from '../types/face.types';
import { createNeutralParams } from '../types/face.types';
import type { ConversationState } from '../../../systems/ConversationStateMachine';

/**
 * Blends expression presets based on ConversationState.
 * Each state has a target weight that transitions smoothly via delta-timed lerp.
 * The final output is a weighted combination of all active presets.
 */

// Static expression presets per state
const IDLE_PRESET: FaceParams = {
    ...createNeutralParams(),
    idleBreath: 1.0,
};

const THINKING_PRESET: FaceParams = {
    ...createNeutralParams(),
    browRaise: -0.3,        // slight furrow
    headTiltZ: 0.06,        // subtle side tilt
    eyeFocusY: 0.1,         // gaze slightly up
    idleBreath: 0.5,
};

const LISTENING_PRESET: FaceParams = {
    ...createNeutralParams(),
    browRaise: 0.2,         // attentive raised brows
    headTiltX: -0.04,       // slight forward nod
    eyeFocusY: 0.0,         // direct eye contact
    idleBreath: 0.6,
};

// Speaking preset is mostly neutral because phoneme mapper drives the mouth
const SPEAKING_PRESET: FaceParams = {
    ...createNeutralParams(),
    browRaise: 0.05,
    idleBreath: 0.3,        // reduced breathing during speech
};

interface StateWeights {
    idle: number;
    thinking: number;
    listening: number;
    speaking: number;
}

export class ExpressionBlender {
    private weights: StateWeights = { idle: 1, thinking: 0, listening: 0, speaking: 0 };
    private targetWeights: StateWeights = { idle: 1, thinking: 0, listening: 0, speaking: 0 };

    /** Set target weights based on current ConversationState. */
    public setStateTarget(state: ConversationState): void {
        this.targetWeights = { idle: 0, thinking: 0, listening: 0, speaking: 0 };

        switch (state) {
            case 'IDLE':
            case 'CONNECTING':
            case 'DISCONNECTED':
            case 'ERROR':
                this.targetWeights.idle = 1;
                break;
            case 'THINKING':
                this.targetWeights.thinking = 1;
                break;
            case 'LISTENING':
                this.targetWeights.listening = 1;
                break;
            case 'SPEAKING':
                this.targetWeights.speaking = 1;
                break;
        }
    }

    /**
     * Per-frame update: smooth weight transitions and compute blended FaceParams.
     * phonemeParams are merged INTO speaking weight if speaking > 0.
     */
    public update(delta: number, phonemeParams: FaceParams): FaceParams {
        const transitionSpeed = 5.0;
        const t = Math.min(1, transitionSpeed * delta);

        // Ease weights toward targets
        this.weights.idle += (this.targetWeights.idle - this.weights.idle) * t;
        this.weights.thinking += (this.targetWeights.thinking - this.weights.thinking) * t;
        this.weights.listening += (this.targetWeights.listening - this.weights.listening) * t;
        this.weights.speaking += (this.targetWeights.speaking - this.weights.speaking) * t;

        // Normalize weights
        const sum = this.weights.idle + this.weights.thinking + this.weights.listening + this.weights.speaking;
        const normFactor = sum > 0.001 ? 1 / sum : 1;

        const wi = this.weights.idle * normFactor;
        const wt = this.weights.thinking * normFactor;
        const wl = this.weights.listening * normFactor;
        const ws = this.weights.speaking * normFactor;

        // For speaking, merge phoneme mouth params into the speaking preset
        const speakingFinal: FaceParams = {
            ...SPEAKING_PRESET,
            mouthOpen: phonemeParams.mouthOpen,
            mouthWide: phonemeParams.mouthWide,
            mouthRound: phonemeParams.mouthRound,
        };

        // Weighted blend across all presets
        const result = createNeutralParams();
        const sources: [FaceParams, number][] = [
            [IDLE_PRESET, wi],
            [THINKING_PRESET, wt],
            [LISTENING_PRESET, wl],
            [speakingFinal, ws],
        ];

        for (const [preset, weight] of sources) {
            result.mouthOpen += preset.mouthOpen * weight;
            result.mouthWide += preset.mouthWide * weight;
            result.mouthRound += preset.mouthRound * weight;
            result.blink += preset.blink * weight;
            result.browRaise += preset.browRaise * weight;
            result.headTiltX += preset.headTiltX * weight;
            result.headTiltZ += preset.headTiltZ * weight;
            result.idleBreath += preset.idleBreath * weight;
            result.eyeFocusX += preset.eyeFocusX * weight;
            result.eyeFocusY += preset.eyeFocusY * weight;
        }

        return result;
    }
}
