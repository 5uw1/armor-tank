# ARMOR TANK — Requirements Specification (v0.2)

> เกมรถถังแนว 2.5D Wave Survival / Level-based เล่นฆ่าเวลา รองรับทั้ง PC และมือถือ
> สถานะ: **v0.4** — M0 ✅ · M1 ✅ (2026-09-27) · M2 ✅ ด่าน 1–10 + บอส + อัปเกรด · M3 ✅ บทที่ 3–5 ด่าน 11–25 (2026-09-28) · ถัดไป M4

## 0. ข้อตัดสินใจที่ยืนยันแล้ว (Decisions — 2026-09-27)

| # | หัวข้อ | ข้อสรุป |
|---|---|---|
| D1 | แพลตฟอร์ม | Web + PWA ก่อน → ห่อ **Capacitor** ขึ้น App Store / Play Store ภายหลัง (Phase หลัง M4) — โค้ดต้องไม่ผูกกับ browser-only API ที่ Capacitor ไม่รองรับ |
| D2 | มุมกล้อง | **เกือบ top-down** เอียงเล็กน้อย: pitch ~70° จากแนวราบ (เห็นหลังคา + ผนังด้านใต้ของตึกนิดหน่อย, เห็นมิติรถ) FOV แคบ (~35°) ลด perspective distortion |
| D3 | กราฟิก | **สมจริงที่สุดเท่าที่ทำได้** — เมืองจริง: ถนนมีเลนตีเส้น, ทางเท้า, ขอบฟุตบาท, ตึกสูงหลายชั้นมีหน้าต่าง/ระเบียง/แอร์/ป้ายบนหลังคา, บ้านมีหลังคาจั่ว, รั้ว, ต้นไม้, รถยนต์, เสาไฟ ใช้ PBR + เงาจริง + post-processing (SSAO, bloom, tone mapping) |
| D4 | ธีม | **ปัจจุบัน + อนาคตอันใกล้ (~2035)** — รถถัง/รถหุ้มเกาะสมัยใหม่ + เทคโนโลยีใหม่ (โดรน, Active Protection, Railgun, Laser, Robot tank) |
| D5 | ขอบเขต v1 | **10 ด่านแรก** = Chapter 1 ชานเมือง (1–5) + Chapter 2 ใจกลางเมือง (6–10) |
| D6 | Monetization | **เล่นฟรีทั้งหมด** ไม่มี IAP / โฆษณา |
| D7 | Save & Menu | มีเมนูหลัก, **Save/Continue** เล่นต่อภายหลังได้ รวมถึงบันทึกกลางด่าน (ดูข้อ 3.10) |

---

## 1. ภาพรวม (Overview)

| หัวข้อ | รายละเอียด |
|---|---|
| ชื่อชั่วคราว | **Armor Tank** |
| แนวเกม | Top-down / Isometric 2.5D Tank Shooter + Wave Survival + Upgrade (Roguelite-lite) |
| เป้าหมายผู้เล่น | เล่นสั้น ๆ 3–8 นาทีต่อด่าน, เล่นซ้ำได้, รู้สึก "เท่" และ "ทำลายล้าง" |
| แพลตฟอร์ม | Web Browser (PC: Chrome/Edge/Firefox/Safari, Mobile: Android Chrome, iOS Safari) ติดตั้งเป็นแอปได้ผ่าน PWA |
| โหมดเล่น | Single player, offline ได้หลังโหลดครั้งแรก |
| ภาษา UI | ไทย / อังกฤษ |

### 1.1 Core Loop
```
เลือกด่าน → ต่อสู้ศัตรูทีละ Wave (มาจากรอบทิศ) → เก็บเงิน/เศษเหล็ก/Power-up
   → ชนะบอส/รอดครบทุก Wave → ได้รางวัล + ดาว → อัปเกรดรถถัง/อาวุธ → ปลดล็อกด่านถัดไป
```

---

