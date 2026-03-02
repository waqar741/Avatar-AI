import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { FaceParams } from './types/face.types';

interface MouthProps {
    params: FaceParams;
}

/**
 * Procedural mouth using a deformable ellipse-based BufferGeometry.
 * Driven by mouthOpen, mouthWide, and mouthRound parameters.
 */
export const Mouth: React.FC<MouthProps> = ({ params }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    // Memoize materials
    const outerLipMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#8a4a5a',
        roughness: 0.5,
        side: THREE.DoubleSide,
    }), []);

    const innerMouthMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#2a1020',
        roughness: 0.8,
        side: THREE.DoubleSide,
    }), []);

    // Base geometry segments
    const segments = 24;

    // Create the lip shape as a custom buffer geometry
    const lipGeometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const indices: number[] = [];

        // Create a ring of vertices for the lip outline + center
        // Center vertex
        vertices.push(0, 0, 0);

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * 0.08;
            const y = Math.sin(angle) * 0.03;
            vertices.push(x, y, 0);
        }

        // Triangulate from center to ring
        for (let i = 1; i <= segments; i++) {
            indices.push(0, i, i + 1);
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }, []);

    // Update lip vertices each frame based on params
    useEffect(() => {
        if (!meshRef.current) return;
        const geo = meshRef.current.geometry;
        const positions = geo.attributes.position;

        // Apply deformation
        const baseWidth = 0.06 + params.mouthWide * 0.04;
        const baseHeight = 0.01 + params.mouthOpen * 0.05;
        const roundness = params.mouthRound;

        for (let i = 1; i <= segments + 1; i++) {
            const angle = ((i - 1) / segments) * Math.PI * 2;

            let rx = baseWidth;
            let ry = baseHeight;

            // Apply roundness — when round is high, make X and Y radii closer
            if (roundness > 0) {
                const avg = (rx + ry) / 2;
                rx = rx + (avg - rx) * roundness * 0.7;
                ry = ry + (avg - ry) * roundness * 0.7;
            }

            positions.setXYZ(i, Math.cos(angle) * rx, Math.sin(angle) * ry, 0);
        }

        positions.needsUpdate = true;
        geo.computeVertexNormals();
    }, [params.mouthOpen, params.mouthWide, params.mouthRound]);

    return (
        <group position={[0, -0.1, 0.3]}>
            {/* Outer lip ring */}
            <mesh ref={meshRef} geometry={lipGeometry} material={outerLipMat} />

            {/* Inner dark mouth cavity — scales with openness */}
            <mesh material={innerMouthMat}
                position={[0, 0, -0.005]}
                scale={[
                    0.7 + params.mouthWide * 0.3,
                    0.3 + params.mouthOpen * 0.7,
                    1
                ]}>
                <circleGeometry args={[0.04, 16]} />
            </mesh>
        </group>
    );
};
