const API_URL = import.meta.env.VITE_API_URL || '/api';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

function handleUnauthorized(res) {
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login';
  }
}

/**
 * 429 = hết quota gọi AI trong ngày. Backend vẫn lưu reflection và trả nó trong body,
 * nên đây không phải lỗi mất dữ liệu — modal hiển thị kết quả kèm thông báo hết lượt.
 */
async function quotaError(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    // giữ body rỗng, dùng thông báo mặc định bên dưới
  }
  const err = new Error(body.message || 'Bạn đã dùng hết lượt phân tích AI hôm nay.');
  err.quotaExceeded = true;
  err.reflection = body.reflection || null;
  err.limit = body.limit;
  err.plan = body.plan;
  return err;
}

export const reflectionAPI = {
  /**
   * Gửi reflection sau phiên học, nhận về AI feedback.
   * @param {{sessionId: number, completionPercent: number, focusLevel: number,
   *          distractionReasons: string[], subject?: string}} data
   */
  createReflection: async (data) => {
    const res = await fetch(`${API_URL}/reflections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 429) {
      throw await quotaError(res);
    }
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Không lưu được reflection.'));
    }
    return res.json();
  },

  getReflections: async () => {
    const res = await fetch(`${API_URL}/reflections`, { credentials: 'include' });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Không tải được danh sách reflection.'));
    }
    return res.json();
  },

  getBySession: async (sessionId) => {
    const res = await fetch(`${API_URL}/reflections/session/${sessionId}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Không tải được reflection.'));
    }
    return res.json();
  },

  /**
   * Kế hoạch cho phiên SẮP học: môn, độ dài, khung giờ, biện pháp chặn xao nhãng và
   * điểm dự đoán. Không tốn quota AI nên gọi được mỗi lần mở app và mỗi khi user đổi môn.
   *
   * @param {string|null} subject môn user đang gõ ở ô Task
   */
  getNextSession: async (subject) => {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    const res = await fetch(`${API_URL}/reflections/next-session${query}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Không tải được kế hoạch phiên tiếp theo.'));
    }
    return res.json();
  },

  /** Meta-Learning Insights: khung giờ tập trung tốt nhất + độ dài Pomodoro gợi ý. */
  getInsights: async () => {
    const res = await fetch(`${API_URL}/reflections/insights`, { credentials: 'include' });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Không tải được Meta-Learning Insights.'));
    }
    return res.json();
  },
};
