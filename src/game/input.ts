import * as THREE from 'three';

export type Action = 'ammo-next' | `ammo-${1 | 2 | 3 | 4 | 5 | 6}` | 'pause' | 'zoom-in' | 'zoom-out' | 'mine';

interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  /** Touch-down time and farthest drag distance, to tell a tap from a drag. */
  t0: number;
  far: number;
  base: HTMLDivElement;
  knob: HTMLDivElement;
}

const STICK_R = 60;

/** Keyboard + mouse and dual virtual joysticks for touch. */
export class Input {
  readonly keys = new Set<string>();
  /** Mouse position in client pixels (desktop aim). */
  mouse: { x: number; y: number } | null = null;
  mouseFire = false;
  mouseMg = false;
  touchMode = matchMedia('(pointer: coarse)').matches;
  private left: Stick;
  private right: Stick;
  onAction: (a: Action) => void = () => {};
  /** Set by a quick tap on the right half (touch): fire the cannon at the nearest target. */
  private tapped = false;
  private cleanup: (() => void)[] = [];

  constructor(private el: HTMLElement, layer: HTMLElement) {
    const mk = (): Stick => {
      const base = document.createElement('div');
      base.className = 'stick hidden';
      const knob = document.createElement('div');
      knob.className = 'knob';
      base.appendChild(knob);
      layer.appendChild(base);
      return { id: -1, ox: 0, oy: 0, x: 0, y: 0, t0: 0, far: 0, base, knob };
    };
    this.left = mk();
    this.right = mk();
    this.right.base.classList.add('aim');
  }

  attach() {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, opt?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opt);
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener, opt));
    };
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') this.onAction('pause');
      const digit = /^Digit([1-6])$/.exec(e.code);
      if (digit) this.onAction(`ammo-${Number(digit[1]) as 1 | 2 | 3 | 4 | 5 | 6}`);
      if (e.code === 'KeyF' || e.code === 'KeyE') this.onAction('mine');
      if (e.code === 'KeyQ' || e.code === 'Tab') {
        e.preventDefault();
        this.onAction('ammo-next');
      }
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.reset());
    on(this.el, 'contextmenu', (e: Event) => e.preventDefault());
    on(this.el, 'wheel', (e: WheelEvent) => {
      if (!this.touchMode) this.onAction(e.deltaY > 0 ? 'zoom-out' : 'zoom-in');
    }, { passive: true });
    on(this.el, 'pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        this.touchMode = true;
        const stick = e.clientX < innerWidth / 2 ? this.left : this.right;
        if (stick.id >= 0) return;
        Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), far: 0 });
        stick.base.style.left = `${e.clientX}px`;
        stick.base.style.top = `${e.clientY}px`;
        stick.base.classList.remove('hidden');
        this.drawKnob(stick);
      } else {
        this.touchMode = false;
        this.mouse = { x: e.clientX, y: e.clientY };
        if (e.button === 0) this.mouseFire = true;
        if (e.button === 2) this.mouseMg = true;
      }
    });
    on(this.el, 'pointermove', (e: PointerEvent) => {
      for (const s of [this.left, this.right])
        if (s.id === e.pointerId) {
          s.x = e.clientX;
          s.y = e.clientY;
          s.far = Math.max(s.far, Math.hypot(s.x - s.ox, s.y - s.oy));
          this.drawKnob(s);
          return;
        }
      if (e.pointerType !== 'touch') this.mouse = { x: e.clientX, y: e.clientY };
    });
    const up = (e: PointerEvent) => {
      for (const s of [this.left, this.right])
        if (s.id === e.pointerId) {
          if (s === this.right && e.type === 'pointerup' && s.far < 18 && performance.now() - s.t0 < 350) this.tapped = true;
          s.id = -1;
          s.base.classList.add('hidden');
        }
      if (e.pointerType !== 'touch') {
        if (e.button === 0) this.mouseFire = false;
        if (e.button === 2) this.mouseMg = false;
      }
    };
    on(window, 'pointerup', up);
    on(window, 'pointercancel', up);
  }

  detach() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.reset();
  }

  reset() {
    this.keys.clear();
    this.mouseFire = this.mouseMg = this.tapped = false;
    for (const s of [this.left, this.right]) {
      s.id = -1;
      s.base.classList.add('hidden');
    }
  }

  private drawKnob(s: Stick) {
    const v = this.stickVec(s);
    s.knob.style.transform = `translate(${v.x * STICK_R}px, ${v.y * STICK_R}px)`;
  }

  private stickVec(s: Stick) {
    const v = new THREE.Vector2(s.x - s.ox, s.y - s.oy).divideScalar(STICK_R);
    if (v.length() > 1) v.normalize();
    return v;
  }

  /** Screen-relative move vector (x right, y down), length ≤ 1. */
  move() {
    const v = new THREE.Vector2();
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) v.y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) v.y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) v.x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) v.x += 1;
    if (this.left.id >= 0) {
      v.copy(this.stickVec(this.left));
      if (v.length() < 0.15) v.set(0, 0);
    }
    return v.length() > 1 ? v.normalize() : v;
  }

  /** Touch aim stick (screen-relative), or null when not aiming. */
  aimStick() {
    if (this.right.id < 0) return null;
    const v = this.stickVec(this.right);
    return v.length() > 0.2 ? v : null;
  }

  /** True once after a tap on the right half of the screen. */
  takeTap() {
    const t = this.tapped;
    this.tapped = false;
    return t;
  }

  mg() {
    return this.mouseMg || this.keys.has('Space') || this.keys.has('ShiftLeft');
  }
}
