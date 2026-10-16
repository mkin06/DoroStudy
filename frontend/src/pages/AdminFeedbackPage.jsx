import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  MessageSquare,
  Sparkles,
  Bot,
  Layout,
  CheckCircle2,
  Clock,
  Trash2,
  ShieldCheck,
  Star,
  Tag,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  User,
  Inbox
} from 'lucide-react';
import { me } from '../api/authentication/auth';
import { API_URL } from '../api/config';
import { responseLabel, AREAS, ISSUE_TYPES } from '../lib/feedbackSchema';
import { useToast } from '../contexts/ToastContext';
import './AdminFeedbackPage.css';

export default function AdminFeedbackPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ total: 0, newCount: 0, uxCount: 0, aiCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKind, setFilterKind] = useState('ALL'); // ALL, ux, ai
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, NEW, READ, RESOLVED
  const [filterArea, setFilterArea] = useState('ALL');

  // Verify Admin Authentication
  useEffect(() => {
    let isMounted = true;
    me()
      .then((user) => {
        if (!isMounted) return;
        setCurrentUser(user);
        const adminCheck = user?.role?.toUpperCase() === 'ADMIN';
        setIsAdmin(adminCheck);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentUser(null);
        setIsAdmin(false);
        setAuthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch feedback data
  const fetchFeedbacks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(`${API_URL}/feedback/admin`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Không thể tải danh sách góp ý. Vui lòng kiểm tra quyền admin.');
      }
      const data = await response.json();
      setFeedbacks(data.feedbacks || []);
      setStats(data.stats || { total: 0, newCount: 0, uxCount: 0, aiCount: 0 });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tải dữ liệu góp ý');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchFeedbacks();
    }
  }, [isAdmin, fetchFeedbacks]);

  // Update Status handler
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/feedback/admin/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        throw new Error('Cập nhật trạng thái thất bại');
      }
      const updatedItem = await response.json();
      setFeedbacks((prev) =>
        prev.map((item) => (item.id === id ? updatedItem : item))
      );
      toast.success(`Đã chuyển trạng thái sang "${getStatusLabel(newStatus)}"`);

      // Refresh stats
      setStats((prev) => {
        const itemBefore = feedbacks.find((f) => f.id === id);
        let newCount = prev.newCount;
        if (itemBefore?.status === 'NEW' && newStatus !== 'NEW') newCount = Math.max(0, newCount - 1);
        if (itemBefore?.status !== 'NEW' && newStatus === 'NEW') newCount = newCount + 1;
        return { ...prev, newCount };
      });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phản hồi góp ý này không?')) return;

    try {
      const response = await fetch(`${API_URL}/feedback/admin/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Xóa góp ý thất bại');
      }
      setFeedbacks((prev) => prev.filter((item) => item.id !== id));
      toast.success('Đã xóa góp ý thành công');
      fetchFeedbacks(true);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa góp ý');
    }
  };

  // Filtered List
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      // Kind filter
      if (filterKind !== 'ALL' && item.kind?.toLowerCase() !== filterKind.toLowerCase()) {
        return false;
      }
      // Status filter
      if (filterStatus !== 'ALL' && item.status?.toUpperCase() !== filterStatus.toUpperCase()) {
        return false;
      }
      // Area filter
      if (filterArea !== 'ALL' && item.area !== filterArea) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const comment = (item.comment || '').toLowerCase();
        const userName = (item.userName || '').toLowerCase();
        const userEmail = (item.userEmail || '').toLowerCase();
        const area = (item.area || '').toLowerCase();
        const issueType = (item.issueType || '').toLowerCase();
        return (
          comment.includes(term) ||
          userName.includes(term) ||
          userEmail.includes(term) ||
          area.includes(term) ||
          issueType.includes(term)
        );
      }
      return true;
    });
  }, [feedbacks, filterKind, filterStatus, filterArea, searchTerm]);

  const getStatusLabel = (status) => {
    switch (status?.toUpperCase()) {
      case 'NEW':
        return 'Mới';
      case 'READ':
        return 'Đã xem';
      case 'RESOLVED':
        return 'Đã xử lý';
      default:
        return status || 'Mới';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Render Access Denied state if not admin
  if (!authLoading && !isAdmin) {
    return (
      <div className="admin-page-denied">
        <div className="denied-card">
          <div className="denied-icon">
            <AlertCircle size={48} className="text-amber-400" />
          </div>
          <span className="denied-eyebrow">DOROSTUDY SECURITY</span>
          <h2 className="denied-title">Truy cập bị từ chối</h2>
          <p className="denied-desc">
            Trang này dành riêng cho tài khoản quản trị viên (Admin). Bạn hiện đang đăng nhập với tài khoản:
            <strong> {currentUser?.email || currentUser?.username || 'Khách'}</strong>.
          </p>
          <div className="denied-actions">
            <button className="admin-btn-primary" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Quay về Trang chủ
            </button>
            <button className="admin-btn-secondary" onClick={() => navigate('/login')}>
              Đăng nhập tài khoản khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-feedback-page">
      {/* Background Glows */}
      <div className="admin-bg-glow-1" aria-hidden="true" />
      <div className="admin-bg-glow-2" aria-hidden="true" />

      {/* Luxury Navigation Header */}
      <header className="admin-nav-header">
        <div className="admin-nav-container">
          <div className="admin-nav-left">
            <button className="admin-back-btn" onClick={() => navigate('/')} title="Về trang chủ">
              <ArrowLeft size={18} />
              <span>Quay lại DoroStudy</span>
            </button>
            <div className="admin-nav-divider" />
            <div className="admin-brand-tag">
              <ShieldCheck size={18} className="admin-shield-icon" />
              <span>PORTAL QUẢN TRỊ VIÊN</span>
            </div>
          </div>

          <div className="admin-nav-right">
            <button
              className={`admin-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={() => fetchFeedbacks(true)}
              disabled={refreshing}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={16} />
              <span>{refreshing ? 'Đang làm mới…' : 'Làm mới'}</span>
            </button>

            <div className="admin-profile-badge">
              <div className="admin-avatar">
                {currentUser?.image ? (
                  <img src={currentUser.image} alt={currentUser.name || 'Admin'} />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="admin-info">
                <span className="admin-name">{currentUser?.name || currentUser?.username || 'Admin'}</span>
                <span className="admin-role-pill">ADMINISTRATOR</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="admin-content-container">
        {/* Title Hero */}
        <section className="admin-hero-section">
          <span className="admin-hero-eyebrow">DOROSTUDY / LẮNG NGHE NGƯỜI DÙNG</span>
          <h1 className="admin-hero-title">Danh Sách Góp Ý & Phản Hồi</h1>
          <p className="admin-hero-subtitle">
            Tổng hợp tất cả ý kiến trải nghiệm người dùng, đề xuất tính năng và phản hồi chất lượng AI Reflection.
          </p>
        </section>

        {/* Stats KPI Overview */}
        <section className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="stat-card-header">
              <span className="stat-label">TỔNG GÓP Ý</span>
              <div className="stat-icon-wrapper blue">
                <MessageSquare size={20} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-subtext">Đã ghi nhận trong hệ thống</span>
            </div>
          </div>

          <div className="admin-stat-card highlight">
            <div className="stat-card-header">
              <span className="stat-label">GÓP Ý MỚI</span>
              <div className="stat-icon-wrapper amber">
                <Sparkles size={20} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-number">{stats.newCount}</span>
              <span className="stat-subtext">Cần xem xét và xử lý</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-card-header">
              <span className="stat-label">GIAO DIỆN & TRẢI NGHIỆM</span>
              <div className="stat-icon-wrapper cyan">
                <Layout size={20} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-number">{stats.uxCount}</span>
              <span className="stat-subtext">Góp ý về UI/UX tính năng</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-card-header">
              <span className="stat-label">AI REFLECTION</span>
              <div className="stat-icon-wrapper purple">
                <Bot size={20} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-number">{stats.aiCount}</span>
              <span className="stat-subtext">Đánh giá chất lượng lời khuyên</span>
            </div>
          </div>
        </section>

        {/* Filters and Search Bar */}
        <section className="admin-toolbar-card">
          <div className="toolbar-search-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo nội dung, tên người dùng, email, tính năng…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="toolbar-search-input"
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                ×
              </button>
            )}
          </div>

          <div className="toolbar-filters-group">
            {/* Kind filter */}
            <div className="filter-chip-group">
              <span className="filter-group-label">Phân loại:</span>
              <button
                className={`filter-chip ${filterKind === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterKind('ALL')}
              >
                Tất cả
              </button>
              <button
                className={`filter-chip ${filterKind === 'ux' ? 'active' : ''}`}
                onClick={() => setFilterKind('ux')}
              >
                Giao diện (UX)
              </button>
              <button
                className={`filter-chip ${filterKind === 'ai' ? 'active' : ''}`}
                onClick={() => setFilterKind('ai')}
              >
                AI Reflection
              </button>
            </div>

            {/* Status filter */}
            <div className="filter-chip-group">
              <span className="filter-group-label">Trạng thái:</span>
              <button
                className={`filter-chip ${filterStatus === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ALL')}
              >
                Tất cả
              </button>
              <button
                className={`filter-chip ${filterStatus === 'NEW' ? 'active' : ''}`}
                onClick={() => setFilterStatus('NEW')}
              >
                Mới
              </button>
              <button
                className={`filter-chip ${filterStatus === 'READ' ? 'active' : ''}`}
                onClick={() => setFilterStatus('READ')}
              >
                Đã xem
              </button>
              <button
                className={`filter-chip ${filterStatus === 'RESOLVED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('RESOLVED')}
              >
                Đã xử lý
              </button>
            </div>

            {/* Area select */}
            <div className="filter-select-wrapper">
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                className="toolbar-area-select"
              >
                <option value="ALL">Khu vực: Tất cả ({AREAS.length})</option>
                {AREAS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
          </div>
        </section>

        {/* Feedback List Section */}
        <section className="admin-feedbacks-section">
          <div className="section-header-row">
            <h2 className="section-title">
              Danh sách kết quả ({filteredFeedbacks.length})
            </h2>
            {(searchTerm || filterKind !== 'ALL' || filterStatus !== 'ALL' || filterArea !== 'ALL') && (
              <button
                className="reset-filters-btn"
                onClick={() => {
                  setSearchTerm('');
                  setFilterKind('ALL');
                  setFilterStatus('ALL');
                  setFilterArea('ALL');
                }}
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>

          {loading ? (
            <div className="admin-loading-state">
              <div className="admin-spinner" />
              <p>Đang tải danh sách góp ý…</p>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="admin-empty-card">
              <div className="empty-icon-box">
                <Inbox size={42} />
              </div>
              <h3 className="empty-title">Không tìm thấy góp ý nào</h3>
              <p className="empty-desc">
                {searchTerm || filterKind !== 'ALL' || filterStatus !== 'ALL' || filterArea !== 'ALL'
                  ? 'Không có góp ý nào khớp với bộ lọc hiện tại. Hãy thử đổi từ khóa tìm kiếm.'
                  : 'Hiện tại hệ thống chưa nhận được phản hồi góp ý nào.'}
              </p>
            </div>
          ) : (
            <div className="admin-feedback-grid">
              {filteredFeedbacks.map((item) => {
                const isAi = item.kind?.toLowerCase() === 'ai';
                return (
                  <article key={item.id} className={`feedback-card status-${item.status?.toLowerCase()}`}>
                    {/* Header */}
                    <div className="feedback-card-header">
                      <div className="feedback-user-info">
                        <div className="feedback-user-avatar">
                          {item.userName ? item.userName.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <div className="feedback-user-meta">
                          <span className="feedback-author-name">
                            {item.userName || 'Khách (Chưa đăng nhập)'}
                          </span>
                          <span className="feedback-author-email">
                            {item.userEmail ? item.userEmail : 'Không có email'}
                          </span>
                        </div>
                      </div>

                      <div className="feedback-badges-group">
                        <span className={`kind-badge ${isAi ? 'badge-ai' : 'badge-ux'}`}>
                          {isAi ? <Bot size={13} /> : <Layout size={13} />}
                          {isAi ? 'AI Reflection' : 'Giao diện & Trải nghiệm'}
                        </span>
                        <span className={`status-badge status-${item.status?.toLowerCase()}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    </div>

                    {/* Comment Content */}
                    <div className="feedback-comment-box">
                      {item.comment ? (
                        <p className="feedback-comment-text">"{item.comment}"</p>
                      ) : (
                        <p className="feedback-comment-text italic-muted">
                          (Người dùng không để lại lời bình mở rộng)
                        </p>
                      )}
                    </div>

                    {/* Attributes Details */}
                    <div className="feedback-details-grid">
                      {item.area && (
                        <div className="detail-item">
                          <span className="detail-label">Phần góp ý:</span>
                          <span className="detail-value highlight">
                            {responseLabel('area', item.area)}
                          </span>
                        </div>
                      )}

                      {item.issueType && (
                        <div className="detail-item">
                          <span className="detail-label">Loại vấn đề:</span>
                          <span className="detail-value">
                            {responseLabel('issue_type', item.issueType)}
                          </span>
                        </div>
                      )}

                      {isAi && item.usefulness && (
                        <div className="detail-item">
                          <span className="detail-label">Độ hữu ích:</span>
                          <div className="rating-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={14}
                                className={star <= item.usefulness ? 'star-filled' : 'star-empty'}
                              />
                            ))}
                            <span className="rating-number">({item.usefulness}/5)</span>
                          </div>
                        </div>
                      )}

                      {isAi && item.actionability && (
                        <div className="detail-item">
                          <span className="detail-label">Độ rõ ràng:</span>
                          <span className="detail-value">
                            {responseLabel('actionability', item.actionability)}
                          </span>
                        </div>
                      )}

                      {isAi && item.distraction && (
                        <div className="detail-item">
                          <span className="detail-label">Tác nhân xao nhãng:</span>
                          <span className="detail-value">
                            {responseLabel('distraction', item.distraction)}
                          </span>
                        </div>
                      )}

                      {isAi && item.copingAction && (
                        <div className="detail-item">
                          <span className="detail-label">Cách đã xử lý:</span>
                          <span className="detail-value">
                            {responseLabel('coping_action', item.copingAction)}
                          </span>
                        </div>
                      )}

                      {isAi && item.outcome && (
                        <div className="detail-item">
                          <span className="detail-label">Kết quả sau đó:</span>
                          <span className="detail-value">
                            {responseLabel('outcome', item.outcome)}
                          </span>
                        </div>
                      )}

                      {isAi && item.requestedSupport && (
                        <div className="detail-item">
                          <span className="detail-label">App nên hỗ trợ:</span>
                          <span className="detail-value highlight">
                            {responseLabel('requested_support', item.requestedSupport)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="feedback-card-footer">
                      <div className="feedback-timestamp">
                        <Clock size={13} />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>

                      <div className="card-actions-row">
                        <div className="status-selector">
                          <span className="status-select-label">Chuyển:</span>
                          {item.status !== 'NEW' && (
                            <button
                              className="btn-status-pill new"
                              onClick={() => handleUpdateStatus(item.id, 'NEW')}
                              title="Đánh dấu là Mới"
                            >
                              Mới
                            </button>
                          )}
                          {item.status !== 'READ' && (
                            <button
                              className="btn-status-pill read"
                              onClick={() => handleUpdateStatus(item.id, 'READ')}
                              title="Đánh dấu đã xem"
                            >
                              Đã xem
                            </button>
                          )}
                          {item.status !== 'RESOLVED' && (
                            <button
                              className="btn-status-pill resolved"
                              onClick={() => handleUpdateStatus(item.id, 'RESOLVED')}
                              title="Đánh dấu đã giải quyết"
                            >
                              Đã xử lý
                            </button>
                          )}
                        </div>

                        <button
                          className="btn-delete-feedback"
                          onClick={() => handleDelete(item.id)}
                          title="Xóa phản hồi này"
                          aria-label="Xóa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
