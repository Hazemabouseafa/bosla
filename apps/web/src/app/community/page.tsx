'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserCheck,
} from 'lucide-react';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface SubscriberAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  headlineAr: string | null;
  role: string;
}

interface SubscriberAnswerItem {
  id: string;
  questionId: string;
  authorId: string;
  bodyAr: string;
  upvoteCount: number;
  createdAt: string;
  author: SubscriberAuthor;
  viewerHasUpvoted?: boolean;
}

interface SubscriberQuestionItem {
  id: string;
  authorId: string;
  topicAr: string;
  titleAr: string;
  bodyAr: string;
  courseId: string | null;
  courseTitleAr: string | null;
  course?: { id: string; slug: string } | null;
  upvoteCount: number;
  answerCount: number;
  isResolved: boolean;
  acceptedAnswerId: string | null;
  createdAt: string;
  author: SubscriberAuthor;
  viewerHasUpvoted?: boolean;
  answers: SubscriberAnswerItem[];
}

export default function SubscribersQuoraCommunityPage() {
  const { user, pushToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [canParticipate, setCanParticipate] = useState(false);
  const [accessReasonAr, setAccessReasonAr] = useState('');
  const [topics, setTopics] = useState<string[]>([
    'عام',
    'إدارة مزارع الدواجن',
    'التغذية وصياغة العلائق',
    'الأمان الحيوي والأمراض',
    'التسويق والمبيعات البيطرية',
    'إنتاج الماشية والألبان',
  ]);
  const [questions, setQuestions] = useState<SubscriberQuestionItem[]>([]);

  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'top' | 'resolved' | 'unanswered'>('all');
  const [search, setSearch] = useState('');

  // Ask question composer
  const [askOpen, setAskOpen] = useState(false);
  const [qTopic, setQTopic] = useState('إدارة مزارع الدواجن');
  const [qTitle, setQTitle] = useState('');
  const [qBody, setQBody] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Answer drafts by questionId
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [busyAnswerId, setBusyAnswerId] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (selectedTopic !== 'all') qs.set('topic', selectedTopic);
      if (filterMode !== 'all') qs.set('filter', filterMode);
      if (search.trim()) qs.set('search', search.trim());

      const res = await apiFetch<{
        access: { canParticipate: boolean; reasonAr: string };
        topics: string[];
        items: SubscriberQuestionItem[];
      }>(`/community/subscribers/questions?${qs.toString()}`);

      setCanParticipate(Boolean(res.access?.canParticipate));
      setAccessReasonAr(res.access?.reasonAr || '');
      if (res.topics?.length) setTopics(res.topics);
      setQuestions(res.items || []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل أسئلة مجتمع المشتركين', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, filterMode, search, pushToast]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qTitle.trim() || !qBody.trim()) return;
    setSubmittingQuestion(true);
    try {
      await apiFetch('/community/subscribers/questions', {
        method: 'POST',
        body: JSON.stringify({
          topicAr: qTopic,
          titleAr: qTitle.trim(),
          bodyAr: qBody.trim(),
        }),
      });
      pushToast('تم نشر سؤالك في مجتمع المشتركين بنجاح', 'success');
      setQTitle('');
      setQBody('');
      setAskOpen(false);
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر نشر السؤال', 'error');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleCreateAnswer = async (questionId: string) => {
    const bodyText = (answerDrafts[questionId] || '').trim();
    if (bodyText.length < 5) {
      pushToast('يرجى كتابة إجابة واضحة (5 أحرف على الأقل)', 'error');
      return;
    }
    setBusyAnswerId(questionId);
    try {
      await apiFetch(`/community/subscribers/questions/${questionId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ bodyAr: bodyText }),
      });
      pushToast('تم نشر إجابتك بنجاح', 'success');
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الإجابة', 'error');
    } finally {
      setBusyAnswerId(null);
    }
  };

  const handleToggleQuestionUpvote = async (questionId: string) => {
    try {
      await apiFetch(`/community/subscribers/questions/${questionId}/upvote`, {
        method: 'POST',
      });
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'يلزم اشتراك نشط للتصويت', 'error');
    }
  };

  const handleToggleAnswerUpvote = async (answerId: string) => {
    try {
      await apiFetch(`/community/subscribers/answers/${answerId}/upvote`, {
        method: 'POST',
      });
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'يلزم اشتراك نشط للتصويت', 'error');
    }
  };

  const handleAcceptAnswer = async (questionId: string, answerId: string | null) => {
    try {
      await apiFetch(`/community/subscribers/questions/${questionId}/accept-answer`, {
        method: 'POST',
        body: JSON.stringify({ answerId }),
      });
      pushToast(answerId ? 'تم اعتماد الإجابة كأفضل حل' : 'تم إلغاء اعتماد الإجابة', 'success');
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة الإجابة', 'error');
    }
  };

  const renderRoleBadge = (role: string) => {
    if (role === 'ADMIN') return <Badge tone="purple">إدارة بوصلة</Badge>;
    if (role === 'INSTRUCTOR') return <Badge tone="info">مدرب وخبير معتمد</Badge>;
    return <Badge tone="success">مشترك نشط</Badge>;
  };

  return (
    <PublicPageLayout>
      {/* Hero Banner */}
      <section className="border-b border-[#22307A] bg-[#0B1440] py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8CA2FF]/40 bg-[#18266E] px-3.5 py-1.5 text-xs font-extrabold text-[#EEF0FF]">
                <Sparkles className="h-3.5 w-3.5 text-[#F5B94A]" />
                مجتمع المشتركين التفاعلي — أسئلة وأجوبة تطبيقية
              </div>
              <h1 className="text-3xl font-extrabold text-[#EEF0FF] sm:text-4xl">
                مجتمع أسئلة وأجوبة المشتركين
              </h1>
              <p className="text-base leading-relaxed text-[#A9B1E0]">
                مساحة معرفية مخصصة لجميع المشتركين في الباقات الشهرية والسنوية أو الدورات والبرامج الفردية لطرح الأسئلة الميدانية وتبادل الخبرات مع المدربين والزملاء بأسلوب مبسط ومباشر.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3">
              {canParticipate ? (
                <Button
                  id="open-ask-question-btn"
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => setAskOpen((v) => !v)}
                >
                  <MessageSquarePlus className="h-5 w-5" />
                  {askOpen ? 'إغلاق نموذج السؤال' : 'اسأل سؤالاً جديداً'}
                </Button>
              ) : (
                <Link href="/pricing">
                  <Button type="button" variant="primary" size="lg">
                    <ShieldCheck className="h-5 w-5" />
                    اشترك الآن للمشاركة في المجتمع
                  </Button>
                </Link>
              )}
              <p className="text-xs font-semibold text-[#A9B1E0]">{accessReasonAr}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
        {/* Ask Question Form */}
        {askOpen && canParticipate && (
          <Card className="p-6 border-[#8CA2FF]">
            <h2 className="text-lg font-extrabold text-[#EEF0FF] mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#8CA2FF]" />
              اطرح سؤالك على المدربين والمشتركين
            </h2>
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field id="quora-title" label="عنوان السؤال بوضوح" required>
                    <input
                      id="quora-title"
                      className={inputClassName}
                      value={qTitle}
                      onChange={(e) => setQTitle(e.target.value)}
                      placeholder="مثال: كيف أضبط التهوية الدنيا في الأسبوع الأول لتقليل الرطوبة والأمونيا؟"
                      required
                    />
                  </Field>
                </div>
                <div>
                  <Field id="quora-topic" label="التصنيف / المجال">
                    <select
                      id="quora-topic"
                      className={inputClassName}
                      value={qTopic}
                      onChange={(e) => setQTopic(e.target.value)}
                    >
                      {topics.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <Field id="quora-body" label="تفاصيل السؤال أو الحالة الميدانية" required>
                <textarea
                  id="quora-body"
                  className={textareaClassName}
                  rows={4}
                  value={qBody}
                  onChange={(e) => setQBody(e.target.value)}
                  placeholder="اذكر العمر، السلالة، الأعراض أو الأرقام المتاحة لديك ليتمكن المدربون والزملاء من إعطائك إجابة دقيقة..."
                  required
                />
              </Field>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setAskOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" variant="primary" disabled={submittingQuestion}>
                  <Send className="h-4 w-4" />
                  {submittingQuestion ? 'جاري النشر...' : 'نشر السؤال في المجتمع'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {!canParticipate && (
          <AlertBanner tone="info" title="وضع القراءة للزوار — المشاركة للمشتركين فقط">
            يمكنك تصفح الأسئلة والإجابات المعتمدة. لطرح سؤال جديد أو إضافة إجابة، اشترك في إحدى باقات الأكاديمية الشهرية/السنوية أو اشترك في أي كورس أو برنامج تدريبي منفرد.
          </AlertBanner>
        )}

        {/* Filters & Search Bar */}
        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A9B1E0]" />
              <input
                id="quora-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في أسئلة وإجابات المشتركين..."
                className={`${inputClassName} ps-10`}
                aria-label="ابحث في أسئلة وإجابات المشتركين"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'أحدث الأسئلة' },
                  { id: 'top', label: 'الأكثر تأييداً' },
                  { id: 'resolved', label: 'تمت الإجابة' },
                  { id: 'unanswered', label: 'بانتظار الإجابة' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                    filterMode === tab.id
                      ? 'border-[#8CA2FF] bg-[#7C95FF] text-[#070D2B]'
                      : 'border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#22307A] pt-3">
            <button
              type="button"
              onClick={() => setSelectedTopic('all')}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                selectedTopic === 'all'
                  ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                  : 'border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
              }`}
            >
              جميع المواضيع
            </button>
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                  selectedTopic === topic
                    ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                    : 'border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </Card>

        {/* Questions Feed */}
        {loading ? (
          <Card className="p-10 text-center text-sm text-[#A9B1E0]">
            جاري تحميل الأسئلة والإجابات...
          </Card>
        ) : questions.length === 0 ? (
          <EmptyState
            title="لا توجد أسئلة مطابقة حالياً"
            description="كن أول من يطرح سؤالاً في هذا المجال ليشاركك المدربون والزملاء بالإجابات العملية."
          />
        ) : (
          <div className="space-y-6">
            {questions.map((q) => (
              <Card key={q.id} className="p-6 space-y-5">
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{q.topicAr}</Badge>
                    {q.isResolved ? (
                      <Badge tone="success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        تمت الإجابة
                      </Badge>
                    ) : (
                      <Badge tone="warning">مفتوح للإجابة</Badge>
                    )}
                    {q.course && q.courseTitleAr && (
                      <Link href={`/courses/${q.course.slug}`}>
                        <Badge tone="neutral">
                          <BookOpen className="h-3 w-3" />
                          {q.courseTitleAr}
                        </Badge>
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-[#A9B1E0]">
                    {new Date(q.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>

                {/* Author */}
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="font-extrabold text-[#EEF0FF]">{q.author.fullName}</span>
                  {renderRoleBadge(q.author.role)}
                  {q.author.headlineAr && (
                    <span className="text-[#A9B1E0]">— {q.author.headlineAr}</span>
                  )}
                </div>

                {/* Question Title & Body */}
                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-[#EEF0FF] leading-snug">
                    {q.titleAr}
                  </h2>
                  <p className="text-sm sm:text-base leading-relaxed text-[#A9B1E0] whitespace-pre-line">
                    {q.bodyAr}
                  </p>
                </div>

                {/* Question Actions */}
                <div className="flex flex-wrap items-center gap-3 border-y border-[#22307A] py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={q.viewerHasUpvoted ? 'primary' : 'outline'}
                    onClick={() => void handleToggleQuestionUpvote(q.id)}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    تأييد السؤال ({q.upvoteCount})
                  </Button>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A9B1E0]">
                    <MessageSquare className="h-4 w-4 text-[#8CA2FF]" />
                    {q.answers.length} إجابة
                  </span>
                </div>

                {/* Answers List */}
                {q.answers.length > 0 && (
                  <div className="space-y-3">
                    {q.answers.map((ans) => {
                      const isAccepted = q.acceptedAnswerId === ans.id;
                      const canMarkBest =
                        user &&
                        (user.id === q.authorId ||
                          user.role === 'ADMIN' ||
                          user.role === 'INSTRUCTOR');
                      return (
                        <div
                          key={ans.id}
                          className={`rounded-xl border p-4 space-y-2.5 ${
                            isAccepted
                              ? 'border-[#77E2B5] bg-[#0B1440]'
                              : 'border-[#22307A] bg-[#0B1440]/80'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <UserCheck className="h-4 w-4 text-[#8CA2FF]" />
                              <strong className="text-[#EEF0FF]">{ans.author.fullName}</strong>
                              {renderRoleBadge(ans.author.role)}
                              {isAccepted && (
                                <Badge tone="success">
                                  <Award className="h-3.5 w-3.5" />
                                  أفضل إجابة معتمدة
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-[#A9B1E0]">
                              {new Date(ans.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                          </div>

                          <p className="text-sm sm:text-base leading-relaxed text-[#EEF0FF] whitespace-pre-line">
                            {ans.bodyAr}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={ans.viewerHasUpvoted ? 'primary' : 'outline'}
                              onClick={() => void handleToggleAnswerUpvote(ans.id)}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              مفيد ({ans.upvoteCount})
                            </Button>

                            {canMarkBest && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  void handleAcceptAnswer(q.id, isAccepted ? null : ans.id)
                                }
                              >
                                <CheckCircle2 className="h-4 w-4 text-[#77E2B5]" />
                                {isAccepted ? 'إلغاء الاعتماد' : 'اعتماد كأفضل إجابة'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Answer Composer */}
                {canParticipate && (
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <input
                      id={`quora-answer-${q.id}`}
                      type="text"
                      value={answerDrafts[q.id] || ''}
                      onChange={(e) =>
                        setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="أضف إجابتك أو خبرتك العملية على هذا السؤال..."
                      className={`${inputClassName} flex-1`}
                      aria-label="أضف إجابتك"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={busyAnswerId === q.id}
                      onClick={() => void handleCreateAnswer(q.id)}
                    >
                      <Send className="h-4 w-4" />
                      {busyAnswerId === q.id ? 'جاري النشر...' : 'نشر الإجابة'}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicPageLayout>
  );
}
