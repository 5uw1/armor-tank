import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mat } from '../assets/kit';
import { photoMaterial } from '../assets/photo';
import { VEHICLES, applyArmorKit, type VehicleRig } from '../assets/vehicles';

/** Studio turntable used as the menu background and the Garage screen. */
export class Viewer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  readonly orbit: OrbitControls;
  private composer: EffectComposer;
  private rigs = new Map<string, VehicleRig>();
  private rig: VehicleRig | null = null;
  current = '';
  /** Offset the model to the right so menus on the left don't cover it. */
  shiftX = 0;

  constructor(private renderer: THREE.WebGLRenderer, env: THREE.Texture, canvas: HTMLCanvasElement) {
    const s = this.scene;
    s.background = new THREE.Color(0x1a1d21);
    s.fog = new THREE.Fog(0x1a1d21, 28, 70);
    s.environment = env;
    s.environmentIntensity = 0.8;
    s.add(new THREE.HemisphereLight(0xcfd8e0, 0x2a2622, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-10, 18, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    key.shadow.bias = -0.0003;
    s.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.6);
    rim.position.set(10, 6, -14);
    s.add(rim);
    const floorMat = photoMaterial('concrete_floor_02', { color: 0x6a6a68, roughness: 0.55, tileScale: 2 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), floorMat);
    const uv = floor.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 80, uv.getY(i) * 80);
    floor.receiveShadow = true;
    s.add(floor);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.8, 0.3, 64), mat('plinth', { color: 0x2c2f33, roughness: 0.4, metalness: 0.6 }));
    plinth.position.y = 0.15;
    plinth.receiveShadow = true;
    s.add(plinth);
    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.autoRotate = true;
    this.orbit.autoRotateSpeed = 1.1;
    this.orbit.maxPolarAngle = Math.PI * 0.48;
    this.orbit.enablePan = false;
    this.orbit.enabled = false;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(s, this.camera));
    this.composer.addPass(new OutputPass());
  }

  show(id: string) {
    if (this.rig) this.scene.remove(this.rig.root);
    let rig = this.rigs.get(id);
    if (!rig) {
      rig = VEHICLES.find((v) => v.id === id)!.build();
      rig.root.position.y = 0.3 + (rig.hover ? 1.5 : 0);
      this.rigs.set(id, rig);
    }
    this.rig = rig;
    this.current = id;
    this.scene.add(rig.root);
    const size = new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3()).length();
    this.orbit.target.set(0, 1.2 + (rig.hover ? 1.5 : 0), 0);
    this.camera.position.set(size * 0.95, size * 0.55, size * 1.05);
  }

  /** Show an armour kit on the player tank. */
  armor(kit: string) {
    if (this.current === 'striker' && this.rig) applyArmorKit(this.rig, kit);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setSize(innerWidth, innerHeight);
  }

  render(dt: number, t: number) {
    this.orbit.update(dt);
    if (this.rig) {
      for (const tr of this.rig.treads) tr.offset.y -= dt * 1.2;
      for (const w of this.rig.wheels) w.rotation.x += dt * 2;
      for (const r of this.rig.rotors) r.rotation.y += dt * 40;
      if (this.rig.turret) this.rig.turret.rotation.y = Math.sin(t * 0.5) * 0.6;
    }
    // Shift the view so the vehicle sits right of the menu panel
    this.camera.setViewOffset(innerWidth, innerHeight, -this.shiftX * innerWidth, 0, innerWidth, innerHeight);
    this.composer.render();
  }
}
