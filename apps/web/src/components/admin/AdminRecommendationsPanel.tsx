'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Ban, RefreshCw } from 'lucide-react';
import { apiFetch, formatDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, Card } from '@/components/ui/primitives';

export function AdminRecommendationsPanel() {
  const { pushToast } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/admin/recommendations');
      setItems(Array.isArray(res) ? res : []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل سجل طلبات التوصية', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleRevoke = async (id: string) => {
    const reason = window.prompt('اذكر سبب إبطال خطاب التوصية (إلزامي):', 'طلب مراجعة إدارية وإبطال الخطاب');
    if (!reason || reason.trim().length < 5) return;
    try {
      await apiFetch(`/admin/recommendations/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ revokeReasonAr: reason.trim() }),
      });
      pushToast('تم إبطال خطاب التوصية وتحديث حالة التحقق العام إلى REVOKED', 'info');
      await loadList();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إبطال الخطاب', 'error');
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#EEF0FF] flex items-center gap-2">
            <Award className="h-5 w-5 text-[#8CA2FF]" />
            متابعة وإدارة خطابات التوصية ({items.length})
          </h2>
          <p className="text-xs text-[#A9B1E0] mt-1">
            تتم الموافقة والتحرير بواسطة المدرب المعني فقط. يملك المدير صلاحية الرقابة أو إبطال الخطاب عند الحاجة.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadList()} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#A9B1E0]">لا توجد طلبات توصية مسجلة حالياً.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#8CA2FF]/15">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#8CA2FF]/15">
                <th className="p-2.5">الرمز</th>
                <th className="p-2.5">المتدرب</th>
                <th className="p-2.5">المدرب المعني</th>
                <th className="p-2.5">المحتوى</th>
                <th className="p-2.5">الحالة</th>
                <th className="p-2.5">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#8CA2FF]/10">
                  <td className="p-2.5 font-mono text-[#8CA2FF]" dir="ltr">{item.verificationCode}</td>
                  <td className="p-2.5 font-semibold">{item.student?.fullName}</td>
                  <td className="p-2.5">{item.instructor?.fullName}</td>
                  <td className="p-2.5">
                    {item.course?.publishedVersion?.titleAr || item.learningPath?.titleAr || '—'}
                  </td>
                  <td className="p-2.5">
                    <Badge
                      tone={
                        item.status === 'APPROVED'
                          ? 'success'
                          : item.status === 'REVOKED' || item.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {item.status}
                    </Badge>
                    <div className="text-[10px] text-[#A9B1E0] mt-0.5">{formatDateTime(item.requestedAt)}</div>
                  </td>
                  <td className="p-2.5">
                    {item.status === 'APPROVED' && (
                      <Button type="button" variant="danger" size="sm" onClick={() => void handleRevoke(item.id)}>
                        <Ban className="h-3.5 w-3.5" />
                        إبطال الخطاب
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
