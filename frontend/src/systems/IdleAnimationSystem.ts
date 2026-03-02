import * as THREE from 'three';

export class IdleAnimationSystem {
    private rootBone: THREE.Bone | null = null;
    private neckBone: THREE.Bone | null = null;

    private initialRootRot: THREE.Quaternion = new THREE.Quaternion();
    private initialNeckRot: THREE.Quaternion = new THREE.Quaternion();

    // Prevent time syncing across distinct session lifespans
    private clock: THREE.Clock = new THREE.Clock();

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

    public update(delta: number, isSpeaking: boolean) {
        if (isSpeaking) {
            // Dampen movement slowly down to lock stance when tracking dialogue explicitly
            this.dampenToNeutral(delta * 2.0);
            return;
        }

        if (!this.rootBone && !this.neckBone) return;

        const time = this.clock.getElapsedTime();

        // Very subdued sine wave breathing mechanics
        const breathWeight = Math.sin(time * 1.5) * 0.01;
        // Subtle drift wandering neck gaze
        const lookWeightX = Math.sin(time * 0.5) * 0.02;
        const lookWeightY = Math.cos(time * 0.7) * 0.02;

        if (this.rootBone) {
            const rotDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathWeight, 0, 0));
            this.rootBone.quaternion.copy(this.initialRootRot).multiply(rotDelta);
        }

        if (this.neckBone) {
            const rotDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathWeight + lookWeightX, lookWeightY, 0));
            this.neckBone.quaternion.copy(this.initialNeckRot).multiply(rotDelta);
        }
    }

    private dampenToNeutral(factor: number) {
        if (this.rootBone) {
            this.rootBone.quaternion.slerp(this.initialRootRot, factor);
        }
        if (this.neckBone) {
            this.neckBone.quaternion.slerp(this.initialNeckRot, factor);
        }
    }

    public dispose() {
        this.rootBone = null;
        this.neckBone = null;
        this.clock.stop();
    }
}
