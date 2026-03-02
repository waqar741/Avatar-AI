import type { FaceParams } from '../types/face.types';
import { createNeutralParams } from '../types/face.types';

/**
 * Maps Rhubarb phoneme values (A–H, X) to normalized FaceParams targets.
 * Each phoneme defines a mouth shape preset; non-mouth params stay neutral.
 */

type PhonemeKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X';

const PHONEME_TARGETS: Record<PhonemeKey, Partial<FaceParams>> = {
    A: { mouthOpen: 0.7, mouthWide: 0.3 },                      // "ah" — jaw drop
    B: { mouthOpen: 0.0, mouthWide: 0.0, mouthRound: 0.0 },     // closed lips (M, B, P)
    C: { mouthOpen: 0.3, mouthWide: 0.7 },                      // "eh" / "ae"
    D: { mouthOpen: 0.4, mouthWide: 0.5 },                      // "ai" / "ay"
    E: { mouthOpen: 0.5, mouthWide: 0.0, mouthRound: 0.8 },     // "oh"
    F: { mouthOpen: 0.3, mouthWide: 0.5, mouthRound: 0.0 },     // "oo" / "w"
    G: { mouthOpen: 0.15, mouthWide: 0.1, mouthRound: 0.0 },    // "f" / "v" (teeth on lip)
    H: { mouthOpen: 0.2, mouthWide: 0.3, mouthRound: 0.0 },     // "l" / tongue shapes
    X: { mouthOpen: 0.0, mouthWide: 0.0, mouthRound: 0.0 },     // silence / rest
};

export class PhonemeMapper {
    private currentTarget: FaceParams = createNeutralParams();

    /**
     * Resolve a Rhubarb phoneme string into a full FaceParams target.
     * Unknown phonemes fall back to silence (X).
     */
    public getTarget(phonemeValue: string): FaceParams {
        const key = phonemeValue.toUpperCase() as PhonemeKey;
        const preset = PHONEME_TARGETS[key] ?? PHONEME_TARGETS['X'];
        const base = createNeutralParams();
        return { ...base, ...preset };
    }

    /**
     * Smoothly approach a phoneme target. Called per frame with delta time.
     * Returns the interpolated current params for this frame.
     */
    public update(phonemeValue: string, delta: number, speed: number = 12.0): FaceParams {
        const target = this.getTarget(phonemeValue);
        const t = Math.min(1, speed * delta);

        this.currentTarget = {
            ...this.currentTarget,
            mouthOpen: this.currentTarget.mouthOpen + (target.mouthOpen - this.currentTarget.mouthOpen) * t,
            mouthWide: this.currentTarget.mouthWide + (target.mouthWide - this.currentTarget.mouthWide) * t,
            mouthRound: this.currentTarget.mouthRound + (target.mouthRound - this.currentTarget.mouthRound) * t,
        };

        return this.currentTarget;
    }

    /** Hard reset to silence. */
    public reset(): void {
        this.currentTarget = createNeutralParams();
    }
}
