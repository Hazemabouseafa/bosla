# BOSLA Academy — Instructor Portal Guide

Seeded sample Instructor account (e.g., `د/ الحسيني داود`):
- **Phone**: `+201000000101` (`01000000101`)
- **Portal URL**: `/instructor`

## Workflow: Creating & Updating Courses
Instructors may only manage their own courses, video assets, attachments, and quizzes. Publishing requires explicit Admin approval.

1. **Upload & Transcode Videos (`/instructor/videos`)**:
   - Select any supported video (`MP4`, `MOV`, `WebM`, `MKV`) and provide an Arabic title.
   - Uploads stream in resumable binary chunks (`1 MB` per chunk) via `VideoChunkUploader` with pause/resume support.
   - Once upload completes, `apps/worker` probes video metadata with `ffprobe`, transcodes adaptive HLS renditions (`480p`/`720p`/`1080p` within source dimensions) using `ffmpeg`, generates a JPEG thumbnail, and transitions the asset to **جاهز للبث HLS (`READY`)**.

2. **Build Curriculum (`/instructor/courses/[courseId]`)**:
   - Create a course draft with title, unique English slug, category, difficulty (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`), free vs. membership-gated toggle, and full Arabic description.
   - Create reusable interactive quizzes (**اختبار جديد**) specifying passing percentage and multi-option questions.
   - Add sections and lessons (`VIDEO`, `ARTICLE`, `QUIZ`), toggle **معاينة مجانية** (`isFreePreview`) on intro lessons, bind `READY` HLS videos or quizzes, save the draft (**حفظ المسودة**) to generate lesson IDs, then attach operational PDF/Excel files directly to lessons.

3. **Draft Isolation & Admin Review**:
   - If a course is already published, saving changes modifies only `draftVersion`—students continue learning from the stable live version uninterrupted.
   - Click **إرسال للمراجعة الإدارية** (`POST /submit`) to send the draft to the Admin Editorial Queue, or withdraw it back to draft before approval.
   - View editorial feedback messages and per-course learner analytics directly inside the Instructor portal.
