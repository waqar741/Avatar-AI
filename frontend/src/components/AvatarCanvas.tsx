import { Canvas } from '@react-three/fiber';
import { ProceduralFace } from './ProceduralFace/ProceduralFace';
import type { PhonemeFrame } from '../types/phoneme.types';
import type { ConversationState } from '../systems/ConversationStateMachine';

interface AvatarCanvasProps {
    phonemes: PhonemeFrame[];
    appState: ConversationState;
    getAudioTime: () => number;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ phonemes, appState, getAudioTime }) => {
    return (
        <div className="w-full h-full relative overflow-hidden bg-black/20 rounded-xl border border-white/10 shadow-lg">
            <Canvas camera={{ position: [0, 0, 1.5], fov: 40 }} dpr={[1, 1.5]}>
                <ProceduralFace
                    appState={appState}
                    phonemes={phonemes}
                    getAudioTime={getAudioTime}
                />
            </Canvas>
        </div>
    );
};
