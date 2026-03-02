import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { FaceGeometry } from './FaceGeometry';
import { FaceAnimationController } from './systems/FaceAnimationController';
import type { FaceParams } from './types/face.types';
import { createNeutralParams } from './types/face.types';
import type { ConversationState } from '../../systems/ConversationStateMachine';
import type { PhonemeFrame } from '../../types/phoneme.types';

interface ProceduralFaceProps {
    appState: ConversationState;
    phonemes: PhonemeFrame[];
    getAudioTime: () => number;
}

/**
 * Root procedural face component.
 * Owns the FaceAnimationController and bridges React state to the animation loop.
 * Uses a single useState for params to trigger re-renders, updated in useFrame.
 */
export const ProceduralFace: React.FC<ProceduralFaceProps> = ({ appState, phonemes, getAudioTime }) => {
    const controllerRef = useRef(new FaceAnimationController());
    const [faceParams, setFaceParams] = useState<FaceParams>(createNeutralParams());

    // Track phoneme queue changes
    const prevPhonemesLengthRef = useRef(0);

    useEffect(() => {
        if (phonemes.length > prevPhonemesLengthRef.current) {
            const newFrames = phonemes.slice(prevPhonemesLengthRef.current);
            controllerRef.current.pushPhonemes(newFrames);
            prevPhonemesLengthRef.current = phonemes.length;
        } else if (phonemes.length === 0) {
            prevPhonemesLengthRef.current = 0;
            controllerRef.current.clearPhonemes();
        }
    }, [phonemes]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            controllerRef.current.clearPhonemes();
        };
    }, []);

    // Per-frame animation loop — throttle React updates to ~30hz to avoid excessive renders
    const frameCountRef = useRef(0);
    useFrame((_state, delta) => {
        controllerRef.current.update(delta, appState, getAudioTime());

        // Update React state every 2nd frame to balance smoothness vs render cost
        frameCountRef.current++;
        if (frameCountRef.current % 2 === 0) {
            setFaceParams({ ...controllerRef.current.getParams() });
        }
    });

    return (
        <group position={[0, 0, 0]}>
            {/* Soft lighting optimized for the face */}
            <ambientLight intensity={0.3} />
            <directionalLight position={[2, 3, 4]} intensity={1.2} color="#ffffff" />
            <directionalLight position={[-1, 1, 2]} intensity={0.4} color="#6a8cff" />
            <pointLight position={[0, 0, 2]} intensity={0.3} color="#4a6aaa" distance={5} />

            <FaceGeometry params={faceParams} />
        </group>
    );
};
