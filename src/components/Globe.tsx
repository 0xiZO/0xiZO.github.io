import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { writeups, type Writeup } from "@/data/writeups";

function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function EarthMesh({ onPick }: { onPick: (w: Writeup) => void }) {
  const earthRef = useRef<THREE.Mesh>(null!);
  const cloudsRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.07;
  });

  // Procedural Earth: shader-like gradient + glow. No external textures (offline-safe).
  const earthMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0a2540"),
        emissive: new THREE.Color("#0a1a3a"),
        emissiveIntensity: 0.3,
        roughness: 0.6,
        metalness: 0.2,
      }),
    []
  );

  return (
    <group>
      {/* Atmosphere glow */}
      <mesh scale={1.15}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color="#4ab8ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color="#60c0ff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Earth */}
      <mesh ref={earthRef} material={earthMat}>
        <sphereGeometry args={[1, 96, 96]} />
      </mesh>

      {/* Wireframe continents-ish overlay */}
      <mesh ref={cloudsRef} scale={1.002}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#ff9a3c"
          wireframe
          transparent
          opacity={0.18}
        />
      </mesh>

      {/* Pins */}
      {writeups.map((w) => {
        const pos = latLngToVec3(w.lat, w.lng, 1.02);
        const tip = latLngToVec3(w.lat, w.lng, 1.18);
        return (
          <group key={w.slug}>
            <line>
              <bufferGeometry
                attach="geometry"
                onUpdate={(g) => {
                  g.setFromPoints([pos, tip]);
                }}
              />
              <lineBasicMaterial attach="material" color="#ff9a3c" />
            </line>
            <mesh
              position={tip}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "default";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onPick(w);
              }}
            >
              <sphereGeometry args={[0.025, 16, 16]} />
              <meshBasicMaterial color="#ffb56b" />
            </mesh>
            <mesh position={tip} scale={2}>
              <sphereGeometry args={[0.025, 16, 16]} />
              <meshBasicMaterial color="#ff9a3c" transparent opacity={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Globe({ onPick }: { onPick: (w: Writeup) => void }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#fff5e0" />
      <directionalLight position={[-5, -2, -3]} intensity={0.4} color="#4ab8ff" />
      <Stars radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      <EarthMesh onPick={onPick} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.6}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </Canvas>
  );
}