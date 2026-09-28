import * as THREE from 'three';

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

/**
 * Occupancy grid + flow field toward a single target (the player).
 * Cells blocked by buildings; recomputed when the target moves or buildings fall.
 */
export class NavGrid {
  readonly n: number;
  /** Exact building footprint (hit tests, line of sight). */
  readonly blocked: Uint8Array;
  /** Footprints inflated by vehicle clearance, reference-counted (path finding). */
  readonly walk: Uint8Array;
  /** Owner building id per cell (-1 none). */
  readonly owner: Int32Array;
  private dist: Float32Array;
  private queue: Int32Array;
  private targetCell = -1;
  private dirty = true;

  constructor(readonly half: number, readonly cell = 2, readonly clearance = 2.5) {
    this.n = Math.ceil((half * 2) / cell);
    this.blocked = new Uint8Array(this.n * this.n);
    this.walk = new Uint8Array(this.n * this.n);
    this.owner = new Int32Array(this.n * this.n).fill(-1);
    this.dist = new Float32Array(this.n * this.n);
    this.queue = new Int32Array(this.n * this.n * 4);
  }

  idx(x: number, z: number) {
    const i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }

  centre(k: number, out = new THREE.Vector3()) {
    return out.set(((k % this.n) + 0.5) * this.cell - this.half, 0, (Math.floor(k / this.n) + 0.5) * this.cell - this.half);
  }

  /** Mark cells covered by an XZ box (shrunk slightly so vehicles hug walls). */
  setBox(box: THREE.Box3, id: number, value: boolean, shrink = 0.4) {
    const x0 = box.min.x + shrink, x1 = box.max.x - shrink, z0 = box.min.z + shrink, z1 = box.max.z - shrink;
    for (let x = x0; x < x1 + this.cell; x += this.cell)
      for (let z = z0; z < z1 + this.cell; z += this.cell) {
        const k = this.idx(Math.min(x, x1), Math.min(z, z1));
        if (k < 0) continue;
        this.blocked[k] = value ? 1 : 0;
        this.owner[k] = value ? id : -1;
      }
    const c = this.clearance;
    for (let x = box.min.x - c; x < box.max.x + c + this.cell; x += this.cell)
      for (let z = box.min.z - c; z < box.max.z + c + this.cell; z += this.cell) {
        const k = this.idx(Math.min(x, box.max.x + c), Math.min(z, box.max.z + c));
        if (k >= 0) this.walk[k] = Math.max(0, this.walk[k] + (value ? 1 : -1));
      }
    this.dirty = true;
  }

  isBlocked(x: number, z: number) {
    const k = this.idx(x, z);
    return k < 0 || this.blocked[k] === 1;
  }

  /** True if a vehicle cannot path through this point. */
  isTight(x: number, z: number) {
    const k = this.idx(x, z);
    return k < 0 || this.walk[k] > 0;
  }

  /** Recompute the flow field if the target cell changed or the grid was edited. */
  update(target: THREE.Vector3) {
    let t = this.idx(target.x, target.z);
    if (t < 0) return;
    if (t === this.targetCell && !this.dirty) return;
    // If the player hugs a wall, seed from the cell itself anyway
    this.targetCell = t;
    this.dirty = false;
    const { n, dist, queue, walk, blocked } = this;
    dist.fill(Infinity);
    dist[t] = 0;
    // FIFO label-correcting shortest path (fine for 8-neighbour small grids)
    let head = 0, tail = 0;
    queue[tail++] = t;
    while (head !== tail) {
      const k = queue[head];
      head = (head + 1) % queue.length;
      const i = k % n, j = (k / n) | 0;
      const d = dist[k];
      // Inside the clearance zone (player hugging a wall) the flood may continue through
      // tight cells until it reaches open ground; open cells never flood back into tight ones.
      const tight = walk[k] > 0;
      const grid = tight ? blocked : walk;
      for (const [di, dj, c] of DIRS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni;
        if (grid[nk]) continue;
        // No corner cutting
        if (di && dj && (grid[j * n + ni] || grid[nj * n + i])) continue;
        const nd = d + c;
        if (nd < dist[nk] - 1e-4) {
          dist[nk] = nd;
          queue[tail] = nk;
          tail = (tail + 1) % queue.length;
        }
      }
    }
    void t;
  }

  distanceAt(x: number, z: number) {
    const k = this.idx(x, z);
    return k < 0 ? Infinity : this.dist[k];
  }

  /** Direction (unit XZ) toward the target following the flow field; null when unreachable. */
  flow(x: number, z: number, out = new THREE.Vector2()): THREE.Vector2 | null {
    const k = this.idx(x, z);
    if (k < 0) {
      // Outside the grid: head toward the centre
      return out.set(-x, -z).normalize();
    }
    const { n, dist } = this;
    const tight = this.walk[k] > 0;
    const grid = tight ? this.blocked : this.walk;
    const i = k % n, j = (k / n) | 0;
    let best = dist[k], bi = 0, bj = 0;
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = nj * n + ni;
      if (grid[nk]) continue;
      if (di && dj && (grid[j * n + ni] || grid[nj * n + i])) continue;
      if (dist[nk] < best) {
        best = dist[nk];
        bi = di;
        bj = dj;
      }
    }
    if (bi === 0 && bj === 0) return tight && !isFinite(dist[k]) ? this.escape(i, j, out) : null;
    // Aim for the centre of the best neighbour for smoother paths
    const cx = (i + bi + 0.5) * this.cell - this.half, cz = (j + bj + 0.5) * this.cell - this.half;
    return out.set(cx - x, cz - z).normalize();
  }

  /** Inside a blocked cell (e.g. pushed into a wall): step toward the nearest free neighbour. */
  private escape(i: number, j: number, out: THREE.Vector2) {
    const { n } = this;
    const blocked = this.walk;
    for (let r = 1; r < 6; r++)
      for (const [di, dj] of DIRS) {
        const ni = i + di * r, nj = j + dj * r;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        if (!blocked[nj * n + ni]) return out.set(di, dj).normalize();
      }
    return null;
  }

  /** Grid line-of-sight test between two points. */
  los(a: THREE.Vector3, b: THREE.Vector3, step = 1) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / step);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const k = this.idx(a.x + dx * t, a.z + dz * t);
      if (k >= 0 && this.blocked[k]) return false;
    }
    return true;
  }
}
