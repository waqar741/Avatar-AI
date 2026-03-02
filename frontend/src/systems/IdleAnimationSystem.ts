import * as THREE from 'three';
import type { ConversationState } from './ConversationStateMachine';

export class IdleAnimationSystem {
    private rootBone: THREE.Bone | null = null;
    private neckBone: THREE.Bone | null = null;

    private initialRootRot: THREE.Quaternion = new THREE.Quaternion();
    private initialNeckRot: THREE.Quaternion = new THREE.Quaternion();

    // Prevent time syncing across distinct session lifespans
    private clock: THREE.Clock = new THREE.Clock();

    // Lerped animation scale weights
    private currentIdleWeight: number = 0;
    private targetIdleWeight: number = 0;
    private targetThinkingRot: THREE.Quaternion = new THREE.Quaternion();

    public initialize(mesh: THREE.SkinnedMesh | THREE.Object3D) {
        // Fallback procedural targeting typically found in humanoid exports
        mesh.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Bone) {
                const name = child.name.toLowerCase();
                if (name.includes('spine') || name.includes('root') || name.includes('hip')) {
                    if (!this.rootBone) { // Grab lowest anchor
                        this.rootBone = child;
                        this.initialRootRot.copy(child.quaternion);
                    }
                }
                if (name.includes('neck') || name.includes('head')) {
                    if (!this.neckBone) {
                        this.neckBone = child;
                        this.initialNeckRot.copy(child.quaternion);
                    }
                }
            }
        });

        this.clock.start();
    }

    public update(delta: number, currentState: ConversationState) {
        if (!this.rootBone && !this.neckBone) return;

        // Weights: 1.0 (Full Idle Breathing), 0.0 (Rigid/Driven by lip-sync/thought)
        if (currentState === 'IDLE' || currentState === 'CONNECTING' || currentState === 'DISCONNECTED') {
            this.targetIdleWeight = 1.0;
        } else if (currentState === 'LISTENING') {
            this.targetIdleWeight = 0.5; // Mild tension
        } else if (currentState === 'THINKING') {
            this.targetIdleWeight = 0.2; // Rigid, processing
        } else if (currentState === 'SPEAKING') {
            this.targetIdleWeight = 0.1; // Mostly rigid, minimal generic sway
        }

        // Lerp weight gracefully avoiding snapping
        this.currentIdleWeight = THREE.MathUtils.lerp(this.currentIdleWeight, this.targetIdleWeight, delta * 5.0);

        const time = this.clock.getElapsedTime();

        // 1) Breathing Sway (Scaled by IdleWeight)
        const breathX = Math.sin(time * 1.5) * 0.01 * this.currentIdleWeight;
        const breathY = 0; // Static root Y
        const lookX = Math.sin(time * 0.5) * 0.02 * this.currentIdleWeight;
        const lookY = Math.cos(time * 0.7) * 0.02 * this.currentIdleWeight;

        // 2) Thinking Tilt (Only active when in THINKING state)
        if (currentState === 'THINKING') {
            // Slight tilt and upward look resolving instantly (no elapsed oscillation)
            const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0.08, -0.02));
            this.targetThinkingRot.slerp(target, delta * 3.0);
        } else {
            // Slerp back to neutral 
            this.targetThinkingRot.slerp(new THREE.Quaternion(), delta * 3.0);
        }

        // Apply Layered Rotations
        if (this.rootBone) {
            const idleRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathX, breathY, 0));
            this.rootBone.quaternion.copy(this.initialRootRot).multiply(idleRot);
        }

        if (this.neckBone) {
            const idleRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathX + lookX, lookY, 0));
            // Stack the Thinking manipulation over the idle sway
            this.neckBone.quaternion.copy(this.initialNeckRot).multiply(idleRot).multiply(this.targetThinkingRot);
        }
    }

    public dispose() {
        this.rootBone = null;
        this.neckBone = null;
        this.clock.stop();
    }
}
