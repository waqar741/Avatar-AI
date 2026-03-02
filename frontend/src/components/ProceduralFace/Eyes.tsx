import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { FaceParams } from './types/face.types';

interface EyesProps {
    params: FaceParams;
}

/** Procedural eyes: two spheres with pupil sub-meshes and blink via eyelid scale. */
export const Eyes: React.FC<EyesProps> = ({ params }) => {
    const leftEyeRef = useRef<THREE.Group>(null);
    const rightEyeRef = useRef<THREE.Group>(null);
    const leftLidRef = useRef<THREE.Mesh>(null);
    const rightLidRef = useRef<THREE.Mesh>(null);

    // Memoize materials to prevent per-frame allocation
    const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.3 }), []);
    const pupilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.2, metalness: 0.1 }), []);
    const irisMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a9eff', roughness: 0.3, emissive: '#1a3a6e', emissiveIntensity: 0.3 }), []);
    const lidMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2a3a', roughness: 0.6 }), []);

    // Memoize geometries
    const eyeGeo = useMemo(() => new THREE.SphereGeometry(0.065, 16, 12), []);
    const irisGeo = useMemo(() => new THREE.SphereGeometry(0.035, 12, 10), []);
    const pupilGeo = useMemo(() => new THREE.SphereGeometry(0.018, 10, 8), []);
    const lidGeo = useMemo(() => new THREE.SphereGeometry(0.072, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), []);

    // Blink: scale eyelid Y from 0 (open) to 1 (closed)
    const lidScaleY = 0.1 + params.blink * 0.9;

    // Eye gaze offset
    const gazeX = params.eyeFocusX * 0.01;
    const gazeY = params.eyeFocusY * 0.01;

    return (
        <group>
            {/* Left Eye */}
            <group ref={leftEyeRef} position={[-0.1, 0.08, 0.28]}>
                <mesh geometry={eyeGeo} material={eyeWhiteMat} />
                <mesh geometry={irisGeo} material={irisMat} position={[gazeX, gazeY, 0.04]} />
                <mesh geometry={pupilGeo} material={pupilMat} position={[gazeX, gazeY, 0.055]} />
                {/* Eyelid */}
                <mesh ref={leftLidRef} geometry={lidGeo} material={lidMat}
                    position={[0, 0.02, 0]} scale={[1, lidScaleY, 1]}
                    rotation={[0, 0, 0]} />
            </group>

            {/* Right Eye */}
            <group ref={rightEyeRef} position={[0.1, 0.08, 0.28]}>
                <mesh geometry={eyeGeo} material={eyeWhiteMat} />
                <mesh geometry={irisGeo} material={irisMat} position={[gazeX, gazeY, 0.04]} />
                <mesh geometry={pupilGeo} material={pupilMat} position={[gazeX, gazeY, 0.055]} />
                {/* Eyelid */}
                <mesh ref={rightLidRef} geometry={lidGeo} material={lidMat}
                    position={[0, 0.02, 0]} scale={[1, lidScaleY, 1]}
                    rotation={[0, 0, 0]} />
            </group>
        </group>
    );
};
