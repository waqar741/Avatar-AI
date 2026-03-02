import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { PhonemeFrame } from '../types/phoneme.types';
import { LipSyncSystem } from '../systems/LipSyncSystem';

export const usePhonemeSync = (isPlaying: boolean, getAudioTime: () => number) => {
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

        // Lock in the anchor start time allowing frame interpolation sequentially
        if (startAudioTimeRef.current === null && isPlaying) {
            startAudioTimeRef.current = getAudioTime();
        }
    }, [isPlaying, getAudioTime]);

    const clearQueue = useCallback(() => {
        queueRef.current = [];
        startAudioTimeRef.current = null;
        systemRef.current.resetToNeutral(1.0);
    }, []);

    // Frame synchronization hook called by R3F useFrame natively
    const update = useCallback((delta: number) => {
        if (!isPlaying || queueRef.current.length === 0 || startAudioTimeRef.current === null) {
            systemRef.current.resetToNeutral(10 * delta); // Smooth decay idle
            return;
        }

        const currentTime = getAudioTime();
        const elapsed = currentTime - startAudioTimeRef.current;

        // Locate current dominant localized phoneme
        const activeFrame = queueRef.current.find(f => elapsed >= f.start && elapsed <= f.end);

        if (activeFrame) {
            // Apply frame intensely (0.5 lerp threshold scales well ~60fps capturing rapid clicks)
            systemRef.current.applyPhoneme(activeFrame, 0.5);
        } else {
            // Cull trailing executed frames avoiding iteration limits inflating memory over time
            queueRef.current = queueRef.current.filter(f => f.end > elapsed);
            if (queueRef.current.length === 0) {
                systemRef.current.resetToNeutral(10 * delta);
            }
        }
    }, [isPlaying, getAudioTime]);

    // Handle abrupt audio stops natively
    useEffect(() => {
        if (!isPlaying) {
            startAudioTimeRef.current = null;
        }
    }, [isPlaying]);

    return {
        initAvatarMesh,
        pushPhonemes,
        clearQueue,
        updateSync: update
    };
};
