'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  EyeOff,
  Flag,
  Heart,
  Lock,
  MessageSquare,
  Pin,
  Reply,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';
import { AlertBanner, Badge, Button, Field, NativeModal, inputClassName } from '../ui/primitives';
import type { CommunityCommentItem, CommunityPostDetailResponse } from './types';

function postTypeLabel(type: string): { label: string; tone: 'info' | 'warning' | 'purple' } {
  if (type === 'ANNOUNCEMENT') return { label: 'إعلان المدرب', tone: 'purple' };
  if (type === 'QUESTION') return { label: 'سؤال', tone: 'info' };
  return { label: 'مناقشة', tone: 'warning' };
}

export function CommunityThreadModal({
  postId,
  open,
  onClose,
  onJumpToLessonTimestamp,
  onMutated,
}: {
  postId: string | null;
  open: boolean;
  onClose: () => void;
  onJumpToLessonTimestamp?: (lessonId: string, seconds: number | null, postId: string) => void;
  onMutated?: () => void;
}) {
  const { pushToast } = useAuth();
  const [detail, setDetail] = useState<CommunityPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyParentAuthor, setReplyParentAuthor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reportTarget, setReportTarget] = useState<{
    type: 'POST' | 'COMMENT';
    id: string;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('محتوى غير مناسب أو خارج نطاق الدرس');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!postId || !open) return;
    setLoading(true);
    try {
      const res = await apiFetch<CommunityPostDetailResponse>(`/community/posts/${postId}`);
      setDetail(res);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل تفاصيل المناقشة', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [postId, open, pushToast, onClose]);

  useEffect(() => {
    if (open && postId) {
      setReplyBody('');
      setReplyParentId(null);
      setReplyParentAuthor(null);
      setReportTarget(null);
      void loadDetail();
    }
  }, [open, postId, loadDetail]);

  const handleTogglePostLike = async () => {
    if (!detail) return;
    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(
        `/community/posts/${detail.post.id}/like`,
        { method: 'POST' },
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              post: { ...prev.post, viewerHasLiked: res.liked, likeCount: res.likeCount },
            }
          : prev,
      );
      onMutated?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الإعجاب', 'error');
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    try {
      await apiFetch<{ liked: boolean; likeCount: number }>(
        `/community/comments/${commentId}/like`,
        { method: 'POST' },
      );
      await loadDetail();
      onMutated?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الإعجاب', 'error');
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !replyBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/community/posts/${detail.post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          parentCommentId: replyParentId || undefined,
          body: replyBody.trim(),
        }),
      });
      setReplyBody('');
      setReplyParentId(null);
      setReplyParentAuthor(null);
      pushToast('تمت إضافة ردك بنجاح', 'success');
      await loadDetail();
      onMutated?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إضافة الرد', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAnswer = async (commentId: string) => {
    if (!detail) return;
    try {
      await apiFetch(`/community/posts/${detail.post.id}/accept-answer`, {
        method: 'POST',
        body: JSON.stringify({ commentId }),
      });
      pushToast('تم اعتماد الإجابة بنجاح', 'success');
      await loadDetail();
      onMutated?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر اعتماد الإجابة', 'error');
    }
  };

  const handleModerate = async (
    action:
      | 'PIN'
      | 'UNPIN'
      | 'LOCK'
      | 'UNLOCK'
      | 'HIDE'
      | 'REMOVE'
      | 'RESTORE'
      | 'MARK_ANSWERED'
      | 'MARK_UNANSWERED',
  ) => {
    if (!detail) return;
    try {
      await apiFetch(`/community/posts/${detail.post.id}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      pushToast('تم تطبيق إجراء الإشراف بنجاح', 'success');
      if (action === 'REMOVE') {
        onMutated?.();
        onClose();
      } else {
        await loadDetail();
        onMutated?.();
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ الإجراء', 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiFetch(`/community/comments/${commentId}`, { method: 'DELETE' });
      pushToast('تم حذف التعليق', 'info');
      await loadDetail();
      onMutated?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف التعليق', 'error');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || reporting) return;
    setReporting(true);
    try {
      await apiFetch('/community/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          reason: reportReason,
          details: reportDetails.trim() || undefined,
        }),
      });
      pushToast('تم إرسال البلاغ للإدارة للمراجعة', 'success');
      setReportTarget(null);
      setReportDetails('');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال البلاغ', 'error');
    } finally {
      setReporting(false);
    }
  };

  const handleTimestampAction = async () => {
    if (!detail?.post.lessonId) return;
    try {
      const target = await apiFetch<{
        lessonId: string;
        seekSeconds: number;
        postId: string;
      }>(`/community/posts/${detail.post.id}/timestamp-target`);
      onJumpToLessonTimestamp?.(
        target.lessonId,
        detail.post.videoTimestampSeconds !== null ? target.seekSeconds : null,
        target.postId,
      );
      onClose();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الانتقال إلى توقيت الفيديو', 'error');
    }
  };

  const renderComment = (comment: CommunityCommentItem, isReply = false) => {
    const canAccept = Boolean(detail?.permissions.canModerate);
    const canModerate = Boolean(detail?.permissions.canModerate);

    return (
      <div
        key={comment.id}
        className={`rounded-2xl border p-4 space-y-2.5 ${
          comment.isAcceptedAnswer
            ? 'border-[#77E2B5]/45 bg-[#77E2B5]/10'
            : comment.author.isCourseInstructor
              ? 'border-[#8CA2FF]/40 bg-[#18266E]'
              : 'border-[#22307A] bg-[#0B1440]'
        } ${isReply ? 'mt-2.5' : ''}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-bosla-ink">
              {comment.author.fullName}
            </span>
            {comment.author.isCourseInstructor && (
              <Badge tone="info">
                <Award className="h-3 w-3" />
                إجابة المدرب
              </Badge>
            )}
            {comment.author.isAdminModerator && (
              <Badge tone="purple">
                <ShieldCheck className="h-3 w-3" />
                إدارة الأكاديمية
              </Badge>
            )}
            {comment.isAcceptedAnswer && (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" />
                الإجابة المعتمدة
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-bosla-muted">
            {new Date(comment.createdAt).toLocaleString('ar-EG')}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-bosla-ink whitespace-pre-line">
          {comment.body}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => void handleToggleCommentLike(comment.id)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold transition-colors ${
              comment.viewerHasLiked
                ? 'border-[#FF9CAA]/50 bg-[#FF9CAA]/15 text-[#FF9CAA]'
                : 'border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${comment.viewerHasLiked ? 'fill-current' : ''}`} />
            مفيد ({comment.likeCount})
          </button>

          {!isReply && detail?.permissions.canPost && (
            <button
              type="button"
              onClick={() => {
                setReplyParentId(comment.id);
                setReplyParentAuthor(comment.author.fullName);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#22307A] bg-[#0F1A4A] px-2.5 py-1 font-bold text-[#A9B1E0] hover:text-[#8CA2FF]"
            >
              <Reply className="h-3.5 w-3.5" />
              رد
            </button>
          )}

          {canAccept && !comment.isAcceptedAnswer && (
            <button
              type="button"
              onClick={() => void handleAcceptAnswer(comment.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#77E2B5]/40 bg-[#77E2B5]/15 px-2.5 py-1 font-bold text-[#77E2B5] hover:bg-[#77E2B5]/25"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              اعتماد الإجابة
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setReportTarget({
                type: 'COMMENT',
                id: comment.id,
                label: `تعليق ${comment.author.fullName}`,
              })
            }
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-[#A9B1E0] hover:text-[#FF9CAA]"
          >
            <Flag className="h-3.5 w-3.5" />
            إبلاغ
          </button>

          {canModerate && (
            <button
              type="button"
              onClick={() => void handleDeleteComment(comment.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-[#FF9CAA] hover:bg-[#FF9CAA]/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </button>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-2 border-s-2 border-bosla-primary/45 ps-4">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={detail ? detail.post.title : 'تفاصيل المناقشة'}
    >
      {loading || !detail ? (
        <div className="py-10 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل المناقشة والإجابات...
        </div>
      ) : (
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pe-1">
          <div className="flex flex-wrap items-center gap-2">
            {detail.post.isPinned && <Badge tone="warning">مثبت</Badge>}
            <Badge tone={postTypeLabel(detail.post.type).tone}>
              {postTypeLabel(detail.post.type).label}
            </Badge>
            {detail.post.type === 'QUESTION' && (
              <Badge tone={detail.post.isAnswered ? 'success' : 'warning'}>
                {detail.post.isAnswered ? 'تمت الإجابة' : 'بانتظار الإجابة'}
              </Badge>
            )}
            {detail.post.isLocked && (
              <Badge tone="neutral">
                <Lock className="h-3 w-3" />
                مغلق للردود
              </Badge>
            )}
            {detail.post.lessonTitleAr && (
              <Badge tone="info">الدرس: {detail.post.lessonTitleAr}</Badge>
            )}
          </div>

          <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-bosla-ink">
                  {detail.post.author.fullName}
                </span>
                {detail.post.author.isCourseInstructor && (
                  <Badge tone="info">مدرب الكورس</Badge>
                )}
              </div>
              <span className="text-xs text-bosla-muted">
                {new Date(detail.post.createdAt).toLocaleString('ar-EG')}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-bosla-ink whitespace-pre-line">
              {detail.post.body}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {detail.post.lessonId && (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => void handleTimestampAction()}
                >
                  <Clock className="h-4 w-4" />
                  {detail.post.videoTimestampLabel
                    ? `شاهد الجزء المرتبط بالسؤال — ${detail.post.videoTimestampLabel}`
                    : 'الانتقال إلى الدرس'}
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant={detail.post.viewerHasLiked ? 'gold' : 'outline'}
                onClick={() => void handleTogglePostLike()}
              >
                <Heart
                  className={`h-4 w-4 ${detail.post.viewerHasLiked ? 'fill-current' : ''}`}
                />
                أعجبني ({detail.post.likeCount})
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setReportTarget({
                    type: 'POST',
                    id: detail.post.id,
                    label: detail.post.title,
                  })
                }
              >
                <Flag className="h-4 w-4" />
                إبلاغ
              </Button>
            </div>
          </div>

          {detail.permissions.canModerate && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#8CA2FF]/35 bg-[#18266E] p-3 text-xs">
              <span className="font-extrabold text-[#EEF0FF] me-1">أدوات الإشراف:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleModerate(detail.post.isPinned ? 'UNPIN' : 'PIN')}
              >
                <Pin className="h-3.5 w-3.5" />
                {detail.post.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleModerate(detail.post.isLocked ? 'UNLOCK' : 'LOCK')}
              >
                {detail.post.isLocked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" /> فتح الردود
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" /> إغلاق الردود
                  </>
                )}
              </Button>
              {detail.post.type === 'QUESTION' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleModerate(
                      detail.post.isAnswered ? 'MARK_UNANSWERED' : 'MARK_ANSWERED',
                    )
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {detail.post.isAnswered ? 'تحديد كبانتظار إجابة' : 'تحديد كتمت الإجابة'}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void handleModerate(detail.post.status === 'HIDDEN' ? 'RESTORE' : 'HIDE')
                }
              >
                <EyeOff className="h-3.5 w-3.5" />
                {detail.post.status === 'HIDDEN' ? 'إظهار' : 'إخفاء'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => void handleModerate('REMOVE')}
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف
              </Button>
            </div>
          )}

          {reportTarget && (
            <form
              onSubmit={handleSubmitReport}
              className="rounded-2xl border border-[#FF9CAA]/35 bg-[#FF9CAA]/10 p-4 space-y-3"
            >
              <p className="text-xs font-extrabold text-[#FF9CAA]">
                الإبلاغ عن: {reportTarget.label}
              </p>
              <Field id="report-reason" label="سبب البلاغ" required>
                <input
                  id="report-reason"
                  className={inputClassName}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                />
              </Field>
              <Field id="report-details" label="تفاصيل إضافية (اختياري)">
                <textarea
                  id="report-details"
                  rows={2}
                  className={inputClassName}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="danger" disabled={reporting}>
                  {reporting ? 'جاري الإرسال...' : 'إرسال البلاغ للإدارة'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setReportTarget(null)}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#8CA2FF]" />
              الردود والإجابات ({detail.comments.length})
            </h3>
            {detail.comments.length === 0 ? (
              <p className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-center text-xs text-[#A9B1E0]">
                لا توجد ردود حتى الآن. كن أول من يضيف إجابة مفيدة!
              </p>
            ) : (
              <div className="space-y-3">
                {detail.comments.map((comment) => renderComment(comment))}
              </div>
            )}
          </div>

          {detail.post.isLocked && !detail.permissions.canModerate ? (
            <AlertBanner tone="warning">
              تم إغلاق الردود الجديدة على هذه المناقشة من قِبل المدرب أو الإدارة.
            </AlertBanner>
          ) : detail.permissions.canPost ? (
            <form onSubmit={handleSubmitComment} className="space-y-3 border-t border-[#22307A] pt-4">
              {replyParentAuthor && (
                <div className="flex items-center justify-between rounded-xl border border-[#8CA2FF]/35 bg-[#18266E] px-3 py-2 text-xs text-[#EEF0FF]">
                  <span>ترد الآن على تعليق: {replyParentAuthor}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyParentId(null);
                      setReplyParentAuthor(null);
                    }}
                    className="font-bold underline"
                  >
                    إلغاء الرد المحدد
                  </button>
                </div>
              )}
              <Field id="thread-reply-body" label="أضف إجابتك أو تعليقك" required>
                <textarea
                  id="thread-reply-body"
                  rows={3}
                  className={inputClassName}
                  placeholder="اكتب ردك بوضوح ومهنية لمساعدة زملائك..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  required
                  minLength={2}
                  maxLength={3000}
                />
              </Field>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'جاري النشر...' : 'نشر الرد'}
              </Button>
            </form>
          ) : (
            <AlertBanner tone="info">
              المشاركة بالردود متاحة للطلاب المشتركين عندما تكون المناقشات مفعّلة.
            </AlertBanner>
          )}
        </div>
      )}
    </NativeModal>
  );
}