## 2. Technology Stack (ข้อเสนอ)

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Engine เรนเดอร์ | **Three.js** (WebGL2) + กล้อง Perspective มุมก้ม ~70° FOV แคบ (D2) | ได้ 2.5D จริง (โมเดล 3D, แสงเงา, ฟิสิกส์ของเศษซาก) แต่เล่นบนระนาบ 2D |
| ภาษา | TypeScript | โค้ดใหญ่ ต้องการ type safety |
| Build | Vite | เร็ว, ทำ PWA ง่าย |
| ฟิสิกส์ | Custom 2D collision (grid + circle/OBB) + เศษซาก 3D แบบ simple rigid body | เบากว่า physics engine เต็มรูปแบบ, เหมาะกับมือถือ |
| Pathfinding | Flow field / A* บน grid (อัปเดตเมื่ออาคารพัง) | ศัตรูจำนวนมากหาทางได้พร้อมกัน |
| เสียง | Web Audio API (Howler.js) | |
| บันทึกเกม | LocalStorage / IndexedDB | offline, ไม่ต้องมี server |
| Deploy | Static hosting (GitHub Pages / Netlify / Vercel) | |

> ทางเลือกอื่น: Unity/Godot (export Web+Android+iOS) — ได้คุณภาพกราฟิกสูงกว่าแต่ไฟล์ใหญ่ และต้องใช้ editor ภายนอก ข้อเสนอนี้เลือก Web เพื่อให้เล่นได้ทันทีทุกเครื่องผ่านลิงก์

---

## 3. Gameplay Requirements

### 3.1 การควบคุม (Controls)

| การกระทำ | PC | Mobile |
|---|---|---|
| ขับเคลื่อนตัวรถ | WASD / ลูกศร | Virtual joystick ซ้าย |
| หมุนป้อมปืน/เล็ง | เมาส์ | Virtual joystick ขวา (ลากเพื่อเล็ง, ปล่อย/ค้างเพื่อยิง) |
| ยิงอาวุธหลัก | คลิกซ้าย (ค้าง = ยิงต่อเนื่อง) | Auto-fire เมื่อเล็งด้วย joystick ขวา |
| อาวุธรอง / สกิล | คลิกขวา / Space | ปุ่มลอยด้านขวา |
| สลับชนิดกระสุน | 1–4 / Scroll | ปุ่มวงล้อกระสุน |
| หยุดเกม | Esc / P | ปุ่ม Pause |

- **FR-C1** ตัวรถ (hull) และป้อมปืน (turret) หมุนอิสระจากกัน (twin-stick)
- **FR-C2** มี option "Auto-aim assist" สำหรับมือถือ (ล็อกเป้าใกล้สุดในกรวย 30°)
- **FR-C3** ตรวจจับ input อัตโนมัติ (touch ↔ mouse) และสลับ UI ให้เหมาะ
- **FR-C4** รองรับ Gamepad (optional, Phase 2)

### 3.2 รถถังผู้เล่น (Player Tank)

| Stat | คำอธิบาย |
|---|---|
| HP (เกราะ) | พลังชีวิต |
| Armor | ลดดาเมจต่อนัด (flat) |
| Speed / Turn rate | ความเร็วเดินหน้า/ถอย/หมุนตัว (ถอยช้ากว่า) |
| Turret rotation speed | ความเร็วหมุนป้อม |
| Fire rate / Reload | อัตรายิง |
| Damage / Penetration | ดาเมจ และความสามารถเจาะเกราะ |

- **FR-P1** มีรถถังผู้เล่นให้ปลดล็อก 3–4 คัน (Phase 1 มี 2 คัน):
  - **Striker** (Medium) — สมดุล
  - **Juggernaut** (Heavy) — เกราะหนา ช้า ปืนใหญ่
  - **Viper** (Light) — เร็ว คล่อง เกราะบาง
  - **Hydra** (Rocket) — ปล่อยจรวดหลายลูก (Phase 2)
- **FR-P2** รถถังชนอาคารเล็ก/รั้ว/รถยนต์แล้ว **พังทลาย** ได้ (ram damage)
- **FR-P3** มี effect: รอยตีนตะขาบบนพื้น, ฝุ่น, ควันเมื่อ HP ต่ำ, ไฟลุกเมื่อ HP < 20%
- **FR-P4** ระบบ i-frame สั้น ๆ หลังโดนระเบิดใหญ่ + กล้องสั่น

### 3.3 อาวุธและกระสุน (Weapons & Ammo)

**อาวุธหลัก (Main Cannon) — ชนิดกระสุน สลับได้ระหว่างเล่น:**

