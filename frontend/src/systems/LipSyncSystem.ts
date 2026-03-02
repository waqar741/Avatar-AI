import * as THREE from 'three';
import type { PhonemeFrame } from '../types/phoneme.types';

// Ovrus Mapping: Rhubarb cues (A-H, X) -> Common Model Visemes
// This aims strictly at universally styled humanoid formats
const VisemeMap: Record<string, string> = {
    'A': 'viseme_PP',  // Closed mouth (P, B, M)
    'B': 'viseme_kk',  // Slightly open (K, S, T)
    'C': 'viseme_I',   // Open mouth (EH, AE)
    'D': 'viseme_AA',  // Wide open (A)
    'E': 'viseme_O',   // Rounded (AO, ER)
    'F': 'viseme_U',   // Puckered (UW, OW, W)
    'G': 'viseme_FF',  // Lower lip tucked (F, V)
    'H': 'viseme_TH',  // Tongue between teeth (TH)
    'X': 'viseme_sil', // Idle / Silence
};

export class LipSyncSystem {
    private skinnedMesh: THREE.SkinnedMesh | null = null;
    private jawBone: THREE.Bone | null = null;
    private hasMorphTargets: boolean = false;
    private neutralRotation: THREE.Quaternion = new THREE.Quaternion();

    public initialize(mesh: THREE.SkinnedMesh, jawBoneName?: string) {
        this.skinnedMesh = mesh;

        // Detection
        if (mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0) {
            this.hasMorphTargets = true;
        }

        // Fallback search strictly bound by naming conventions generally applied to humanoid GLBs
        if (!this.hasMorphTargets || jawBoneName) {
            mesh.skeleton.bones.forEach((bone: THREE.Bone) => {
                if (bone.name.toLowerCase().includes(jawBoneName || 'jaw')) {
                    this.jawBone = bone;
                    this.neutralRotation.copy(bone.quaternion);
                }
            });
        }
    }

    public applyPhoneme(frame: PhonemeFrame, transitionFactor: number = 0.5) {
        if (!this.skinnedMesh) return;

        // Reset state progressively prior to applying the new phoneme dominance
        this.resetToNeutral(transitionFactor);

        const targetShape = VisemeMap[frame.value] || 'viseme_sil';

        if (this.hasMorphTargets && this.skinnedMesh.morphTargetDictionary) {
            const index = this.skinnedMesh.morphTargetDictionary[targetShape];
            if (index !== undefined && this.skinnedMesh.morphTargetInfluences) {
                // Lerping the influence maintains visual smoothness 
                this.skinnedMesh.morphTargetInfluences[index] +=
                    (1.0 - this.skinnedMesh.morphTargetInfluences[index]) * transitionFactor;
            }
        }

        // Bone Rotational Fallback natively handling generic rigged heads without shapes
        if (this.jawBone) {
            const intensityMap: Record<string, number> = {
                'A': 0.0, 'B': 0.1, 'C': 0.3, 'D': 0.6, 'E': 0.2, 'F': 0.15, 'G': 0.05, 'H': 0.1, 'X': 0.0
            };

            const dropIntensity = intensityMap[frame.value] || 0.0;
            // Native pitch manipulation downward 
            const targetQuat = this.neutralRotation.clone().multiply(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dropIntensity)
            );

            this.jawBone.quaternion.slerp(targetQuat, transitionFactor);
        }
    }

    public resetToNeutral(transitionFactor: number = 0.2) {
        if (!this.skinnedMesh) return;

        if (this.hasMorphTargets && this.skinnedMesh.morphTargetInfluences) {
            for (let i = 0; i < this.skinnedMesh.morphTargetInfluences.length; i++) {
                this.skinnedMesh.morphTargetInfluences[i] += (0.0 - this.skinnedMesh.morphTargetInfluences[i]) * transitionFactor;
            }
        }

        if (this.jawBone) {
            this.jawBone.quaternion.slerp(this.neutralRotation, transitionFactor);
        }
    }

    public dispose() {
        this.skinnedMesh = null;
        this.jawBone = null;
    }
}
