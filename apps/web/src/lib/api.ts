export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    message: string,
    code?: string,
    errors?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

let cachedCsrfToken: string | null = null;

export function setClientCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

export function getClientCsrfToken(): string | null {
  return cachedCsrfToken;
}

export function getServerApiBase(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4000'
  ).replace(/\/$/, '');
}

export async function serverApiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${getServerApiBase()}/api/v1${path}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { skipCsrf?: boolean; rawResponse?: boolean } = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (isStateChanging && !options.skipCsrf && !cachedCsrfToken) {
    try {
      const meRes = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.csrfToken) {
          cachedCsrfToken = meData.csrfToken;
        }
      }
    } catch {
      // Proceed; server will respond with 401/403 if session/CSRF missing
    }
  }

  const headers = new Headers(options.headers || {});
  if (
    options.body &&
    typeof options.body === 'string' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  if (isStateChanging && cachedCsrfToken && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', cachedCsrfToken);
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let payload: any = {};
    try {
      payload = await res.json();
    } catch {
      payload = { message: res.statusText || 'حدث خطأ في الاتصال بالخادم' };
    }
    throw new ApiError(
      res.status,
      Array.isArray(payload?.message)
        ? payload.message[0]
        : payload?.message || 'حدث خطأ في الطلب',
      payload?.code,
      payload?.errors,
    );
  }

  if (options.rawResponse) {
    return res as unknown as T;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();
  if (data && typeof data === 'object' && typeof data.csrfToken === 'string') {
    cachedCsrfToken = data.csrfToken;
  }
  return data as T;
}

export async function uploadBinaryChunk(params: {
  sessionId: string;
  chunkIndex: number;
  chunk: Blob;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-Chunk-Index': String(params.chunkIndex),
  };
  if (cachedCsrfToken) {
    headers['X-CSRF-Token'] = cachedCsrfToken;
  }
  const res = await fetch(
    `/api/v1/instructor/videos/uploads/${params.sessionId}/chunk?chunkIndex=${params.chunkIndex}`,
    {
      method: 'POST',
      headers,
      body: params.chunk,
      credentials: 'include',
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.message || 'فشل رفع جزء الفيديو');
  }
  return res.json();
}

export function formatEgp(cents: number): string {
  const egp = Math.round(cents / 100);
  return `${egp.toLocaleString('ar-EG')} ج.م`;
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '—';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs} س ${mins} د`;
  if (mins > 0) return `${mins} د ${secs > 0 ? `${secs} ث` : ''}`.trim();
  return `${secs} ث`;
}

export function difficultyLabelAr(level?: string | null): string {
  switch (level) {
    case 'BEGINNER':
      return 'مبتدئ — مناسب للطلاب';
    case 'INTERMEDIATE':
      return 'متوسط — تطبيقي عملي';
    case 'ADVANCED':
      return 'متقدم — إداري وتشغيلي';
    default:
      return 'جميع المستويات';
  }
}

export function editorialStatusLabelAr(status?: string | null): {
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
} {
  switch (status) {
    case 'DRAFT':
      return { label: 'مسودة', tone: 'neutral' };
    case 'SUBMITTED_FOR_REVIEW':
      return { label: 'قيد المراجعة الإدارية', tone: 'info' };
    case 'CHANGES_REQUESTED':
      return { label: 'مطلوب تعديلات', tone: 'warning' };
    case 'APPROVED':
      return { label: 'معتمد وجاهز للنشر', tone: 'success' };
    case 'PUBLISHED':
      return { label: 'منشور للطلاب', tone: 'success' };
    case 'UNPUBLISHED':
      return { label: 'غير منشور', tone: 'warning' };
    case 'ARCHIVED':
      return { label: 'مؤرشف', tone: 'danger' };
    default:
      return { label: status || 'غير محدد', tone: 'neutral' };
  }
}