| กระสุน | ลักษณะ | เหมาะกับ | จำกัดจำนวน |
|---|---|---|---|
| **AP** (Armor Piercing) | เร็ว ดาเมจเดี่ยวสูง เจาะเกราะ | รถถังหนัก | ไม่จำกัด (default) |
| **HE** (High Explosive) | ระเบิดวงกว้าง ดาเมจอาคารสูง | กลุ่มศัตรู, อาคาร | จำกัด |
| **HEAT** | เจาะเกราะสูงมาก ช้ากว่า | บอส | จำกัด |
| **Incendiary** | ติดไฟ ดาเมจต่อเนื่อง ทิ้งกองไฟบนพื้น | ทหารราบ/รถเบา | จำกัด |
| **Cluster** | แตกเป็นลูกย่อย 6 ลูก | ฝูงศัตรู | จำกัด |

**อาวุธรอง (Secondary) — เลือกติดได้ 1 ช่อง:**

| อาวุธ | ลักษณะ |
|---|---|
| Coaxial Machine Gun | ยิงเร็ว ดาเมจต่ำ ไม่จำกัด |
| Missile Pod | ล็อกเป้าอัตโนมัติ 4 ลูก, cooldown |
| Flamethrower | ระยะใกล้ พ่นไฟเป็นกรวย |
| Tesla Coil | ช็อตกระโดดหลายเป้า (ปลดล็อกท้ายเกม) |

**สกิลพิเศษ (Ability) — 1 ช่อง, มี cooldown:**
Smoke Screen, Repair Kit, Air Strike (ปืนใหญ่ถล่มพื้นที่), Shield Overdrive, Nitro Boost

- **FR-W1** กระสุนมีวิถีจริง (projectile) ไม่ใช่ hitscan ยกเว้น MG
- **FR-W2** กระสุน HE/HEAT/Cluster เติมได้จากกล่องที่ศัตรูดรอป
- **FR-W3** มี muzzle flash, shell ejection, tracer, แรงถีบ (recoil) ของป้อม
- **FR-W4** ระบบเกราะแบบทิศทาง (optional Phase 2): ยิงด้านหลัง/ข้างศัตรูดาเมจ ×1.5

### 3.4 ศัตรู (Enemies)

| ประเภท | ความเร็ว | HP | อาวุธ | พฤติกรรม AI |
|---|---|---|---|---|
| **Scout Buggy** (รถจี๊ปติดปืนกล) | เร็วมาก | ต่ำ | MG | วิ่งวน strafe รอบผู้เล่น |
| **Infantry Squad** (ทหารราบ) | ช้า | ต่ำมาก | ปืนเล็ก / RPG | กระจายตัว หลบหลังสิ่งกีดขวาง |
| **APC** (รถหุ้มเกราะ) | กลาง | กลาง | Autocannon | วิ่งเข้าใกล้ แล้ว **ปล่อยทหารราบ** ออกมา |
| **Light Tank** | เร็ว | กลาง | ปืนใหญ่เล็ก | ไล่ตามตรง ๆ |
| **Medium Tank** | กลาง | สูง | ปืนใหญ่ | รักษาระยะกลาง ยิงแม่นขึ้นตามเลเวล |
| **Heavy Tank** | ช้ามาก | สูงมาก | ปืนใหญ่หนัก | เดินพังอาคาร ดันตรงเข้ามา |
| **Rocket Launcher Truck** (MLRS) | ช้า | ต่ำ | จรวดวิถีโค้ง | อยู่ไกล ยิงถล่มพื้นที่ มี **วงเตือน** บนพื้นก่อนตก |
| **Anti-Tank Gun / Bunker** | นิ่ง | สูง | ปืนต่อต้านรถถัง | ตั้งรับจุดยุทธศาสตร์ |
| **Attack Drone** (Phase 2) | เร็ว | ต่ำ | ระเบิดพลีชีพ | บินข้ามอาคาร |
| **Helicopter Gunship** (Mini-boss) | เร็ว | สูง | จรวด + MG | บินวน ต้องยิงด้วย MG/Missile |
| **BOSS: Behemoth** (Super-heavy tank 2 ป้อม) | ช้า | มหาศาล | หลายระบบ | มีหลาย phase, จุดอ่อน (ป้อม/ตีนตะขาบ) ทำลายแยกได้ |

