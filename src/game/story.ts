import { tr } from '../i18n';
/**
 * Campaign story (2035). Each level has a briefing (radio dialogue before the mission)
 * and a debrief (after victory). Text references what is actually on each map.
 */

export type Speaker = 'hq' | 'kim' | 'lin' | 'voss' | 'civ' | 'you';

export const SPEAKERS: Record<Speaker, { name: string; role: string; color: string; icon: string }> = {
  hq: { name: tr('พันเอกอรินทร์', 'Col. Arin'), role: tr('ผู้บังคับการ · HQ', 'Commander · HQ'), color: '#e8c24a', icon: '★' },
  kim: { name: tr('จ่าคิม', 'Sgt. Kim'), role: tr('ช่างเทคนิค / โดรน', 'Technician / drones'), color: '#6fd6ff', icon: '⚙' },
  lin: { name: tr('ร.ท.ลิน', 'Lt. Lin'), role: tr('หน่วยข่าวกรอง', 'Intelligence'), color: '#c89aff', icon: '◉' },
  voss: { name: tr('นายพลวอสส์', 'General Voss'), role: tr('ผู้บัญชาการ RedCore', 'RedCore commander'), color: '#ff6a5a', icon: '☠' },
  civ: { name: tr('ผู้ประสานงานพลเรือน', 'Civilian liaison'), role: tr('ศูนย์อพยพ', 'Evacuation centre'), color: '#8fe07a', icon: '✚' },
  you: { name: tr('สไตรเกอร์-1', 'Striker-1'), role: tr('คุณ', 'You'), color: '#e8e6df', icon: '▲' },
};

export type Line = [Speaker, string];

export interface ChapterStory {
  title: string;
  place: string;
  intro: string;
}

export const CHAPTERS: Record<string, ChapterStory> = {
  ชานเมือง: {
    title: tr('บทที่ 1 — ชานเมืองอัลเดน', 'Chapter 1 — Alden Suburbs'),
    place: tr('เมืองอัลเดน · ปี 2035', 'Alden · 2035'),
    intro:
      tr('บริษัททหารเอกชน "RedCore" ส่งหน่วยลาดตระเวนบุกชานเมืองอัลเดนโดยไม่ประกาศสงคราม กองพันยานเกราะที่ 3 "หมาป่าเหล็ก" ได้รับคำสั่งให้หยุดยั้งการรุกคืบและคุ้มครองพลเรือน', 'The private military company "RedCore" has sent patrols into the Alden suburbs without any declaration of war. The 3rd Armoured Battalion "Iron Wolves" is ordered to stop the advance and protect civilians.'),
  },
  ใจกลางเมือง: {
    title: tr('บทที่ 2 — ใจกลางเมืองอัลเดน', 'Chapter 2 — Downtown Alden'),
    place: tr('ย่านตึกสูงอัลเดน', 'Alden\'s high-rise district'),
    intro: tr('RedCore ยึดใจกลางเมืองไว้ด้วยโดรนและรถถังหุ่นยนต์ ผู้บัญชาการของพวกมัน "นายพลวอสส์" บัญชาการอยู่ที่ศาลาว่าการ — ต้องฝ่าเข้าไปให้ถึง', 'RedCore holds downtown with drones and robot tanks. Their commander, "General Voss", runs the operation from City Hall — we have to break through.'),
  },
  ทะเลทราย: {
    title: tr('บทที่ 3 — ทะเลทรายคาร์ซ', 'Chapter 3 — The Karz Desert'),
    place: tr('เขตทดสอบอาวุธคาร์ซ', 'Karz weapons test range'),
    intro: tr('วอสส์หนีรอดไปยังทะเลทรายคาร์ซ ข่าวกรองพบฐานทดสอบอาวุธลับของ RedCore ที่ยึดเมืองโอเอซิสไว้เป็นที่กำบัง', 'Voss escaped to the Karz desert. Intelligence has found RedCore\'s secret weapons test base, hiding behind an occupied oasis town.'),
  },
  ท่าเรือ: {
    title: tr('บทที่ 4 — ท่าเรือซาริส', 'Chapter 4 — Port Saris'),
    place: tr('ท่าเรือพาณิชย์ซาริส', 'Saris commercial port'),
    intro: tr('อาวุธต้นแบบถูกลำเลียงผ่านท่าเรือซาริสขึ้นเรือสินค้า ถ้าเรือออกจากท่าได้ RedCore จะมีกองทัพหุ่นยนต์ไปทั่วภูมิภาค', 'Prototype weapons are being loaded onto a cargo ship at Port Saris. If that ship sails, RedCore will field robot armies across the region.'),
  },
  เมืองหิมะ: {
    title: tr('บทที่ 5 — นอร์ดฮาฟน์', 'Chapter 5 — Nordhavn'),
    place: tr('เมืองนอร์ดฮาฟน์ · เขตหนาวทางเหนือ', 'Nordhavn · the frozen north'),
    intro: tr('ร่องรอยสุดท้ายชี้ไปที่นอร์ดฮาฟน์ เมืองหิมะที่ซ่อน "TITAN" — แกน AI ที่ควบคุมรถถังหุ่นยนต์ทั้งหมดของ RedCore นี่คือศึกตัดสิน', 'The last trail leads to Nordhavn, the snowbound city hiding "TITAN" — the AI core that commands every RedCore robot tank. This is the decisive battle.'),
  },
};

