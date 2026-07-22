import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function AuthBackground() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.z = 6;

    const shapeGroup = new THREE.Group();
    scene.add(shapeGroup);

    const orbSettings = [
      {
        color: 0x8b5cf6,
        position: [-3.2, 1.8, -1],
        scale: 1.2,
      },
      {
        color: 0x22d3ee,
        position: [3.4, -1.7, -1.5],
        scale: 1.55,
      },
      {
        color: 0x6366f1,
        position: [2.8, 2.4, -2],
        scale: 0.72,
      },
    ] as const;
    const orbs = orbSettings.map((settings, index) => {
      const geometry = new THREE.IcosahedronGeometry(1, index === 1 ? 2 : 1);
      const material = new THREE.MeshBasicMaterial({
        color: settings.color,
        transparent: true,
        opacity: index === 1 ? 0.18 : 0.24,
        wireframe: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        settings.position[0],
        settings.position[1],
        settings.position[2],
      );
      mesh.scale.setScalar(settings.scale);
      shapeGroup.add(mesh);
      return mesh;
    });

    const particleCount = 180;
    const particlePositions = new Float32Array(particleCount * 3);
    let seed = 4_821;
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return (seed - 1) / 2_147_483_646;
    };
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (random() - 0.5) * 13;
      particlePositions[index * 3 + 1] = (random() - 0.5) * 9;
      particlePositions[index * 3 + 2] = (random() - 0.5) * 5 - 1;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xd8b4fe,
      size: 0.035,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const pointerTarget = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      pointerTarget.set(
        (event.clientX / window.innerWidth - 0.5) * 0.42,
        (event.clientY / window.innerHeight - 0.5) * -0.3,
      );
    };
    window.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", resize);
    resize();

    const clock = new THREE.Clock();
    let animationFrame = 0;
    const render = () => {
      const elapsed = clock.getElapsedTime();
      pointerCurrent.lerp(pointerTarget, 0.035);
      camera.position.x = pointerCurrent.x;
      camera.position.y = pointerCurrent.y;
      shapeGroup.rotation.y = elapsed * 0.045 + pointerCurrent.x * 0.45;
      shapeGroup.rotation.x = pointerCurrent.y * 0.3;
      particles.rotation.y = elapsed * 0.012;
      particles.rotation.z = elapsed * 0.006;
      orbs.forEach((orb, index) => {
        orb.rotation.x = elapsed * (0.08 + index * 0.018);
        orb.rotation.y = elapsed * (0.11 + index * 0.014);
        orb.position.y =
          orbSettings[index].position[1] +
          Math.sin(elapsed * 0.45 + index * 1.7) * 0.16;
      });
      renderer.render(scene, camera);
      if (!prefersReducedMotion)
        animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      orbs.forEach((orb) => {
        orb.geometry.dispose();
        (orb.material as THREE.Material).dispose();
      });
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      if (host.contains(renderer.domElement))
        host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="auth-three-background" aria-hidden />;
}