- **FR-E1** ศัตรูเกิดจาก **spawn point รอบขอบแผนที่ทุกทิศ** แสดงลูกศรเตือนที่ขอบจอก่อนเกิด 2 วินาที
- **FR-E2** ศัตรูมี variant ระดับ (Elite = สีต่างและมีเกราะเพิ่ม) ในด่านหลัง ๆ
- **FR-E3** ศัตรูหาเส้นทางอ้อมอาคาร และปรับเส้นทางเมื่ออาคารพัง
- **FR-E4** ศัตรูที่ถูกทำลายเหลือซาก (wreck) เป็นสิ่งกีดขวางชั่วคราว แล้วค่อย ๆ จางหาย
- **FR-E5** แสดง HP bar ของศัตรูเมื่อโดนยิง, ตัวเลขดาเมจลอย (ปิดได้)

### 3.5 ระบบ Wave

- **FR-WV1** แต่ละด่านมี 5–10 wave, wave สุดท้ายเป็น mini-boss หรือ boss
- **FR-WV2** ระหว่าง wave มีช่วงพัก 5–8 วินาที (แสดง "Wave X incoming" + ทิศที่จะมา)
- **FR-WV3** Wave กำหนดด้วยไฟล์ข้อมูล (JSON) : ชนิด/จำนวน/ทิศ/หน่วงเวลา — ปรับ balance ได้โดยไม่แก้โค้ด
- **FR-WV4** มีโหมด **Endless** (ปลดล็อกหลังจบแคมเปญ) — wave เพิ่มความยากเรื่อย ๆ + leaderboard ในเครื่อง
- **FR-WV5** ระหว่าง wave อาจมีตัวเลือก **Field Upgrade** 1 ใน 3 (buff ชั่วคราวเฉพาะด่าน เช่น +20% fire rate) — เพิ่มความสนุกแบบ roguelite

### 3.6 ด่านและสมรภูมิ (Levels & Battlefields)

| Chapter | สมรภูมิ | จุดเด่น | ด่าน |
|---|---|---|---|
| 1 | **ชานเมือง (Suburb)** — v1 | บ้านหลังคาจั่ว สนามหญ้า รั้ว รถยนต์จอด ต้นไม้ ถนน 2 เลน — สอนการเล่น | 1–5 |
| 2 | **ใจกลางเมือง (Downtown)** — v1 | ตึกสูงหลายชั้นถล่มได้, สี่แยกไฟจราจร, ถนน 4 เลน, ร้านค้าชั้นล่าง, ป้ายโฆษณา | 6–10 |
| 3 | ทะเลทราย / ฐานทัพ — v1.1 | พื้นที่เปิด, บังเกอร์, ถังน้ำมันระเบิดได้ | 11–15 |
| 4 | เขตอุตสาหกรรม / ท่าเรือ — v1.1 | ตู้คอนเทนเนอร์, เครน, โกดัง | 16–20 |
| 5 | เมืองหิมะ (Winter City) — v1.1 | พื้นลื่น, พายุหิมะลดทัศนวิสัย | 21–25 |

**รายละเอียด 10 ด่าน v1:**

| ด่าน | ชื่อ | รูปแบบ | Wave | ศัตรูใหม่ที่เปิดตัว |
|---|---|---|---|---|
| 1 | Quiet Street | Survival (tutorial) | 5 | Scout Buggy |
| 2 | Cul-de-sac | Survival | 6 | Infantry |
| 3 | School Yard | ป้องกันฐาน (รถพยาบาล) | 6 | APC |
| 4 | Gas Station | Survival + ถังน้ำมันระเบิด | 7 | Light Tank |
| 5 | Suburb Gate | Mini-boss | 7 | Helicopter Gunship |
| 6 | Main Avenue | Survival | 7 | Medium Tank, Kamikaze Drone |
| 7 | Crossroads | ทำลายเป้าหมาย (Jammer 3 จุด) | 8 | MLRS |
| 8 | Financial District | Survival | 8 | Heavy Tank (ปลดล็อก Railgun) |
| 9 | Convoy Run | คุ้มกันขบวนรถ | 8 | Robot Tank (UGV) |
| 10 | City Hall | **Boss: Behemoth** | 10 | Behemoth |

- **FR-L1** แผนที่ขนาดประมาณ 3–4 เท่าของจอ กล้องติดตามผู้เล่นแบบ smooth
- **FR-L2** มี minimap มุมจอ แสดงศัตรู (จุดแดง) และ pickup
- **FR-L3** เป้าหมายแต่ละด่าน: รอดครบ wave (หลัก) + ภารกิจรอง 3 ข้อเพื่อเก็บดาว (เช่น "HP เหลือ > 50%", "ทำลายอาคาร 20 หลัง", "จบใน 5 นาที")
- **FR-L4** ด่านบางด่านมีรูปแบบพิเศษ: **ป้องกันฐาน**, **คุ้มกันขบวนรถ**, **ทำลายเป้าหมาย**
- **FR-L5** Level data เป็นไฟล์ (tilemap/JSON) เพื่อเพิ่มด่านง่าย

