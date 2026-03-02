import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { AvatarModel } from './AvatarModel';
import type { PhonemeFrame } from '../types/phoneme.types';

import type { ConversationState } from '../systems/ConversationStateMachine';

interface AvatarCanvasProps {
    phonemes: PhonemeFrame[];
    appState: ConversationState;
    getAudioTime: () => number;
}

const LoadingFallback: React.FC = () => (
    <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="gray" wireframe />
    </mesh>
);

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ phonemes, appState, getAudioTime }) => {
    return (
        <div className="w-full h-full relative overflow-hidden bg-black/20 rounded-xl border border-white/10 shadow-lg">
            <Canvas camera={{ position: [0, 0, 1.5], fov: 40 }} dpr={[1, 2]}>
                <ambientLight intensity={0.4} />
                <directionalLight position={[2, 2, 2]} intensity={1.5} color="#ffffff" shadow-bias={-0.0001} />
                <directionalLight position={[-2, 1, 1]} intensity={0.5} color="#abcdef" />

                <Suspense fallback={<LoadingFallback />}>
                    <AvatarModel
                        phonemes={phonemes}
                        appState={appState}
                        getAudioTime={getAudioTime}
                    />

                    {/* Realistic soft grounding without demanding physics/raytracing layers */}
                    <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={5} blur={2.5} far={4} />
                    <Environment preset="city" blur={0.8} />
                </Suspense>
            </Canvas>
        </div>
    );
};