export const STORY: Record<number, { intro: Line[]; outro: Line[] }> = {
  // ───── Chapter 1: Alden suburbs (tutorial → first mini-boss)
  1: {
    intro: [
      ['hq', tr('สไตรเกอร์-1 นี่ HQ รถบักกี้ลาดตระเวนของ RedCore เข้ามาในถนนสงบแล้ว ชาวบ้านยังอพยพไม่หมด', 'Striker-1, this is HQ. RedCore scout buggies have entered Quiet Street and civilians are still evacuating.')],
      ['hq', tr('ทบทวนการควบคุม: WASD หรือนิ้วซ้ายเพื่อขับ, เมาส์หรือนิ้วขวาเพื่อเล็งและยิง, เลข 1–2 เปลี่ยนกระสุน', 'Controls refresher: WASD or left thumb to drive, mouse or right thumb to aim and fire, keys 1–2 to switch ammo.')],
      ['kim', tr('ศัตรูลาดตระเวนตามถนนก่อนนะ ถ้าได้ยินเสียงปืนใหญ่มันจะแห่มาหา — ใช้บ้านเป็นที่กำบังได้ แต่ขับชนก็พังเหมือนกัน', 'They patrol the streets first. Fire the cannon and they\'ll come running — use houses as cover, but drive into one and it comes down.')],
      ['you', tr('รับทราบ สไตรเกอร์-1 ออกลาดตระเวน', 'Copy that. Striker-1 moving out.')],
    ],
    outro: [
      ['hq', tr('ถนนสงบปลอดภัยแล้ว แต่นี่แค่หน่วยสอดแนม — ข่าวกรองรายงานทหารราบกำลังแทรกซึมเข้าซอยใกล้ ๆ', 'Quiet Street is secure, but those were just scouts — intel reports infantry slipping into a nearby cul-de-sac.')],
    ],
  },
  2: {
    intro: [
      ['lin', tr('ทหารราบ RedCore ซ่อนตามบ้านในซอยตัน มีพลยิงจรวด RPG ปนมาด้วย', 'RedCore infantry are hiding among the houses of the cul-de-sac, with RPG teams mixed in.')],
      ['kim', tr('ทหารราบตัวเล็กยิงยาก แต่รถถังเราทับได้เลย แค่อย่าให้ RPG เล็งด้านข้างนาน ๆ', 'Infantry are hard to hit, but you can just run them over. Don\'t let the RPGs work on your flank for long.')],
      ['hq', tr('กวาดล้างซอยให้หมด ชาวบ้านต้องใช้เส้นทางนี้ไปโรงพยาบาลสนาม', 'Clear the street. Civilians need this route to reach the field hospital.')],
    ],
    outro: [['civ', tr('ขอบคุณค่ะ! เด็ก ๆ จากโรงเรียนถูกพาไปโรงพยาบาลสนามในสวนสาธารณะแล้ว แต่ RedCore กำลังมุ่งหน้าไปทางนั้น', 'Thank you! The school children were taken to the field hospital in the park — but RedCore is heading that way.')]],
  },
  3: {
    intro: [
      ['civ', tr('โรงเรียนถูกยิงจนใช้ไม่ได้ เราย้ายเด็กและผู้บาดเจ็บไปที่รถพยาบาลกับเต็นท์ในสวนสาธารณะกลางเมือง', 'The school was shelled. We moved the children and wounded to the ambulance and tents in the central park.')],
      ['lin', tr('RedCore ส่งรถหุ้มเกราะมา — พอเข้าใกล้มันจะปล่อยทหารราบลงมาอีก 3 นาย', 'RedCore is sending APCs — each one drops a 3-man squad when it gets close.')],
      ['hq', tr('ภารกิจเดียว: โรงพยาบาลสนามต้องไม่ถูกทำลาย ศัตรูบางส่วนจะพุ่งไปที่นั่นโดยตรง', 'One job: the field hospital must not fall. Some of them will go straight for it.')],
    ],
    outro: [['hq', tr('ผู้บาดเจ็บถูกอพยพออกไปได้ทั้งหมด ทำได้ดีมาก สไตรเกอร์-1', 'All the wounded got out. Outstanding work, Striker-1.')], ['lin', tr('RedCore ถอยไปตั้งหลักที่ปั๊มน้ำมันริมทางออกชานเมือง', 'RedCore has fallen back to regroup at the gas station by the suburb exit.')]],
  },
  4: {
    intro: [
      ['lin', tr('ศัตรูใช้ปั๊มน้ำมันเป็นจุดเติมเชื้อเพลิง รอบ ๆ มีถังน้ำมันใหญ่และถังเชื้อเพลิงวางอยู่เต็ม', 'They\'re refuelling at the gas station. It\'s surrounded by big fuel tanks and drums.')],
      ['kim', tr('ยิงถังให้ระเบิดใส่ศัตรูได้เลย มันลามต่อกันเป็นลูกโซ่ แต่อย่าไปจอดข้าง ๆ เองนะ', 'Shoot the tanks to blow them up on the enemy — they chain-react. Just don\'t park next to one.')],
      ['hq', tr('ทำลายกองกำลังที่ปั๊มให้หมด ตัดเส้นทางส่งกำลังของพวกมัน', 'Wipe out the force at the station and cut their supply line.')],
    ],
    outro: [['hq', tr('เส้นทางส่งกำลังถูกตัดขาด เหลือแค่ด่านประตูชานเมืองที่กั้นเราไว้จากตัวเมือง', 'Their supply line is cut. Only the suburb gate stands between us and the city.')]],
  },
  5: {
    intro: [
      ['lin', tr('ประตูชานเมืองมีเฮลิคอปเตอร์โจมตีคอยคุ้ม มันบินข้ามตึกได้และยิงจรวดจากฟ้า', 'An attack helicopter guards the suburb gate. It flies over buildings and fires rockets from the sky.')],
      ['kim', tr('ใช้ปืนกลกับปืนใหญ่ยิงตอนมันบินวนเข้ามาใกล้ ถ้าเก็บจรวดนำวิถีได้ยิ่งดี', 'Hit it with the MG and cannon when it circles in close. Grab guided missiles if you can.')],
      ['hq', tr('ทำลายเฮลิคอปเตอร์ แล้วเปิดทางเข้าเมืองให้กองพัน', 'Take down the helicopter and open the way into the city for the battalion.')],
    ],
    outro: [
      ['hq', tr('ประตูแตกแล้ว! กองพันกำลังตามเข้าเมือง', 'The gate is down! The battalion is following you in.')],
      ['voss', tr('น่าประทับใจ ผู้บังคับรถถัง… แต่ใจกลางอัลเดนเป็นของ RedCore แล้ว ยินดีต้อนรับสู่เมืองของฉัน', 'Impressive, tank commander… but downtown Alden belongs to RedCore now. Welcome to my city.')],
    ],
  },
  // ───── Chapter 2: downtown Alden
  6: {
    intro: [
      ['lin', tr('ถนนสายหลักมีตึกสูงเรียงรายสองฝั่ง ตึกที่บังรถเราจะโปร่งใสให้มองเห็น', 'Main Avenue is lined with towers on both sides. Buildings blocking your view turn see-through.')],
      ['kim', tr('ระวัง "โดรนพลีชีพ" — บินข้ามตึกแล้วพุ่งชน ยิงปืนกลสกัดก่อนมันถึงตัว', 'Watch for "kamikaze drones" — they fly over buildings and ram you. Shoot them down with the MG first.')],
      ['hq', tr('ยึดถนนสายหลัก เปิดทางเข้าสู่ย่านใจกลาง', 'Take Main Avenue and open the way into the centre.')],
    ],
    outro: [['lin', tr('เราสกัดสัญญาณได้ — โดรนพวกนี้ถูกบังคับจากเสาส่งสัญญาณที่สี่แยกกลางเมือง', 'We intercepted their signal — the drones are controlled from transmitter towers at the central crossroads.')]],
  },
  7: {
    intro: [
      ['lin', tr('RedCore ตั้งเสาสัญญาณรบกวน 3 ต้นที่สี่แยก เรดาร์ของคุณจะใช้ไม่ได้จนกว่าจะทำลายหมด', 'RedCore set up 3 jammer towers at the intersections. Your radar is down until they all fall.')],
      ['kim', tr('ระวังรถยิงจรวด MLRS — วงแดงบนพื้นคือจุดที่จรวดจะตก ขับหนีออกจากวงก่อน', 'Watch for MLRS rocket trucks — red circles on the ground mark where rockets land. Get out of them.')],
      ['hq', tr('ศัตรูจะส่งกำลังเสริมมาเรื่อย ๆ จนกว่าเสาจะล้ม ทำลายให้เร็วที่สุด', 'Reinforcements keep coming until the towers fall. Destroy them fast.')],
    ],
    outro: [['hq', tr('การสื่อสารกลับมาแล้ว!', 'Comms are back!')], ['lin', tr('ภาพถ่ายดาวเทียมพบรถถังหนักกำลังรวมพลที่ย่านการเงิน — ใกล้ศาลาว่าการ', 'Satellite images show heavy tanks massing in the Financial District — right by City Hall.')]],
  },
  8: {
    intro: [
      ['lin', tr('ย่านการเงินคือแนวป้องกันสุดท้ายหน้าศาลาว่าการ มีรถถังหนักเกราะหนาหลายคัน', 'The Financial District is their last line before City Hall, held by several heavily armoured tanks.')],
      ['kim', tr('กระสุน AP ธรรมดาเจาะช้า ลองอัปเกรดกระสุน HEAT หรือเรลกันที่โรงรถ', 'Standard AP will take a while. Try unlocking HEAT or the railgun in the Garage.')],
      ['hq', tr('ทำลายรถถังหนักให้หมด ก่อนมันจะตั้งแนวป้องกันได้', 'Destroy the heavy tanks before they dig in.')],
    ],
    outro: [['civ', tr('มีพลเรือนติดอยู่ในเขตตะวันตก เราต้องพาพวกเขาข้ามเมืองไปจุดปลอดภัย!', 'Civilians are trapped in the west side. We need to get them across the city to safety!')]],
  },
  9: {
    intro: [
      ['civ', tr('รถบรรทุก 3 คันพร้อมพาผู้อพยพข้ามเมืองจากตะวันตกไปตะวันออก', 'Three trucks are ready to carry evacuees across the city from west to east.')],
      ['hq', tr('ขบวนจะวิ่งเฉพาะตอนคุณอยู่ใกล้ (35 เมตร) ถ้ารถถึงปลายทางอย่างน้อย 1 คันถือว่าสำเร็จ', 'The convoy only moves while you are close (35 m). If at least one truck arrives, the mission succeeds.')],
      ['lin', tr('RedCore ปล่อยรถถังหุ่นยนต์ UGV ออกล่า — มันเร็วและไม่กลัวตาย', 'RedCore has unleashed UGV robot tanks — fast and fearless.')],
    ],
    outro: [['civ', tr('ผู้อพยพปลอดภัยแล้ว ขอบคุณจริง ๆ', 'The evacuees are safe. Thank you, truly.')], ['hq', tr('ถึงเวลาจบเรื่องนี้ มุ่งหน้าศาลาว่าการ', 'Time to end this. Head for City Hall.')]],
  },
  10: {
    intro: [
      ['voss', tr('คุณมาไกลเกินไปแล้ว ขอแนะนำให้รู้จัก "Behemoth" — รถถังยักษ์ 2 ป้อมปืนของฉัน', 'You have come too far. Allow me to introduce "Behemoth" — my twin-turret giant.')],
      ['lin', tr('Behemoth มีจรวดถล่มเป็นชุด และจะปล่อยโดรนเมื่อบาดเจ็บหนัก เกราะหนามาก', 'Behemoth fires rocket barrages and releases drones when badly damaged. Its armour is very thick.')],
      ['hq', tr('ทำลายมัน สไตรเกอร์-1 แล้วอัลเดนจะเป็นอิสระ', 'Destroy it, Striker-1, and Alden is free.')],
    ],
    outro: [
      ['hq', tr('Behemoth ถูกทำลาย! อัลเดนเป็นอิสระแล้ว', 'Behemoth is destroyed! Alden is free!')],
      ['lin', tr('แต่วอสส์หนีขึ้นเฮลิคอปเตอร์ไปทางใต้ — ปลายทางคือเขตทดสอบอาวุธในทะเลทรายคาร์ซ', 'But Voss escaped south by helicopter — heading for the weapons test range in the Karz desert.')],
    ],
  },
  // ───── Chapter 3: Karz desert
  11: {
    intro: [
      ['lin', tr('เมืองเล็กกลางทะเลทรายถูก RedCore ยึดเป็นด่านหน้า บ้านดินหลังคาเรียบเหมาะสำหรับซุ่ม', 'RedCore has turned a small desert town into an outpost. The flat-roofed adobe houses make perfect ambush spots.')],
      ['kim', tr('ทรายไม่ได้ทำให้รถลื่น แต่ศัตรูที่นี่เก๋ากว่าในเมือง — อัปเกรดรถก่อนออกไปนะ', 'Sand won\'t make you slide, but these troops are more experienced — upgrade before you roll out.')],
      ['hq', tr('กวาดล้างเมือง แล้วตั้งฐานส่งกำลังของเรา', 'Clear the town so we can set up our supply base.')],
    ],
    outro: [['civ', tr('ชาวบ้านบอกว่า RedCore กำลังจะยึดสถานีสูบน้ำโอเอซิส — แหล่งน้ำเดียวของทั้งเมือง', 'Locals say RedCore is about to seize the oasis pumping station — the town\'s only water.')]],
  },
  12: {
    intro: [
      ['civ', tr('สถานีสูบน้ำอยู่ริมบ่อโอเอซิสกลางเมือง ถ้าถูกทำลาย ชาวบ้านจะไม่มีน้ำใช้', 'The pumping station sits by the oasis pool in the town centre. If it\'s destroyed, people will have no water.')],
      ['hq', tr('ปกป้องสถานีสูบน้ำ ศัตรูจำนวนหนึ่งจะพุ่งเป้าไปที่นั่นโดยตรง', 'Protect the pumping station. Some of the enemy will go straight for it.')],
    ],
    outro: [['civ', tr('น้ำยังไหล ชีวิตยังอยู่ ขอบคุณ', 'The water still flows, and so do our lives. Thank you.')], ['lin', tr('พยากรณ์อากาศแจ้งพายุทรายกำลังมา — RedCore จะใช้มันซุ่มโจมตี', 'A sandstorm is coming — RedCore will use it for an ambush.')]],
  },
  13: {
    intro: [
      ['lin', tr('พายุทรายบดบังการมองเห็นเหลือไม่กี่สิบเมตร ศัตรูจะโผล่มาใกล้กว่าปกติ', 'The storm cuts visibility to a few dozen metres. Enemies will appear closer than usual.')],
      ['kim', tr('ฟังเสียงเครื่องยนต์ แล้วดูเครื่องหมาย "?" "!" เหนือหัวศัตรู — มันก็มองไม่เห็นเราเหมือนกัน', 'Listen for engines and watch the "?" and "!" markers over them — they can\'t see us either.')],
      ['hq', tr('รอดจากการซุ่มโจมตี แล้วเคลื่อนต่อไปยังฐานทัพหน้า', 'Survive the ambush, then push on to the forward base.')],
    ],
    outro: [['lin', tr('พบฐานทัพหน้าของ RedCore มีเรดาร์ 4 ต้นคุ้มกันพื้นที่ทดสอบอาวุธ', 'We\'ve found RedCore\'s forward base — 4 radars cover the test range.')]],
  },
  14: {
    intro: [
      ['lin', tr('ฐานทัพมีโรงเก็บเครื่องบิน บังเกอร์ หอสังเกตการณ์ และถังเชื้อเพลิงจำนวนมาก', 'The base has hangars, bunkers, watchtowers and plenty of fuel tanks.')],
      ['hq', tr('ทำลายเรดาร์ทั้ง 4 ต้น แล้วเรดาร์ของเราจะกลับมาใช้ได้', 'Destroy all 4 radars and our own radar comes back online.')],
      ['kim', tr('ถังเชื้อเพลิงในฐานคืออาวุธของเรา ยิงให้ระเบิดใส่พวกมันเลย', 'Their fuel tanks are our weapons. Blow them up on them.')],
    ],
    outro: [['voss', tr('คุณทำลายของเล่นของฉันได้… แต่ "Tyrant" ต้นแบบใหม่พร้อมแล้ว มันจะออกล่าในพายุ', 'You broke my toys… but the new "Tyrant" prototype is ready. It will hunt you in the storm.')]],
  },
  15: {
    intro: [
      ['lin', tr('"Desert Tyrant" คือต้นแบบรถถังยักษ์รุ่นใหม่ มีเฮลิคอปเตอร์คุ้มกัน และพายุทรายกำลังกลับมา', 'The "Desert Tyrant" is a new giant-tank prototype, escorted by a helicopter — and the sandstorm is back.')],
      ['kim', tr('มันยิงจรวดถล่มเป็นชุด ขับออกจากวงแดงให้ทัน แล้วยิงสวนตอนมันบรรจุกระสุน', 'It fires rocket barrages. Get out of the red circles, then hit back while it reloads.')],
      ['hq', tr('หยุดต้นแบบนี้ให้ได้ ก่อนมันจะถูกผลิตจำนวนมาก', 'Stop this prototype before it goes into mass production.')],
    ],
    outro: [
      ['hq', tr('Tyrant ถูกทำลาย!', 'The Tyrant is destroyed!')],
      ['lin', tr('เอกสารในฐานระบุว่าอาวุธต้นแบบชุดใหญ่ถูกส่งไปท่าเรือซาริส เพื่อขึ้นเรือสินค้า', 'Documents from the base show a large batch of prototypes was shipped to Port Saris to be loaded onto a cargo ship.')],
    ],
  },
  // ───── Chapter 4: Port Saris
  16: {
    intro: [
      ['lin', tr('ลานตู้คอนเทนเนอร์ซาริสเป็นเขาวงกต ตู้ซ้อนหลายชั้นใช้เป็นที่กำบังได้ และยิงพังได้ทีละชั้น', 'Saris\'s container yard is a maze. Stacked containers make good cover and can be shot down tier by tier.')],
      ['kim', tr('เครนสูงจะโปร่งใสเวลาบังรถเรา ไม่ต้องห่วง', 'Tall cranes turn see-through when they block your view — don\'t worry.')],
      ['hq', tr('ยึดลานตู้ ตั้งหัวหาดในท่าเรือ', 'Take the container yard and establish a foothold in the port.')],
    ],
    outro: [['hq', tr('หน่วยสนับสนุนต้องการเสบียงด่วน ขบวนรถจะวิ่งผ่านถนนริมท่า', 'Support units urgently need supplies. A convoy will run along the dockside road.')]],
  },
  17: {
    intro: [
      ['hq', tr('คุ้มกันรถบรรทุก 3 คันผ่านถนนเลียบท่าเรือ อยู่ใกล้ขบวนเพื่อให้มันเคลื่อนที่', 'Escort 3 trucks along the harbour road. Stay close so they keep moving.')],
      ['lin', tr('RedCore ซุ่มอยู่ระหว่างตู้คอนเทนเนอร์และโกดัง จะโจมตีขบวนจากด้านข้าง', 'RedCore is waiting between the containers and warehouses to hit the convoy from the flanks.')],
    ],
    outro: [['lin', tr('ข่าวกรองยืนยันว่าเชื้อเพลิงของเรือทั้งหมดเก็บอยู่ในย่านโกดัง', 'Intel confirms all of the ship\'s fuel is stored in the warehouse district.')]],
  },
  18: {
    intro: [
      ['lin', tr('ย่านโกดังเต็มไปด้วยถังเชื้อเพลิง และรถถังหนักคุ้มกันแน่นหนา', 'The warehouse district is packed with fuel drums and heavily guarded by tanks.')],
      ['kim', tr('ระเบิดถังให้เป็นลูกโซ่ — แต่ระวัง ไฟลามเร็ว', 'Chain the fuel explosions — but careful, fire spreads fast.')],
      ['hq', tr('ทำลายกำลังรบในย่านโกดัง ตัดเชื้อเพลิงของเรือ', 'Destroy the forces in the warehouses and cut off the ship\'s fuel.')],
    ],
    outro: [['hq', tr('เรือยังมีเรดาร์ชายฝั่งคุ้มกัน กองทัพเรือเข้าใกล้ไม่ได้จนกว่าเรดาร์จะดับ', 'The ship is still covered by coastal radar. The navy can\'t close in until it goes dark.')]],
  },
  19: {
    intro: [
      ['lin', tr('เรดาร์ 4 ต้นตั้งอยู่มุมท่าเรือ มันทำให้กองทัพเรือของเราถูกจับเป้าตั้งแต่ไกล', 'Four radars at the corners of the port can target our navy from far away.')],
      ['hq', tr('ทำลายเรดาร์ทั้งหมด แล้วกองทัพเรือจะปิดล้อมท่าได้', 'Destroy them all and the navy can blockade the port.')],
    ],
    outro: [['voss', tr('เรือของฉันจะออกจากท่า และเฮลิคอปเตอร์คู่ของฉันจะคุ้มกันมันไปจนสุดทาง', 'My ship will sail, and my twin gunships will escort it all the way.')]],
  },
  20: {
    intro: [
      ['lin', tr('เฮลิคอปเตอร์โจมตี 2 ลำคุ้มกันเรือสินค้าที่เทียบท่าอยู่ พร้อมโดรนพลีชีพ', 'Two attack helicopters and kamikaze drones guard the docked cargo ship.')],
      ['kim', tr('ยิงทีละลำ อย่าอยู่กลางวงที่มันบินวนสองฝั่ง', 'Take them one at a time. Don\'t sit between them while they circle.')],
      ['hq', tr('ทำลายเฮลิคอปเตอร์ทั้งคู่ เพื่อให้หน่วยนาวิกยึดเรือได้', 'Destroy both helicopters so the marines can board the ship.')],
    ],
    outro: [
      ['hq', tr('เรือถูกยึดแล้ว! อาวุธต้นแบบทั้งหมดอยู่ในมือเรา', 'The ship is ours! Every prototype is in our hands.')],
      ['lin', tr('แต่วอสส์ไม่ได้อยู่บนเรือ… สัญญาณสุดท้ายของเขามาจากนอร์ดฮาฟน์ เมืองหิมะทางเหนือ', 'But Voss wasn\'t aboard… his last signal came from Nordhavn, the snow city in the north.')],
    ],
  },
  // ───── Chapter 5: Nordhavn
  21: {
    intro: [
      ['lin', tr('นอร์ดฮาฟน์ปกคลุมด้วยหิมะ ถนนเป็นน้ำแข็ง', 'Nordhavn is buried in snow and the roads are ice.')],
      ['kim', tr('รถจะลื่นไถลตอนเลี้ยวและเบรก เบรกล่วงหน้า และอย่าเลี้ยวแรงใกล้ถังเชื้อเพลิง', 'You\'ll slide when turning and braking. Brake early, and don\'t turn hard near fuel tanks.')],
      ['hq', tr('ยึดชานเมืองเป็นจุดตั้งหลักก่อนบุกตัวเมือง', 'Secure the suburbs as a staging point before we push into the city.')],
    ],
    outro: [['lin', tr('พายุหิมะกำลังเข้า RedCore ใช้มันบังการเคลื่อนพลเข้าใจกลางเมือง', 'A blizzard is rolling in. RedCore is using it to cover their move downtown.')]],
  },
  22: {
    intro: [
      ['lin', tr('พายุหิมะรุนแรง มองเห็นได้ไม่ไกล ศัตรูเกือบทุกแบบที่เราเคยเจอรวมพลอยู่ที่นี่', 'A heavy blizzard, short visibility — and nearly every enemy type we\'ve faced is massing here.')],
      ['hq', tr('ฝ่าพายุ ทำลายกำลังรบให้หมด', 'Push through the storm and destroy them all.')],
    ],
    outro: [['civ', tr('ชาวเมืองหลายร้อยคนหลบหนาวอยู่ในโรงพยาบาลสนาม RedCore กำลังจะใช้พวกเขาเป็นตัวประกัน!', 'Hundreds of residents are sheltering in the field hospital. RedCore wants them as hostages!')]],
  },
  23: {
    intro: [
      ['civ', tr('โรงพยาบาลสนามอยู่ในสวนสาธารณะกลางหิมะ ถ้ามันถูกทำลาย ทุกคนจะหนาวตาย', 'The field hospital is in the snowy park. If it\'s destroyed, everyone will freeze.')],
      ['hq', tr('ปกป้องโรงพยาบาลสนาม ไม่ว่าจะต้องแลกด้วยอะไร', 'Protect the field hospital, whatever it takes.')],
    ],
    outro: [['civ', tr('ทุกคนปลอดภัย… เราต้องพาพวกเขาออกจากเมืองก่อนการรบครั้งสุดท้าย', 'Everyone is safe… we have to get them out of the city before the final battle.')]],
  },
  24: {
    intro: [
      ['civ', tr('ขบวนรถผู้อพยพพร้อมออกเดินทางข้ามเมืองน้ำแข็ง', 'The refugee convoy is ready to cross the frozen city.')],
      ['hq', tr('คุ้มกันขบวนให้ถึงปลายทาง แล้วเราจะบุกศูนย์บัญชาการ TITAN', 'Get the convoy to safety, then we assault TITAN\'s command centre.')],
      ['lin', tr('รถถังหุ่นยนต์และโดรนถูกสั่งให้ไล่ล่าขบวนโดยตรง', 'Robot tanks and drones have orders to hunt the convoy directly.')],
    ],
    outro: [['voss', tr('คุณชนะทุกศึก… แต่ไม่ใช่ศึกนี้ "Frost Titan" คือหัวใจของ TITAN และมันไม่เคยแพ้', 'You have won every battle… but not this one. "Frost Titan" is the heart of TITAN, and it has never lost.')], ['hq', tr('ทุกหน่วย — นี่คือศึกสุดท้าย', 'All units — this is the final battle.')]],
  },
  25: {
    intro: [
      ['lin', tr('"Frost Titan" รถถังยักษ์ติดเรลกัน ควบคุมโดย AI TITAN โดยตรง', '"Frost Titan" is a railgun-armed giant tank controlled directly by the TITAN AI.')],
      ['kim', tr('เรลกันมันจะเล็งด้วยลำแสงสีแดงก่อนยิงราว 1 วินาที — เห็นเส้นแดงเมื่อไหร่ ขับหลบทันที!', 'Its railgun paints you with a red laser about a second before firing — the moment you see the red line, move!')],
      ['hq', tr('ทุกอย่างมาจบที่นี่ สไตรเกอร์-1 ทำลาย Titan แล้ว RedCore จะล่มสลาย', 'It all ends here, Striker-1. Destroy the Titan and RedCore falls.')],
    ],
    outro: [
      ['hq', tr('Frost Titan ถูกทำลาย! แกน AI TITAN ดับแล้ว รถถังหุ่นยนต์ทั้งหมดหยุดทำงาน', 'Frost Titan is destroyed! The TITAN core is offline and every robot tank has shut down.')],
      ['lin', tr('นายพลวอสส์ถูกจับกุมขณะพยายามหนีออกจากนอร์ดฮาฟน์ RedCore สิ้นสุดแล้ว', 'General Voss was captured trying to flee Nordhavn. RedCore is finished.')],
      ['hq', tr('ภารกิจเสร็จสมบูรณ์ ขอบคุณ สไตรเกอร์-1 — หมาป่าเหล็กกลับบ้านได้แล้ว', 'Mission complete. Thank you, Striker-1 — the Iron Wolves are going home.')],
    ],
  },
};

/** 1–5 skulls for the briefing, from the level difficulty multiplier. */
export const difficultyStars = (diff: number) => Math.min(5, Math.max(1, Math.round(1 + (diff - 1) * 2.4)));