### 3.7 สภาพแวดล้อมทำลายได้ (Destructible Environment) ⭐

| วัตถุ | HP | ผลเมื่อพัง |
|---|---|---|
| รั้ว / ต้นไม้ / ป้าย / เสาไฟ | ต่ำ | ชนแล้วล้ม |
| รถยนต์พลเรือน | ต่ำ | ระเบิด ดาเมจรอบข้าง |
| ถังน้ำมัน / ถังแก๊ส | ต่ำ | ระเบิดใหญ่ (ใช้เป็นกับดักศัตรูได้) |
| บ้าน / อาคารเล็ก | กลาง | พังเป็นขั้น (3 ระยะ: สมบูรณ์ → เสียหาย → ซากปรักหักพัง) |
| ตึกสูง | สูง | พังเป็นขั้น, ชิ้นส่วนร่วงลงมาทำดาเมจศัตรูข้างล่าง |
| กำแพงคอนกรีต / บังเกอร์ | สูงมาก | ต้องใช้ HE/HEAT |

- **FR-D1** อาคารแบ่งเป็น **chunk/modular blocks** — ทำลายเฉพาะส่วนที่โดนได้ (ไม่ใช่หายทั้งหลัง)
- **FR-D2** เมื่ออาคารพัง: เศษซาก (debris) กระเด็นแบบฟิสิกส์ + ฝุ่นควัน + ซากเหลือบนพื้นที่รถวิ่งผ่านได้ (ช้าลง)
- **FR-D3** อาคารบังกระสุนและบังสายตา AI ได้ (cover system)
- **FR-D4** เมื่ออาคารพัง นำทาง (navigation grid) ของศัตรูต้องอัปเดต
- **FR-D5** อาคารที่บังรถผู้เล่นจะโปร่งแสงอัตโนมัติ (x-ray outline ของรถ)
- **FR-D6** จำกัดจำนวน debris พร้อมกันตามระดับกราฟิก (performance)

### 3.8 ระบบความก้าวหน้า (Progression & Upgrade)

**สกุลเงิน:**
- **Credits** (เงิน) — ได้จากการฆ่าศัตรู/จบด่าน ใช้อัปเกรด
- **Scrap** (เศษเหล็ก) — ดรอปจากซากรถถัง ใช้ปลดล็อกอาวุธ/รถถังใหม่
- **Stars** — จากภารกิจรอง ใช้ปลดล็อก chapter

**Garage (หน้าอู่รถ):**
- **FR-U1** อัปเกรดรถถังแต่ละคันเป็นหมวด: Armor, Engine, Turret, Cannon — หมวดละ 10 ระดับ
- **FR-U2** อัปเกรดอาวุธ: Damage, Reload, Projectile speed, Ammo capacity, Blast radius (สำหรับ HE)
- **FR-U3** ทุก 5 ระดับ ได้ **perk พิเศษ** เช่น "AP เจาะทะลุ 2 เป้า", "HE ทิ้งกองไฟ"
- **FR-U4** รูปลักษณ์รถเปลี่ยนตามระดับอัปเกรด (เกราะเสริม, ปืนยาวขึ้น) — เพิ่มความเท่
- **FR-U5** Skin / ลายพราง (Woodland, Desert, Urban, Winter, Tiger stripe) — ปลดล็อกจากความสำเร็จ
- **FR-U6** หน้า Garage แสดงโมเดล 3D หมุนได้ พร้อมเปรียบเทียบ stat ก่อน/หลังอัปเกรด

**ในด่าน (Pickups):** Repair kit, กล่องกระสุน, Shield ชั่วคราว, Double damage, Credits

### 3.10 Save / Continue และเมนู (D7)

