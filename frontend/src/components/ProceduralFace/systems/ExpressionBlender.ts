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
    browRaise: -0.15,          // mild concentration furrow (not cartoon)
    browAsymmetry: 0.35,       // right brow slightly higher — asymmetry reads as cognition
    headTiltX: -0.02,          // very slight downward nod
    headTiltY: 0.08,           // subtle rightward yaw (~4.5°) — processing bias
    headTiltZ: 0.09,           // gentle side tilt (~5°)
    eyeFocusX: 0.25,           // gaze shifted right
    eyeFocusY: 0.18,           // gaze shifted upward — upper-right quadrant
    idleBreath: 0.4,           // reduced but present breathing
};

const LISTENING_PRESET: FaceParams = {
    ...createNeutralParams(),
    browRaise: 0.2,            // attentive raised brows
    headTiltX: -0.04,          // slight forward nod
    eyeFocusY: 0.0,            // direct eye contact
    idleBreath: 0.6,
};

// Speaking preset is mostly neutral because phoneme mapper drives the mouth
const SPEAKING_PRESET: FaceParams = {
    ...createNeutralParams(),
    browRaise: 0.05,
    idleBreath: 0.3,           // reduced breathing during speech
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
     *
     * Transition speed is tuned per-state for staggered entry:
     * - THINKING enters slower (3.0) for a deliberate ease-in feel
     * - SPEAKING enters faster (6.0) for responsive lip-sync latency
     */
    public update(delta: number, phonemeParams: FaceParams): FaceParams {
        // Per-weight transition speeds for staggered entry/exit
        const idleSpeed = 4.0;
        const thinkingSpeed = 3.0;     // slower ease-in → deliberate cognitive onset
        const listeningSpeed = 5.0;
        const speakingSpeed = 6.0;     // faster → responsive to first audio chunk

        this.weights.idle += (this.targetWeights.idle - this.weights.idle) * Math.min(1, idleSpeed * delta);
        this.weights.thinking += (this.targetWeights.thinking - this.weights.thinking) * Math.min(1, thinkingSpeed * delta);
        this.weights.listening += (this.targetWeights.listening - this.weights.listening) * Math.min(1, listeningSpeed * delta);
        this.weights.speaking += (this.targetWeights.speaking - this.weights.speaking) * Math.min(1, speakingSpeed * delta);

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
            result.browAsymmetry += preset.browAsymmetry * weight;
            result.headTiltX += preset.headTiltX * weight;
            result.headTiltY += preset.headTiltY * weight;
            result.headTiltZ += preset.headTiltZ * weight;
            result.idleBreath += preset.idleBreath * weight;
            result.eyeFocusX += preset.eyeFocusX * weight;
            result.eyeFocusY += preset.eyeFocusY * weight;
        }

        return result;
    }
}
