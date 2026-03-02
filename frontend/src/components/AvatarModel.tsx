import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { usePhonemeSync } from '../hooks/usePhonemeSync';
import { IdleAnimationSystem } from '../systems/IdleAnimationSystem';
import { PhonemeFrame } from '../types/phoneme.types';

// IMPORTANT: Requires physical avatar.glb presence in <public/avatars/avatar.glb> to circumvent network cross-domain limits
const MODEL_URL = '/avatars/avatar.glb';

interface AvatarModelProps {
    phonemes: PhonemeFrame[];
    isPlayingAudio: boolean;
    getAudioTime: () => number;
}

export const AvatarModel: React.FC<AvatarModelProps> = ({ phonemes, isPlayingAudio, getAudioTime }) => {
    // Drei's useGLTF efficiently handles caching and suspense wrappers implicitly
    const { scene } = useGLTF(MODEL_URL) as any;

    const [skinnedMesh, setSkinnedMesh] = useState<THREE.SkinnedMesh | null>(null);
    const { initAvatarMesh, pushPhonemes, updateSync, clearQueue } = usePhonemeSync(isPlayingAudio, getAudioTime);

    const idleSystemRef = useRef<IdleAnimationSystem | null>(null);

    // Initial mount bindings assigning systems explicitly towards the discovered rigged head component
    useEffect(() => {
        if (scene) {
            scene.traverse((child: any) => {
                // Target core humanoid geometry containing shape keys or bone vertices 
                if (child.isSkinnedMesh && (child.name.toLowerCase().includes('head') || child.name.toLowerCase().includes('body'))) {
                    if (!skinnedMesh) setSkinnedMesh(child);
                }
            });

            if (!idleSystemRef.current) {
                idleSystemRef.current = new IdleAnimationSystem();
                idleSystemRef.current.initialize(scene);
            }
        }

        return () => {
            if (idleSystemRef.current) {
                idleSystemRef.current.dispose();
            }
            clearQueue();
        };
    }, [scene]);

    // Push inbound generation logic onto orchestrators tightly
    useEffect(() => {
        if (skinnedMesh) {
            initAvatarMesh(skinnedMesh);
        }
    }, [skinnedMesh, initAvatarMesh]);

    // Track stream fragments appending sequentially avoiding array cloning limits
    const prevPhonemesLengthRef = useRef(0);
    useEffect(() => {
        if (phonemes.length > prevPhonemesLengthRef.current) {
            const newFrames = phonemes.slice(prevPhonemesLengthRef.current);
            pushPhonemes(newFrames);
            prevPhonemesLengthRef.current = phonemes.length;
        } else if (phonemes.length === 0) {
            prevPhonemesLengthRef.current = 0;
            clearQueue();
        }
    }, [phonemes, pushPhonemes, clearQueue]);

    // Frame synchronization block operating efficiently spanning systems
    useFrame((_state, delta) => {
        updateSync(delta);
        if (idleSystemRef.current) {
            idleSystemRef.current.update(delta, isPlayingAudio);
        }
    });

    return (
        <group dispose={null}>
            <primitive object={scene} position={[0, -1.5, 0]} scale={1.2} />
        </group>
    );
};

// Setup cache prefetching proactively outside react bounds natively via Drei utility logic.
useGLTF.preload(MODEL_URL);