- **FR-S1** เมนูหลัก: **Continue** (แสดงเมื่อมี save) / **New Game** / **Level Select** / **Garage** / **Settings** / **Credits**
- **FR-S2** Auto-save ความคืบหน้าถาวร (ด่านที่ผ่าน, ดาว, เงิน, อัปเกรด, settings) ทุกครั้งที่จบด่าน / ซื้ออัปเกรด / เปลี่ยน settings
- **FR-S3** **บันทึกกลางด่าน (Checkpoint)**: บันทึกอัตโนมัติเมื่อจบแต่ละ wave (HP, กระสุน, Field upgrade, wave ปัจจุบัน, สภาพอาคารที่พังแล้ว) → ปิดเกมแล้วกด Continue กลับมาเริ่มที่ต้น wave ถัดไป
- **FR-S4** Pause menu: Resume / Restart wave / Settings / **Save & Quit to Menu**
- **FR-S5** Auto-save เมื่อสลับแอป/ปิดแท็บ (`visibilitychange` / `pagehide`)
- **FR-S6** 3 Save slots + Export/Import save เป็นไฟล์ (สำรองข้อมูล, ย้ายเครื่อง)
- **FR-S7** Save มี `version` field + migration เพื่อไม่ให้ save เก่าพังเมื่ออัปเดตเกม
- **FR-S8** เก็บใน IndexedDB (web) — ออกแบบ storage adapter ให้เปลี่ยนเป็น Capacitor Preferences/Filesystem ได้ (D1)

### 3.11 ธีมอนาคตอันใกล้ (D4) — เนื้อหาเพิ่ม

| หมวด | ของปัจจุบัน | ของอนาคตอันใกล้ (ปลดล็อกช่วงหลัง) |
|---|---|---|
| รถผู้เล่น | Striker (MBT แบบ Abrams/Leopard), Viper (รถถังเบา) | Juggernaut Mk.II (ป้อมไร้คน + APS), Hydra (ยิงจรวด) — v1.1 |
| อาวุธหลัก | AP, HE, HEAT, Incendiary, Cluster | **Railgun slug** (เจาะทะลุแนวตรง) — ปลดล็อกด่าน 8 |
| อาวุธรอง | Coax MG, Missile Pod | **Laser (Point-defense)** ยิงสกัดจรวดศัตรู |
| สกิล | Smoke, Repair, Air Strike | **Drone Swarm**, **Active Protection System** (สกัดกระสุน 3 นัด) |
| ศัตรู | Buggy, Infantry, APC, Light/Medium/Heavy Tank, MLRS, Helicopter | **Kamikaze Drone**, **Robot Tank (UGV)** , Boss: **Behemoth** super-heavy |

### 3.9 ความยาก

- **FR-DF1** ระดับ Easy / Normal / Hard (คูณ HP/ดาเมจศัตรู)
- **FR-DF2** Difficulty curve ค่อย ๆ เพิ่ม: ด่านแรก ๆ มีแต่ Buggy/Light tank → ด่านหลังผสมทุกชนิด
- **FR-DF3** เมื่อแพ้ ได้ Credits บางส่วน (ไม่เสียเวลาเปล่า) — เหมาะกับเกมฆ่าเวลา

---

## 4. Visual & Asset Requirements (สไตล์ "สมจริง")

### 4.1 Art Direction
- สไตล์ **Realistic modern military** มุมกล้อง 2.5D เกือบ top-down (ก้ม ~70°) — แนวอ้างอิง: *Tanks-A-Lot*, *Crossout* มุม top-down, *Helldivers* ในแง่ effect
- โทนสี: ธรรมชาติ ออกหม่นเล็กน้อย, effect ระเบิดสว่างตัดกับฉาก
- แสงแดดทิศเดียว + เงาจริง (shadow map), ambient occlusion แบบ baked

### 4.2 แหล่งและวิธีสร้าง Asset

| Asset | วิธีสร้าง |
|---|---|
| โมเดลรถถัง/รถศัตรู | **Procedural 3D modeling ในโค้ด** (ประกอบจาก geometry: hull มีมุมลาด, ตีนตะขาบแยกล้อ, ป้อม, ปืน, ถังน้ำมันข้าง, เสาอากาศ) + PBR material |
| Texture | **Procedural texture** (Canvas/Shader): สีพราง, รอยสนิม, คราบโคลน, รอยขีดข่วน, normal map สำหรับแผ่นเกราะ/หมุด |
| อาคาร | Modular block (ผนัง/หน้าต่าง/หลังคา) สร้างแบบ procedural ทำให้พังเป็นชิ้นได้ |
| พื้น/ถนน | Tile texture procedural (ยางมะตอย, ทราย, หญ้า, หิมะ) + decal รอยไหม้/หลุมระเบิด |
| Effects | Particle system: ระเบิด, ไฟ, ควัน, ประกายไฟ, เศษดิน, shockwave, heat distortion (PC) |
| UI / Icon | SVG vector สไตล์ military HUD |
| เสียง | Procedural SFX (Web Audio synth) สำหรับ prototype → เปลี่ยนเป็นไฟล์เสียง CC0 ภายหลัง |

