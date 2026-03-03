import { useMemo } from 'react';
import * as THREE from 'three';
import type { FaceParams } from './types/face.types';

interface EyebrowsProps {
    params: FaceParams;
}

/**
 * Procedural eyebrows using thin curved tube meshes.
 * Expression driven by browRaise rotation + browAsymmetry for per-brow offset.
 *
 * browAsymmetry > 0: right brow raised higher (concentration/curiosity)
 * browAsymmetry < 0: left brow raised higher
 */
export const Eyebrows: React.FC<EyebrowsProps> = ({ params }) => {
    const browMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#2a2a3a',
        roughness: 0.7,
    }), []);

    // Create a curved path for the brow shape
    const browCurve = useMemo(() => {
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.06, 0, 0),
            new THREE.Vector3(0, 0.015, 0.005),
            new THREE.Vector3(0.06, 0, 0)
        );
        return new THREE.TubeGeometry(curve, 8, 0.008, 6, false);
    }, []);

    // Base symmetric brow values
    const baseBrowRotation = params.browRaise * 0.15;
    const baseBrowY = 0.16 + params.browRaise * 0.02;

    // Asymmetry offsets: positive asymmetry → right brow higher
    const asymOffset = params.browAsymmetry * 0.012;     // Y position offset
    const asymRotation = params.browAsymmetry * 0.06;     // rotation offset

    // Left brow: lower when asymmetry is positive (right-dominant)
    const leftY = baseBrowY - asymOffset;
    const leftRotation = baseBrowRotation - asymRotation;

    // Right brow: higher when asymmetry is positive
    const rightY = baseBrowY + asymOffset;
    const rightRotation = -(baseBrowRotation + asymRotation);

    return (
        <group>
            {/* Left eyebrow */}
            <mesh
                geometry={browCurve}
                material={browMat}
                position={[-0.1, leftY, 0.28]}
                rotation={[0, 0, leftRotation]}
            />

            {/* Right eyebrow */}
            <mesh
                geometry={browCurve}
                material={browMat}
                position={[0.1, rightY, 0.28]}
                rotation={[0, 0, rightRotation]}
            />
        </group>
    );
};
