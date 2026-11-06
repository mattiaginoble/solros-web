"use client";
/**
 * Modelli 3D degli arredi. Se il prodotto ha un modello glTF viene caricato e
 * scalato alle misure del prodotto; altrimenti si genera un modello
 * parametrico (composizione di parallelepipedi e cilindri) in base alla forma.
 * Coordinate locali in metri: origine al centro della base, larghezza lungo x,
 * profondità lungo z (retro verso -z), altezza lungo y.
 */
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { mix } from "@/components/items/symbols";
import type { Product } from "@/domain/schema";

const M = 0.01;

function Box({ size, pos, color, opacity }: { size: [number, number, number]; pos: [number, number, number]; color: string; opacity?: number }) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} metalness={0.02} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

function Cyl({ r, h, pos, color, rTop }: { r: number; h: number; pos: [number, number, number]; color: string; rTop?: number }) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, 24]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function Legs({ w, d, h, inset, color, r = 0.02 }: { w: number; d: number; h: number; inset: number; color: string; r?: number }) {
  const xs = [-w / 2 + inset, w / 2 - inset];
  const zs = [-d / 2 + inset, d / 2 - inset];
  return (
    <>
      {xs.flatMap((x) => zs.map((z) => <Cyl key={`${x}-${z}`} r={r} h={h} pos={[x, h / 2, z]} color={color} />))}
    </>
  );
}

