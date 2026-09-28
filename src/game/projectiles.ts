import * as THREE from 'three';
import type { ProjectileKind, Team, WeaponDef } from './data';

export interface Projectile {
  kind: ProjectileKind;
  team: Team;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  weapon: WeaponDef;
  travelled: number;
  alive: boolean;
  /** Rockets: ballistic arc from start to target. */
  start?: THREE.Vector3;
  target?: THREE.Vector3;
  t?: number;
  T?: number;
  apex?: number;
  /** Ammo multiplier from the shooter (upgrades later). */
  mult: number;
  /** Id of the shooter to avoid self-hits. */
  owner: number;
  /** Guided missiles: target to home on, and flight time. */
  seek?: { pos: THREE.Vector3; alive: boolean };
  life?: number;
  /** Remembered aim point when the target dies mid-flight. */
  aimPoint?: THREE.Vector3;
  /** Railgun rounds: vehicles already hit (they pass through). */
  pierced?: Set<number>;
}

const LIMITS: Record<ProjectileKind, number> = { shell: 96, bullet: 400, rocket: 64, missile: 32 };

export class Projectiles {
  readonly root = new THREE.Group();
  readonly list: Projectile[] = [];
  private meshes: Record<ProjectileKind, THREE.InstancedMesh>;
  /** Enemy shells/bullets use a hotter colour so they read as incoming fire. */
  private enemyMeshes: Partial<Record<ProjectileKind, THREE.InstancedMesh>>;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 0, 1);

  constructor() {
    const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const shell = new THREE.CapsuleGeometry(0.09, 1.6, 2, 6).rotateX(Math.PI / 2);
    const bullet = new THREE.BoxGeometry(0.05, 0.05, 1.4);
    const rocket = new THREE.CylinderGeometry(0.1, 0.12, 1.3, 8).rotateX(Math.PI / 2);
    this.meshes = {
      shell: new THREE.InstancedMesh(shell, glow(0xffd27a), LIMITS.shell),
      bullet: new THREE.InstancedMesh(bullet, glow(0xffe9a8), LIMITS.bullet),
      rocket: new THREE.InstancedMesh(rocket, new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.6, metalness: 0.5 }), LIMITS.rocket),
      missile: new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5, metalness: 0.3 }),
        LIMITS.missile,
      ),
    };
    this.enemyMeshes = {
      shell: new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.16, 1.4, 2, 6).rotateX(Math.PI / 2), glow(0xff5a2a), LIMITS.shell),
      bullet: new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 1.1), glow(0xff8a4a), LIMITS.bullet),
    };
    for (const m of [...Object.values(this.meshes), ...Object.values(this.enemyMeshes)]) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(m);
    }
  }

  fire(p: Omit<Projectile, 'prev' | 'travelled' | 'alive'>) {
    const cnt = this.list.filter((x) => x.kind === p.kind).length;
    if (cnt >= LIMITS[p.kind]) return null;
    const proj: Projectile = { ...p, prev: p.pos.clone(), travelled: 0, alive: true };
    this.list.push(proj);
    return proj;
  }

  /** Advance positions; returns nothing — the game resolves hits against `prev → pos`. */
  step(dt: number) {
    for (const p of this.list) {
      if (!p.alive) continue;
      p.prev.copy(p.pos);
      if (p.kind === 'rocket' && p.start && p.target) {
        p.t! += dt;
        if (p.seek?.alive && p.T! - p.t! > 0.15) p.target.set(p.seek.pos.x, p.target.y, p.seek.pos.z);
        const k = Math.min(1, p.t! / p.T!);
        p.pos.lerpVectors(p.start, p.target, k);
        p.pos.y = p.start.y + (p.target.y - p.start.y) * k + 4 * p.apex! * k * (1 - k);
        p.vel.subVectors(p.pos, p.prev).divideScalar(Math.max(dt, 1e-4));
      } else if (p.kind === 'missile') {
        // Climb out, then top-attack dive: steer the velocity toward the target
        p.life = (p.life ?? 0) + dt;
        if (p.seek?.alive) p.aimPoint = p.seek.pos.clone().setY(1);
        const goal = (p.aimPoint ?? p.pos.clone().add(p.vel)).clone();
        const flat = Math.hypot(goal.x - p.pos.x, goal.z - p.pos.z);
        if (p.life < 0.35) goal.set(p.pos.x + p.vel.x, p.pos.y + 10, p.pos.z + p.vel.z);
        else if (flat > 22) goal.y = Math.max(goal.y, 7); // cruise, then dive from ~22 m out
        const want = goal.sub(p.pos).normalize();
        const speed = Math.min(p.weapon.speed, p.vel.length() + 60 * dt);
        const agility = p.life < 0.35 ? 6 : flat < 25 ? 10 : 4;
        const dir = p.vel.clone().normalize().lerp(want, Math.min(1, dt * agility)).normalize();
        p.vel.copy(dir.multiplyScalar(speed));
        p.pos.addScaledVector(p.vel, dt);
        p.travelled += speed * dt;
      } else {
        p.pos.addScaledVector(p.vel, dt);
        p.travelled += p.vel.length() * dt;
      }
    }
  }

  sweep() {
    for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].alive) this.list.splice(i, 1);
  }

  render() {
    const counts = new Map<THREE.InstancedMesh, number>();
    const s = new THREE.Vector3(1, 1, 1);
    const dir = new THREE.Vector3();
    for (const p of this.list) {
      if (!p.alive) continue;
      const mesh = (p.team === 'enemy' && this.enemyMeshes[p.kind]) || this.meshes[p.kind];
      dir.copy(p.vel).normalize();
      if (dir.lengthSq() < 0.5) dir.set(0, 0, 1);
      this.q.setFromUnitVectors(this.up, dir);
      this.m.compose(p.pos, this.q, s);
      const n = counts.get(mesh) ?? 0;
      if (n >= mesh.instanceMatrix.count) continue;
      mesh.setMatrixAt(n, this.m);
      counts.set(mesh, n + 1);
    }
    for (const mesh of [...Object.values(this.meshes), ...Object.values(this.enemyMeshes)]) {
      mesh.count = counts.get(mesh) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    this.list.length = 0;
    this.render();
  }
}