- **FR-A1** Asset ทั้งหมดต้องเป็นของที่สร้างเองหรือ license **CC0 / MIT** เท่านั้น
- **FR-A2** มี **Asset Preview page** (หน้าแสดงโมเดลทุกตัว หมุนดูได้) เพื่อตรวจคุณภาพก่อนเข้าเกม
- **FR-A3** รถแต่ละชนิดต้อง **แยกแยะได้ทันทีด้วยรูปทรง (silhouette)** แม้จอมือถือเล็ก
- **FR-A4** ศัตรูมีโทนสีฝ่ายตรงข้ามชัดเจน (เช่น ฝ่ายเรา = เขียวมะกอก, ศัตรู = เทาเข้ม/แดงเลือดหมู)
- **FR-A5** ตีนตะขาบมี animation เลื่อน (UV scroll), ล้อหมุน, ป้อมมี recoil

> **หมายเหตุ:** ถ้าต้องการกราฟิกระดับ "ภาพถ่าย" จริง ๆ แนะนำใช้โมเดล CC0 ภายนอก (เช่น Quaternius, Kenney, Poly Pizza) หรือสร้างด้วย AI 3D generator แล้วนำเข้า .glb — ระบบจะรองรับการเปลี่ยนโมเดลจาก procedural → .glb โดยไม่ต้องแก้ logic

---

## 5. UI / UX

**หน้าจอ:** Splash → Main Menu → World Map (เลือก chapter/ด่าน) → Garage → Loadout (เลือกกระสุน/อาวุธรอง/สกิล) → Gameplay → Pause → Victory/Defeat (สรุปผล + ดาว + รางวัล) → Settings

**HUD ระหว่างเล่น:**
- HP + Armor bar, ตัวเลข wave / ศัตรูที่เหลือ
- วงล้อกระสุน + จำนวน, cooldown สกิล/อาวุธรอง
- Minimap, ตัวบอกทิศศัตรูนอกจอ
- Combo / kill streak counter

- **FR-UI1** UI ปรับตาม orientation — มือถือเล่นแนว **Landscape** (บังคับหมุนจอ/แจ้งเตือน)
- **FR-UI2** ปุ่มบนมือถือขนาดขั้นต่ำ 48×48 dp, ตำแหน่งปรับได้ใน Settings
- **FR-UI3** รองรับ safe area (notch) ของ iPhone/Android
- **FR-UI4** Settings: เสียง/เพลง, ระดับกราฟิก (Low/Med/High/Auto), สั่น (haptic), ภาษา, ความไวการเล็ง, auto-aim

---

## 6. Non-Functional Requirements

| รหัส | ข้อกำหนด |
|---|---|
| **NFR-1 Performance** | PC: 60 FPS, มือถือระดับกลาง (เช่น Snapdragon 7-series / iPhone 11): ≥ 45 FPS ที่ Graphics = Auto |
| **NFR-2** | ศัตรูบนจอพร้อมกันได้อย่างน้อย 40 คัน + 150 projectiles + debris 200 ชิ้น |
| **NFR-3 Load time** | โหลดครั้งแรก < 5 วินาที บน 4G, ขนาดรวม < 15 MB (procedural asset ช่วยลดขนาด) |
| **NFR-4 Offline** | PWA เล่น offline ได้หลังโหลดครั้งแรก |
| **NFR-5 Save** | Auto-save ความคืบหน้าหลังจบด่าน และเมื่อออกจากเกม |
| **NFR-6 Battery** | จำกัด FPS ได้ (30/60), ลด effect อัตโนมัติเมื่อ FPS ตก (dynamic quality) |
| **NFR-7 Pause on blur** | หยุดเกมอัตโนมัติเมื่อสลับแอป/แท็บ |
| **NFR-8 Maintainability** | ข้อมูลเกม (stat รถ, อาวุธ, wave, ด่าน) แยกเป็น config ไฟล์ทั้งหมด |
| **NFR-9 Accessibility** | โหมดตาบอดสี (สีศัตรู/ทีม), ปิด screen shake ได้ |

