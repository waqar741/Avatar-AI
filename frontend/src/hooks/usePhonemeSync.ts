import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { PhonemeFrame } from '../types/phoneme.types';
import { LipSyncSystem } from '../systems/LipSyncSystem';
import type { ConversationState } from '../systems/ConversationStateMachine';

export const usePhonemeSync = (systemState: ConversationState, getAudioTime: () => number) => {
    const systemRef = useRef<LipSyncSystem>(new LipSyncSystem());
    const queueRef = useRef<PhonemeFrame[]>([]);

    // Using a ref to track elapsed time locally since we can't reliably sync
    // the precise microsecond AudioContext starting point against arbitrary frame delivery.
    // AudioTime gives us the hardware clock which is the strongest truth.
    const startAudioTimeRef = useRef<number | null>(null);

    const initAvatarMesh = useCallback((mesh: THREE.SkinnedMesh) => {
        systemRef.current.initialize(mesh);
    }, []);

    const pushPhonemes = useCallback((frames: PhonemeFrame[]) => {
        queueRef.current.push(...frames);
    }, []);

    const clearQueue = useCallback(() => {
        queueRef.current = [];
        startAudioTimeRef.current = null;
        systemRef.current.resetToNeutral(1.0); // hard reset on explicit clears (interruptions)
    }, []);

    // Frame synchronization hook called by R3F useFrame natively
    const update = useCallback((delta: number) => {
        if (systemState !== 'SPEAKING') {
            // Constantly dampen and scrub out lingering variables when muted
            systemRef.current.resetToNeutral(10 * delta);
            startAudioTimeRef.current = null;
            return;
        }

        const currentTime = getAudioTime();

        // Audio has begun but we haven't locked our timer bound mapping yet
        if (startAudioTimeRef.current === null) {
            if (currentTime <= 0) return; // Strict browser context silence
            startAudioTimeRef.current = currentTime;
        }

        const elapsed = currentTime - startAudioTimeRef.current;

        // Ensure we gracefully handle negative thresholds catching initialization bumps
        // or moments where phoneme json arrives milliseconds prior to the audio buffering chunks
        if (elapsed < 0 || queueRef.current.length === 0) {
            systemRef.current.resetToNeutral(10 * delta);
            return;
        }

        // Locate current dominant localized phoneme natively 
        const activeFrame = queueRef.current.find(f => elapsed >= f.start && elapsed <= f.end);

        if (activeFrame) {
            // Apply frame intensely (e.g., lerp 15.0 scaled by delta tracks rapid clicks correctly visually)
            systemRef.current.applyPhoneme(activeFrame, 15.0 * delta);
        } else {
            // Cull securely pulling stale events from memory 
            queueRef.current = queueRef.current.filter(f => f.end > elapsed);
            if (queueRef.current.length === 0) {
                systemRef.current.resetToNeutral(10 * delta);
            }
        }
    }, [systemState, getAudioTime]);

    return {
        initAvatarMesh,
        pushPhonemes,
        clearQueue,
        updateSync: update
    };
};
