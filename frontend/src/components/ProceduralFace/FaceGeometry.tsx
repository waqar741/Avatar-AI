import { useMemo } from 'react';
import * as THREE from 'three';
import { Eyes } from './Eyes';
import { Mouth } from './Mouth';
import { Eyebrows } from './Eyebrows';
import type { FaceParams } from './types/face.types';

interface FaceGeometryProps {
    params: FaceParams;
}

/**
 * Assembles the full procedural AI head from primitives:
 * - Slightly flattened sphere for the cranium
 * - Jaw contour geometry
 * - Subtle nose structure
 * - Cheek definition planes
 * - Ear stubs for silhouette
 * - Eyes, Mouth, Eyebrows sub-components
 * - Ambient glow halo for AI aesthetic
 * All geometry is memoized. Materials are reused.
 */
export const FaceGeometry: React.FC<FaceGeometryProps> = ({ params }) => {
    // === Materials (memoized, never recreated) ===
    const headMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#3a3a4f',
        roughness: 0.55,
        metalness: 0.1,
        emissive: '#0a0a1a',
        emissiveIntensity: 0.15,
    }), []);

    const accentMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#2e2e42',
        roughness: 0.6,
        metalness: 0.05,
    }), []);

    const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: '#1a2a4a',
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
    }), []);

    // === Geometries (memoized, never recreated) ===

    // Main cranium — slightly flattened sphere
    const craniumGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.35, 32, 24);
        geo.scale(1, 1.08, 0.88);
        return geo;
    }, []);

    // Jaw contour — half-sphere scaled and positioned below
    const jawGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
        geo.scale(0.85, 0.6, 0.75);
        return geo;
    }, []);

    // Nose bridge — elongated small sphere
    const noseBridgeGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.022, 10, 8);
        geo.scale(0.8, 1.6, 1);
        return geo;
    }, []);

    // Nose tip — small sphere
    const noseTipGeo = useMemo(() => new THREE.SphereGeometry(0.025, 10, 8), []);

    // Cheek planes — flattened spheres
    const cheekGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.06, 10, 8);
        geo.scale(1, 0.7, 0.5);
        return geo;
    }, []);

    // Ear stubs — flattened spheres on the sides
    const earGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.04, 8, 6);
        geo.scale(0.4, 1, 0.8);
        return geo;
    }, []);

    // Chin — small sphere for definition
    const chinGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.035, 10, 8);
        geo.scale(1.2, 0.7, 0.8);
        return geo;
    }, []);

    // Temple indentations — subtle geometry
    const templeGeo = useMemo(() => {
        const geo = new THREE.SphereGeometry(0.05, 10, 8);
        geo.scale(0.3, 1, 0.6);
        return geo;
    }, []);

    // Glow ring behind head
    const glowRingGeo = useMemo(() => new THREE.RingGeometry(0.38, 0.48, 48), []);

    // Breathing scale
    const breathScale = 1 + params.idleBreath * 0.008;

    return (
        <group
            rotation={[params.headTiltX, 0, params.headTiltZ]}
            scale={[breathScale, breathScale, breathScale]}
        >
            {/* Main cranium */}
            <mesh geometry={craniumGeo} material={headMat} />

            {/* Jaw contour */}
            <mesh geometry={jawGeo} material={headMat} position={[0, -0.22, 0.03]} />

            {/* Nose bridge */}
            <mesh geometry={noseBridgeGeo} material={accentMat} position={[0, 0.02, 0.3]} />

            {/* Nose tip */}
            <mesh geometry={noseTipGeo} material={accentMat} position={[0, -0.03, 0.32]} />

            {/* Left cheek */}
            <mesh geometry={cheekGeo} material={headMat} position={[-0.14, -0.04, 0.24]} />

            {/* Right cheek */}
            <mesh geometry={cheekGeo} material={headMat} position={[0.14, -0.04, 0.24]} />

            {/* Left ear */}
            <mesh geometry={earGeo} material={accentMat} position={[-0.33, 0.02, 0]} />

            {/* Right ear */}
            <mesh geometry={earGeo} material={accentMat} position={[0.33, 0.02, 0]} />

            {/* Chin definition */}
            <mesh geometry={chinGeo} material={accentMat} position={[0, -0.28, 0.18]} />

            {/* Left temple */}
            <mesh geometry={templeGeo} material={headMat} position={[-0.28, 0.1, 0.1]} />

            {/* Right temple */}
            <mesh geometry={templeGeo} material={headMat} position={[0.28, 0.1, 0.1]} />

            {/* Feature sub-components */}
            <Eyes params={params} />
            <Mouth params={params} />
            <Eyebrows params={params} />

            {/* AI identity glow halo behind head */}
            <mesh geometry={glowRingGeo} material={glowMat} position={[0, 0, -0.2]} />

            {/* Secondary inner glow ring */}
            <mesh position={[0, 0, -0.12]}>
                <ringGeometry args={[0.34, 0.37, 32]} />
                <meshBasicMaterial color="#2a3a5a" transparent opacity={0.08} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};
