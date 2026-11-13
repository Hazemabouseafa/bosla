# BOSLA Academy — Admin Operations Guide

Seeded Admin account (rotate password immediately in production):
- **Phone**: `+201000000001` (`01000000001`)
- **Portal URL**: `/admin`

## Console Sections (`/admin`)
1. **نظرة عامة والبنية (Overview & Media Health)**:
   Monitor confirmed Paymob revenue, active subscriptions, pending editorial queue size, registered users/instructors, issued certificates, pending support-recovery requests, B2B/individual leads, video transcoding status counts, and VPS disk free space.

2. **مراجعة الكورسات (Editorial & Publishing)**:
   Instructors cannot self-publish. Review submitted course drafts in the queue:
   - Enter constructive feedback and choose **اعتماد (Approve)**, **طلب تعديلات (Request Changes)**, or **رفض (Reject)**.
   - Publish approved courses immediately (**نشر فوري للطلاب**), schedule future publication timestamps, or unpublish an active course.
   - Publishing promotes the reviewed `draftVersion` snapshot to `publishedVersion` seamlessly for students.

3. **المستخدمون (Users & Instructors)**:
   Promote/adjust user roles (`STUDENT`, `INSTRUCTOR`, `ADMIN`), suspend/reactivate accounts, or provision verified **Instructor** accounts directly (including active state without requiring student onboarding).

4. **المسارات والدبلومات (Categories, Learning Paths & Diplomas)**:
   - Maintain platform categories.
   - Assemble **Learning Paths (`LEARNING_PATH`)** and **Diplomas (`DIPLOMA`)** using existing courses without duplicating course data.
   - Review and grade student practical Diploma assessments/submissions (`scorePercent` + Arabic feedback), automatically triggering diploma certificate issuance upon passing.

5. **العضويات وPaymob (Membership Revisions & Payments)**:
   - Edit Monthly and Annual plan prices (EGP) and select exactly which Courses, Learning Paths, and Diplomas belong to the plan. Saving emits a new immutable `MembershipPlanRevision`.
   - Inspect live Paymob transaction statuses and deduplicated webhook events.

6. **الشهادات والاسترداد (Certificates & Support Recovery)**:
   - Inspect issued certificates and revoke compromised/invalidated certificates (immediately reflected on `/certificates/[code]`).
   - Review Method C support-assisted recovery tickets from locked-out users and approve/reject after identity verification.

7. **المحتوى والعملاء والسجل (CMS, Leads & Audit Logs)**:
   Review B2B/individual consultation leads from the storefront and inspect security/editorial audit logs.
