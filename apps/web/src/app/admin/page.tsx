'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminControlCenterWorkspace } from '@/components/admin/AdminControlCenterWorkspace';
import { resolveLegacyAdminRedirectUrl } from '@/components/admin/AdminNavMap';

function AdminOverviewEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkedRedirect, setCheckedRedirect] = useState(false);

  useEffect(() => {
    const legacyRedirect = resolveLegacyAdminRedirectUrl(new URLSearchParams(searchParams.toString()));
    if (legacyRedirect) {
      router.replace(legacyRedirect);
      return;
    }
    setCheckedRedirect(true);
  }, [router, searchParams]);

  if (!checkedRedirect) {
    return null;
  }

  return <AdminControlCenterWorkspace initialSection="overview" />;
}

export default function AdminControlCenterPage() {
  return (
    <Suspense fallback={null}>
      <AdminOverviewEntry />
    </Suspense>
  );
}