---

## 7. Architecture (โครงสร้างเบื้องต้น)

```
src/
  core/         Game loop, time, input (keyboard/mouse/touch/gamepad), event bus
  render/       Three.js scene, camera rig, lighting, post-processing, quality manager
  assets/       Procedural generators: tanks, vehicles, buildings, textures, effects
  entities/     Tank, Enemy (แยก AI behaviour), Projectile, Building, Pickup
  systems/      Collision, Damage, Destruction, Pathfinding (flow field), Wave spawner, Particles
  gameplay/     Weapons, Ammo types, Abilities, Upgrades, Perks
  levels/       Level loader + data/*.json
  ui/           HUD, menus, garage, virtual joystick
  save/         Persistence
  data/         tanks.json, weapons.json, enemies.json, waves/, levels/
```
- Entity แบบ component-lite (ไม่ต้อง ECS เต็มรูปแบบ) + object pooling สำหรับกระสุน/particle

---

## 8. Scope & Milestones

| Phase | เนื้อหา | ผลลัพธ์ |
|---|---|---|
| **M0 — Asset Prototype** | โมเดลรถถังผู้เล่น 1 คัน + ศัตรู 3 แบบ + อาคาร 2 แบบ, หน้า Asset Preview | ให้ผู้ใช้ **ตรวจ/อนุมัติสไตล์กราฟิก** ก่อนทำต่อ |
| **M1 — Vertical Slice** | ขับ/เล็ง/ยิง (PC+มือถือ), ศัตรู 4 ชนิด, อาคารพังได้, 1 ด่านเมือง 5 wave, HUD | เล่นได้จริง 1 ด่าน |
| **M2 — Core Game** | กระสุน 5 แบบ, อาวุธรอง, สกิล, Garage + อัปเกรด, save, Chapter 1–2 (10 ด่าน), boss 1 ตัว | เกมสมบูรณ์เบื้องต้น |
| **M3 — Content** | Chapter 3–5, ศัตรูครบ, perks, skins, Endless mode | |
| **M4 — Polish** | เสียง/เพลง, balance, PWA, optimization มือถือ, tutorial | Release |

**Out of scope (v1):** Multiplayer, ระบบซื้อด้วยเงินจริง, account/cloud save, level editor สำหรับผู้เล่น

---

## 9. Open Questions

~~คำถามรอบแรก~~ — ตอบแล้ว ดูข้อ 0 (Decisions)

คงเหลือ:
- ความสมจริงระดับ "ภาพถ่าย" ต้องใช้โมเดล/texture สำเร็จรูป (CC0 เช่น Poly Haven, Quaternius, Kenney) — M0 จะทำ **procedural PBR ก่อน** ให้ดู ถ้ายังไม่พอใจค่อยดาวน์โหลดโมเดล .glb มาแทน (ต้องขออนุญาตก่อนดาวน์โหลด)

---

## 10. Acceptance Criteria สำหรับ M1 (Vertical Slice) — ✅ ผ่าน 2026-09-27

> หมายเหตุ M1: APC ยังไม่ปล่อยทหารราบ (ย้ายไป M2) · ใช้ texture ภาพถ่าย CC0 จาก Poly Haven สำหรับพื้น/หลังคา/ซากตึก (ดู CREDITS.md)


- [x] เปิดลิงก์ได้ทั้งบน PC และมือถือ เล่นได้โดยไม่ติดตั้งอะไร
- [x] ควบคุมรถถัง twin-stick ได้ลื่นทั้งคีย์บอร์ด+เมาส์ และ touch joystick
- [x] ศัตรู 4 ชนิดความเร็ว/พฤติกรรมต่างกันชัดเจน เกิดจากรอบทิศพร้อมลูกศรเตือน
- [x] ยิงอาคารแล้วพังเป็นขั้น มีเศษซาก ฝุ่น และศัตรูหาเส้นทางใหม่ได้
- [x] ผ่าน 5 wave แล้วแสดงหน้าชัยชนะพร้อมรางวัล
- [x] เมนู + Save/Continue (checkpoint ทุก wave, 3 slots, export/import)
- [ ] ≥ 45 FPS บนมือถือระดับกลาง — ยังไม่ได้ทดสอบบนเครื่องจริง (PC RTX 4090: ~117 FPS; มีระบบลดคุณภาพอัตโนมัติ)
