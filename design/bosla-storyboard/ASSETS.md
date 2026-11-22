# سجل الأصول الفنية وخارطة الدمج المستقبلي (`ASSETS.md`)

يوثّق هذا الملف جميع الأصول البصرية والخطية والبرمجية المحفوظة داخل مجلد التصميم المعزول [`design/bosla-storyboard/`](./README.md)، مع الفصل الصريح بين:
- **الشعار الرسمي الثابت** المنسوخ من التطبيق الأصلي دون أي تعديل،
- **اللوحات الفوتوغرافية المولّدة (`Generated Concept / Photography Plates`)**،
- **العناصر المتجهية والكود المعزول (`SVG` + `GSAP` + `Three.js Lazy Module`)**.

---

## 1. جرد الأصول المحلية داخل `design/bosla-storyboard/assets/`

| الملف | الوظيفة والمشهد | الصيغة والأبعاد | الحجم المقاس (Bytes) | ملاحظة الاستخدام |
|---|---|---|---|---|
| [`bosla-logo.webp`](assets/bosla-logo.webp) | الشعار الرسمي لأكاديمية بوصلة | WebP (شفاف) | `3,502 B` (~3.4 KB) | نسخة مطابقة بايت-ببايت لـ `apps/web/public/images/brand/bosla-logo.webp`؛ محظور تعديله أو تلوينه عشوائياً |
| [`concept2-biosphere-rear.webp`](assets/concept2-biosphere-rear.webp) | خلفية المفهوم 02 / المشهد 01 (ديسكتوب) | WebP (`1600px` عرض) | `71,320 B` (~69.6 KB) | مجمع الدواجن والصوامع وقت الشفق مع مساحة كحلية عليا للنص العربي |
| [`concept2-biosphere-rear-mobile.webp`](assets/concept2-biosphere-rear-mobile.webp) | خلفية المشهد 01 (الموبايل `<= 768px`) | WebP (`960px` عرض) | `30,498 B` (~29.8 KB) | مُعرّفة داخل `<source media="(max-width: 768px)">` لتخفيف وزن التحميل الأولي على الجوال |
| [`scene2-lab-core.webp`](assets/scene2-lab-core.webp) | خلفية المشهد 02 (المختبر داخل عدسة المعايرة) | WebP (`1600px` عرض) | `46,094 B` (~45.0 KB) | مقعد فحص بيطري، ماصات دقيقة، وحبوب ذرة بإضاءة دافئة درامية |
| [`scene2-lab-core-mobile.webp`](assets/scene2-lab-core-mobile.webp) | خلفية المشهد 02 للموبايل (`<= 768px`) | WebP (`960px` عرض) | `21,618 B` (~21.1 KB) | نسخة مضغوطة تستجيب بنفس تنسيق اللون والإضاءة |
| [`scene3-poultry-hall.webp`](assets/scene3-poultry-hall.webp) | خلفية المشهد 03 (الأركان التشغيلية الأربعة) | WebP (`1600px` عرض) | `180,636 B` (~176.4 KB) | منظر داخلي هندسي لعنبر إنتاج حديث مضاد للحشود (`lazy` خارج الشاشة الأولى) |
| [`scene6-command-bridge.webp`](assets/scene6-command-bridge.webp) | خلفية المشهد 06 (الطاولة التنفيذية والصوامع) | WebP (`1600px` عرض) | `51,962 B` (~50.7 KB) | دليل ميداني ومكيال نحاسي على طاولة قيادية عند الفجر |
| [`concept1-split-hero.webp`](assets/concept1-split-hero.webp) | لوحة استكشاف المفهوم 01 فقط (`concepts.html`) | WebP (`1600px` عرض) | `87,630 B` (~85.6 KB) | مرجعي للمقارنة في المرحلة الأولى؛ غير مُحمّل في النموذج الحركي النهائي |
| [`concept3-specimen-plate.webp`](assets/concept3-specimen-plate.webp) | لوحة استكشاف المفهوم 03 فقط (`concepts.html`) | WebP (`1200px` عرض) | `184,138 B` (~180 KB) | مرجعي للمقارنة المطبوعية العالية التباين `#EEF0FF`؛ غير مُحمّل في النموذج النهائي |

---

## 2. الطباعة والخطوط (`Typography Inventory`)

1. **خط العناوين الهندسي (`Display`):** `Alexandria` بالأوزان `700, 800, 900` (`subsets: arabic`).
   - مُختبر بصرياً على نصوص عربية طويلة للتأكد من عدم تداخل الحركات والنقاط، مع تخصيص حاشية سفلية آمنة (`padding-bottom: 0.16em`) عند تحريك أقنعة السطور لحماية ذيل حرفي `ي` و `ى`.
2. **خط النصوص والبيانات (`Body`):** `IBM Plex Sans Arabic` بالأوزان `400, 500, 600, 700`.
   - مقاس جسم لا يقل عن `16px` وطول سطر مضبوط (`48ch–60ch`) لتجنب تشتت العين عبر الشاشات العريضة.

---

## 3. الاعتماديات التفاعلية في النموذج المعزول vs تطبيق Next.js

- **في النموذج الحالي (`design/bosla-storyboard/prototype/`):**
  - يتم استدعاء `gsap@3.13.0` + `ScrollTrigger@3.13.0` كاعتماديات CDN معزولة تماماً عن `package.json` لتطبيق الإنتاج، ومعززة بآلية تدهور آمن تعرض جميع المحتويات بشكل كامل ومقروء حتى عند تعطيل السكربتات أو في وضع تقليل الحركة.
  - يتم تحميل `three@0.170.0` (نسخة ES Module) **كسولاً (`Dynamic Import`)** فقط عند اقتراب المستخدم من مشهد الذروة الخامس (`#scene-peak-preview`) وعلى الشاشات العرضية `> 768px` ودون `saveData` أو `prefers-reduced-motion`.
- **عند الموافقة للدمج لاحقاً داخل `apps/web/` (خطة التنفيذ):**
  1. تثبيت حزمة `gsap` (`^3.13.0`) فقط إذا تمت الموافقة الهندسية (مع التخلص من أي تدوير تلقائي ثقيل غير ضروري واستبدال `BoslaMonolithCanvas.tsx` بالمسرح الطبقي المختار).
  2. نقل الأصول الفوتوغرافية الأربعة المعتمدة (`concept2-biosphere-rear*`, `scene2-lab-core*`, `scene3-poultry-hall`, `scene6-command-bridge`) إلى `apps/web/public/images/homepage-threshold/` مع حذف اللوحات المرجعية للمفاهيم المستبعدة (`concept1`, `concept3`).
  3. لف جميع تسجيلات `ScrollTrigger` داخل `gsap.context()` مع `ctx.revert()` على التفكيك (`useEffect` في Next.js App Router) لكي لا تبقى أي مسامير تثبيت (`Ghost Pins`) عند الانتقال إلى `/login` أو `/register` أو لوحات المتدربين.
  4. الإبقاء على `/admin` و `/dashboard` وجميع واجهات ما بعد تسجيل الدخول معزولة ومحفوظة بالكامل كما هي الآن.
