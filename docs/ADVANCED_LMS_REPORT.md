# BOSLA Academy — Advanced LMS, Delivery Modes & Instructor Extensions Report (v1.2)

## 1. Taxonomy Compliance
- Strictly preserves BOSLA Academy's 3-entity catalog (`COURSE`, `LEARNING_PATH`, `DIPLOMA`); no independent `Program` table was created.
- Course delivery modes (`ONLINE`, `OFFLINE`, `HYBRID`), `maxCapacity`, `waitlistEnabled`, `venueNameAr`, `venueAddressAr`, `availabilityStartAt`, `availabilityEndAt`, and `accessDurationDays` were added additively to `Course`.

## 2. Modules Delivered (`apps/api/src/modules/lms-advanced/`)
- **Delivery Modes & Course Waitlists:**
  - `PATCH /api/v1/lms/courses/:courseId/delivery` (`courses.manage`)
  - `POST /api/v1/lms/courses/:courseId/waitlist` (student join with ordered `position`) & `GET /api/v1/lms/courses/:courseId/waitlist` (`training.coordinate`).
- **Training Sessions & Attendance (`TrainingSession`, `AttendanceRecord`):**
  - Supports `ONLINE_LIVE`, `OFFLINE_CLASS`, and `HYBRID` sessions, venue info, recording URLs, and **manual meeting URLs** (Zoom API / Google Meet API excluded per Section 15 `OUT_OF_SCOPE`).
  - Instructors and Training Coordinators mark `PRESENT` / `ABSENT` / `EXCUSED` attendance via `POST /api/v1/lms/sessions/:sessionId/attendance`.
- **Question Bank & Manual Quiz Grading (`QuestionBankCategory`, `QuestionBankItem`, `QuizQuestion`, `QuizAttempt`):**
  - Supports `MCQ`, `TRUE_FALSE`, and `WRITTEN` questions plus manual grading (`PATCH /api/v1/lms/quiz-attempts/:attemptId/grade`) with audit logging.
- **Assignments & Practical Projects (`Assignment`, `AssignmentSubmission`):**
  - Supports structured rubric criteria (`rubric` JSON), student submissions (`POST /api/v1/lms/assignments/:id/submit`), and instructor grading / resubmit requests (`POST /api/v1/lms/submissions/:id/grade`) with automatic student notification.
- **Instructor Profiles & Contracts (Phase 7):**
  - `InstructorProfile` lifecycle (`NEW`, `UNDER_REVIEW`, `APPROVED`, `SUSPENDED`), specializations, years of experience, and CV URL.
  - `InstructorContract` tracks validity dates (with 30-day expiry alerts surfaced in `GET /api/v1/finance/dashboard`), default share percent, and **`deductSellerCommission: false`** by default per Checklist v1.2 §3.