export function ParametricModel({ product }: { product: Product }) {
  const w = product.width * M;
  const d = product.depth * M;
  const h = product.height * M;
  const base = product.colorHex ?? "#cfcac2";
  const dark = mix(base, "#1e1e1e", 0.3);
  const light = mix(base, "#ffffff", 0.45);

  switch (product.shape) {
    case "sofa":
    case "armchair": {
      const seatH = Math.min(0.45, h * 0.5);
      const back = Math.min(0.22, d * 0.25);
      const arm = Math.min(0.18, w * 0.12);
      return (
        <group>
          <Box size={[w, seatH, d]} pos={[0, seatH / 2, 0]} color={base} />
          <Box size={[w, h, back]} pos={[0, h / 2, -d / 2 + back / 2]} color={dark} />
          <Box size={[arm, h * 0.72, d]} pos={[-w / 2 + arm / 2, (h * 0.72) / 2, 0]} color={dark} />
          <Box size={[arm, h * 0.72, d]} pos={[w / 2 - arm / 2, (h * 0.72) / 2, 0]} color={dark} />
          <Box size={[w - arm * 2 - 0.02, 0.12, d - back - 0.04]} pos={[0, seatH + 0.06, back / 2]} color={light} />
        </group>
      );
    }
    case "bed": {
      const frameH = Math.min(0.32, h * 0.35);
      const mattress = 0.2;
      return (
        <group>
          <Box size={[w, frameH, d]} pos={[0, frameH / 2, 0]} color={base} />
          <Box size={[w - 0.06, mattress, d - 0.1]} pos={[0, frameH + mattress / 2, 0.03]} color="#f4f2ee" />
          <Box size={[w, h, 0.08]} pos={[0, h / 2, -d / 2 + 0.04]} color={dark} />
          <Box size={[w - 0.08, 0.05, d * 0.58]} pos={[0, frameH + mattress + 0.025, d * 0.18]} color={light} />
          {(w > 1.2 ? [-w / 4, w / 4] : [0]).map((x) => (
            <Box key={x} size={[Math.min(0.6, w / 2 - 0.1), 0.12, 0.32]} pos={[x, frameH + mattress + 0.06, -d / 2 + 0.28]} color="#ffffff" />
          ))}
        </group>
      );
    }
    case "table":
    case "desk": {
      const top = 0.04;
      if (product.meta?.round) {
        return (
          <group>
            <mesh position={[0, h - top / 2, 0]} castShadow receiveShadow scale={[1, 1, d / w]}>
              <cylinderGeometry args={[w / 2, w / 2, top, 40]} />
              <meshStandardMaterial color={base} roughness={0.5} />
            </mesh>
            <Cyl r={0.05} h={h - top} pos={[0, (h - top) / 2, 0]} color={dark} />
            <Cyl r={Math.min(w, d) * 0.25} h={0.03} pos={[0, 0.015, 0]} color={dark} />
          </group>
        );
      }
      return (
        <group>
          <Box size={[w, top, d]} pos={[0, h - top / 2, 0]} color={base} />
          <Legs w={w} d={d} h={h - top} inset={0.05} color={dark} />
        </group>
      );
    }
    case "chair": {
      const seat = Math.min(0.46, h * 0.55);
      return (
        <group>
          <Box size={[w, 0.05, d * 0.9]} pos={[0, seat, d * 0.05]} color={base} />
          <Box size={[w, h - seat, 0.04]} pos={[0, seat + (h - seat) / 2, -d / 2 + 0.03]} color={base} />
          <Legs w={w} d={d} h={seat} inset={0.04} color={dark} r={0.015} />
        </group>
      );
    }
    case "wardrobe":
    case "cabinet":
    case "tv-unit":
    case "nightstand": {
      const doors = Math.max(1, Math.round(w / (product.shape === "wardrobe" ? 0.5 : 0.6)));
      return (
        <group>
          <Box size={[w, h, d]} pos={[0, h / 2, 0]} color={base} />
          {Array.from({ length: doors - 1 }, (_, i) => (
            <Box key={i} size={[0.005, h - 0.02, 0.004]} pos={[-w / 2 + (w / doors) * (i + 1), h / 2, d / 2 + 0.002]} color={dark} />
          ))}
          {Array.from({ length: doors }, (_, i) => (
            <Box
              key={`h${i}`}
              size={[0.012, Math.min(0.25, h * 0.25), 0.02]}
              pos={[-w / 2 + (w / doors) * (i + (i % 2 ? 0.12 : 0.88)), h * (product.shape === "wardrobe" ? 0.5 : 0.75), d / 2 + 0.012]}
              color="#8d8f92"
            />
          ))}
        </group>
      );
    }
    case "shelf": {
      const n = Math.max(2, Math.round(h / 0.38));
      return (
        <group>
          <Box size={[0.02, h, d]} pos={[-w / 2 + 0.01, h / 2, 0]} color={base} />
          <Box size={[0.02, h, d]} pos={[w / 2 - 0.01, h / 2, 0]} color={base} />
          <Box size={[w, h, 0.01]} pos={[0, h / 2, -d / 2 + 0.005]} color={dark} />
          {Array.from({ length: n + 1 }, (_, i) => (
            <Box key={i} size={[w - 0.04, 0.02, d]} pos={[0, (h / n) * i + 0.01, 0]} color={base} />
          ))}
        </group>
      );
    }
    case "fridge":
    case "appliance":
    case "oven":
    case "dishwasher":
      return (
        <group>
          <Box size={[w, h, d]} pos={[0, h / 2, 0]} color={base} />
          <Box size={[w * 0.8, 0.015, 0.02]} pos={[0, h * 0.82, d / 2 + 0.01]} color="#6f7377" />
          {product.shape === "oven" && <Box size={[w * 0.75, h * 0.45, 0.005]} pos={[0, h * 0.45, d / 2 + 0.003]} color="#1c1d1f" />}
        </group>
      );
    case "washer":
      return (
        <group>
          <Box size={[w, h, d]} pos={[0, h / 2, 0]} color={base} />
          <mesh position={[0, h * 0.45, d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w * 0.3, w * 0.3, 0.02, 32]} />
            <meshStandardMaterial color="#9aa6b0" roughness={0.2} metalness={0.4} />
          </mesh>
        </group>
      );
    case "cooktop":
      return <Box size={[w, Math.max(h, 0.01), d]} pos={[0, Math.max(h, 0.01) / 2, 0]} color="#16171a" />;
    case "hood":
      return (
        <group>
          <Box size={[w, Math.min(0.12, h), d]} pos={[0, Math.min(0.12, h) / 2, 0]} color={base} />
          {h > 0.2 && <Box size={[w * 0.3, h - 0.12, d * 0.45]} pos={[0, 0.12 + (h - 0.12) / 2, -d * 0.2]} color={base} />}
        </group>
      );
    case "sink":
    case "washbasin": {
      const isCabinet = h > 0.3;
      return (
        <group>
          {isCabinet && <Box size={[w, h - 0.04, d]} pos={[0, (h - 0.04) / 2, 0]} color={base} />}
          <Box size={[w, 0.04, d]} pos={[0, h - 0.02, 0]} color={isCabinet ? "#f5f5f3" : base} />
          <Box size={[w * 0.55, 0.012, d * 0.6]} pos={[0, h + 0.001, 0.02]} color="#d7dde2" />
          <Cyl r={0.012} h={0.2} pos={[0, h + 0.1, -d / 2 + 0.06]} color="#a9adb1" />
        </group>
      );
    }
    case "toilet":
    case "bidet":
      return (
        <group>
          <mesh position={[0, h * 0.5, d * 0.08]} scale={[w / 2, h * 0.5, d * 0.42]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#fbfbfb" roughness={0.25} />
          </mesh>
          {product.shape === "toilet" && <Box size={[w * 0.9, 0.08, d * 0.3]} pos={[0, h + 0.15, -d / 2 + d * 0.15]} color="#fbfbfb" />}
        </group>
      );
    case "shower":
      return (
        <group>
          <Box size={[w, 0.05, d]} pos={[0, 0.025, 0]} color="#f3f3f1" />
          {h > 0.5 && (
            <>
              <Box size={[w, h, 0.01]} pos={[0, h / 2, d / 2 - 0.005]} color="#cfe3ea" opacity={0.35} />
              <Box size={[0.01, h, d]} pos={[w / 2 - 0.005, h / 2, 0]} color="#cfe3ea" opacity={0.35} />
            </>
          )}
        </group>
      );
    case "bathtub":
      return (
        <group>
          <Box size={[w, h, d]} pos={[0, h / 2, 0]} color={base} />
          <Box size={[w - 0.12, 0.01, d - 0.12]} pos={[0, h + 0.002, 0]} color="#dbe5ea" />
        </group>
      );
    case "mirror":
      return (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, Math.max(d, 0.01)]} />
          <meshStandardMaterial color="#cfdde4" metalness={0.8} roughness={0.08} />
        </mesh>
      );
    case "lamp-floor":
      return (
        <group>
          <Cyl r={Math.min(w, d) * 0.4} h={0.02} pos={[0, 0.01, 0]} color={dark} />
          <Cyl r={0.012} h={h * 0.85} pos={[0, h * 0.425, 0]} color={base} />
          <mesh position={[0, h * 0.88, 0]}>
            <cylinderGeometry args={[w * 0.25, w * 0.4, h * 0.2, 24, 1, true]} />
            <meshStandardMaterial color="#f6f1e4" emissive="#ffe9b3" emissiveIntensity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    case "lamp-ceiling":
    case "lamp-wall":
      return (
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[w / 2, w / 2.4, h, 24]} />
          <meshStandardMaterial color={base} emissive="#ffe9b3" emissiveIntensity={0.45} />
        </mesh>
      );
    case "rug":
      return <Box size={[w, 0.008, d]} pos={[0, 0.004, 0]} color={base} />;
    case "plant":
      return (
        <group>
          <Cyl r={Math.min(w, d) * 0.3} rTop={Math.min(w, d) * 0.36} h={h * 0.3} pos={[0, h * 0.15, 0]} color="#c8b8a4" />
          <mesh position={[0, h * 0.62, 0]} scale={[w * 0.5, h * 0.4, d * 0.5]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={base} roughness={0.9} />
          </mesh>
        </group>
      );
    case "stairs": {
      if (product.meta?.stairs === "spiral") {
        const steps = 14;
        return (
          <group>
            <Cyl r={0.04} h={h} pos={[0, h / 2, 0]} color={dark} />
            {Array.from({ length: steps }, (_, i) => (
              <group key={i} rotation={[0, (i / steps) * Math.PI * 1.7, 0]} position={[0, (h / steps) * (i + 1) - 0.02, 0]}>
                <Box size={[w / 2, 0.04, 0.28]} pos={[w / 4, 0, 0]} color={base} />
              </group>
            ))}
          </group>
        );
      }
      const steps = Math.max(8, Math.round(h / 0.18));
      const run = d / steps;
      return (
        <group>
          {Array.from({ length: steps }, (_, i) => (
            <Box key={i} size={[w, 0.04, run + 0.02]} pos={[0, (h / steps) * (i + 1) - 0.02, d / 2 - run * (i + 0.5)]} color={base} />
          ))}
          <Box size={[0.04, h, d]} pos={[-w / 2 + 0.02, h / 2, 0]} color={dark} opacity={0.6} />
        </group>
      );
    }
    case "worktop":
      return <Box size={[w, h, d]} pos={[0, h / 2, 0]} color={base} />;
    default:
      return <Box size={[w, h, d]} pos={[0, h / 2, 0]} color={base} />;
  }
}

function GltfModel({ product }: { product: Product }) {
  const { scene } = useGLTF(product.modelUrl!);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const sx = (product.width * M) / (size.x || 1);
    const sy = (product.height * M) / (size.y || 1);
    const sz = (product.depth * M) / (size.z || 1);
    clone.scale.set(sx, sy, sz);
    clone.position.set(-center.x * sx, -box.min.y * sy, -center.z * sz);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, product.width, product.height, product.depth]);
  return <primitive object={object} />;
}

/** Ripiega sul modello parametrico se il glTF non si carica. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ItemModel({ product }: { product: Product }) {
  const fallback = <ParametricModel product={product} />;
  if (!product.modelUrl) return fallback;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel product={product} />
      </Suspense>
    </ModelBoundary>
  );
}
