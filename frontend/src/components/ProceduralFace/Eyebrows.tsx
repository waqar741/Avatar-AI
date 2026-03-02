import { useMemo } from 'react';
import * as THREE from 'three';
import type { FaceParams } from './types/face.types';

interface EyebrowsProps {
    params: FaceParams;
}

/**
 * Procedural eyebrows using thin curved tube meshes.
 * Expression driven by browRaise rotation.
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

    // Brow rotation: positive browRaise = raised, negative = furrowed
    const browRotation = params.browRaise * 0.15;
    const browY = 0.16 + params.browRaise * 0.02;

    return (
        <group>
            {/* Left eyebrow */}
            <mesh
                geometry={browCurve}
                material={browMat}
                position={[-0.1, browY, 0.28]}
                rotation={[0, 0, browRotation]}
            />

            {/* Right eyebrow (mirrored rotation) */}
            <mesh
                geometry={browCurve}
                material={browMat}
                position={[0.1, browY, 0.28]}
                rotation={[0, 0, -browRotation]}
            />
        </group>
    );
};
