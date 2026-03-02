/** Normalized face parameters driving all procedural geometry. */
export interface FaceParams {
    mouthOpen: number;     // 0–1
    mouthWide: number;     // 0–1
    mouthRound: number;    // 0–1
    blink: number;         // 0–1 (1 = fully closed)
    browRaise: number;     // -1 (furrowed) to 1 (raised)
    headTiltX: number;     // radians (nod)
    headTiltZ: number;     // radians (side tilt)
    idleBreath: number;    // 0–1 (scale oscillation)
    eyeFocusX: number;     // -1 to 1 (horizontal gaze)
    eyeFocusY: number;     // -1 to 1 (vertical gaze)
}

/** Factory for default neutral parameters. */
export function createNeutralParams(): FaceParams {
    return {
        mouthOpen: 0,
        mouthWide: 0,
        mouthRound: 0,
        blink: 0,
        browRaise: 0,
        headTiltX: 0,
        headTiltZ: 0,
        idleBreath: 0,
        eyeFocusX: 0,
        eyeFocusY: 0,
    };
}

/** Linearly interpolate all face parameters by factor t (0–1). */
export function lerpParams(a: FaceParams, b: FaceParams, t: number): FaceParams {
    const clamped = Math.max(0, Math.min(1, t));
    return {
        mouthOpen: a.mouthOpen + (b.mouthOpen - a.mouthOpen) * clamped,
        mouthWide: a.mouthWide + (b.mouthWide - a.mouthWide) * clamped,
        mouthRound: a.mouthRound + (b.mouthRound - a.mouthRound) * clamped,
        blink: a.blink + (b.blink - a.blink) * clamped,
        browRaise: a.browRaise + (b.browRaise - a.browRaise) * clamped,
        headTiltX: a.headTiltX + (b.headTiltX - a.headTiltX) * clamped,
        headTiltZ: a.headTiltZ + (b.headTiltZ - a.headTiltZ) * clamped,
        idleBreath: a.idleBreath + (b.idleBreath - a.idleBreath) * clamped,
        eyeFocusX: a.eyeFocusX + (b.eyeFocusX - a.eyeFocusX) * clamped,
        eyeFocusY: a.eyeFocusY + (b.eyeFocusY - a.eyeFocusY) * clamped,
    };
}
