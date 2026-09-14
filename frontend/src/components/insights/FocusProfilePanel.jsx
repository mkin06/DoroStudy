import React, { useEffect, useMemo, useState } from 'react';
import './FocusProfilePanel.css';
import { reflectionAPI } from '../../api/reflection';
import { scoreBand } from '../../utils/scoreLabel';

// Thứ tự cột của bản đồ giờ vàng — khớp với DAY_PARTS trong FocusInsightEngine.java
const DAY_PART_ORDER = ['morning', 'afternoon', 'evening', 'night'];
const DAY_PART_LABELS = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  evening: 'Tối',
  night: 'Khuya',
};

/**
 * Ramp xanh tuần tự (một sắc, sáng → đậm) cho độ lớn của điểm tập trung.
 *
 * Trên nền tối thì đảo chiều so với nền sáng: điểm THẤP lùi về gần màu nền, điểm CAO
 * sáng nhất. Nếu để điểm cao là màu đậm thì ô quan trọng nhất lại biến mất vào nền.
 *
 * Bước đậm nhất chỉ đạt ~2.15:1 so với nền, nên MỌI ô đều in kèm con số — màu chỉ là
 * kênh phụ, không phải kênh duy nhất mang nghĩa.
 */
const RAMP = ['#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef'];

function rampColor(score) {
  const clamped = Math.max(0, Math.min(100, score));
  const index = Math.min(RAMP.length - 1, Math.floor((clamped / 100) * RAMP.length));
  return RAMP[index];
}

/** Chữ trên ô: bước sáng cần chữ tối, bước đậm cần chữ sáng. */
function inkFor(score) {
  return score >= 72 ? '#0b1a2e' : '#ffffff';
}

export default function FocusProfilePanel({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    reflectionAPI
      .getInsights()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Không tải được hồ sơ tập trung.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pivot danh sách ô phẳng thành lưới môn × buổi
  const grid = useMemo(() => {
    if (!profile?.heatmap?.length) return null;
    const subjects = [];
    const byKey = new Map();
    for (const cell of profile.heatmap) {
      if (!subjects.includes(cell.subject)) subjects.push(cell.subject);
      byKey.set(`${cell.subject}|${cell.dayPart}`, cell);
    }
    // Chỉ giữ cột thật sự có dữ liệu — cột trống hoàn toàn chỉ làm loãng bảng
    const columns = DAY_PART_ORDER.filter((part) =>
      subjects.some((s) => byKey.has(`${s}|${part}`))
    );
    return { subjects, columns, byKey };
  }, [profile]);

  return (
    <div className="fp-backdrop" role="dialog" aria-modal="true" aria-label="Hồ sơ tập trung">
      <div className="fp-panel">
        <button className="fp-close" onClick={onClose} aria-label="Đóng">✕</button>

        <header className="fp-header">
          <h2>🧬 Focus DNA</h2>
          <p>Hồ sơ tập trung riêng của bạn, dựng từ chính các phiên bạn đã học.</p>
        </header>

        {loading && <div className="fp-loading">Đang dựng hồ sơ…</div>}
        {error && <div className="fp-error">{error}</div>}

        {profile && !loading && (
          <>
            {profile.totalSessions === 0 ? (
              <div className="fp-empty">
                <span className="fp-empty-icon">🌱</span>
                <p>{profile.consistency?.message}</p>
              </div>
            ) : (
              <>
                {/* Hero: con số dashboard dẫn dắt */}
                <section className="fp-hero">
                  <div className="fp-hero-figure">
                    {Math.round(profile.averageFocusScore ?? 0)}
                    <span className="fp-hero-unit">/100</span>
                  </div>
                  <div className="fp-hero-meta">
                    <span className="fp-hero-label">
                      {scoreBand(profile.averageFocusScore).emoji}{' '}
                      Trung bình: {scoreBand(profile.averageFocusScore).label}
                    </span>
                    <span className="fp-hero-sub">
                      {profile.totalSessions} phiên · cao nhất {Math.round(profile.bestFocusScore ?? 0)}
                      {' · '}{profile.tierName}
                    </span>
                  </div>
                </section>

                {/* KPI row — mỗi ô một con số kèm nhãn, không phải biểu đồ 1 cột */}
                <section className="fp-tiles">
                  <div className="fp-tile">
                    <span className="fp-tile-icon">🔥</span>
                    <strong>{profile.consistency?.currentStreakDays ?? 0} ngày</strong>
                    <span className="fp-tile-label">
                      Chuỗi hiện tại · kỷ lục {profile.consistency?.bestStreakDays ?? 0}
                    </span>
                  </div>
                  <div className="fp-tile">
                    <span className="fp-tile-icon">⏱️</span>
                    <strong>
                      {profile.suggestedDurationMinutes ? `${profile.suggestedDurationMinutes} phút` : '—'}
                    </strong>
                    <span className="fp-tile-label">Độ dài phiên phù hợp nhất</span>
                  </div>
                  <div className="fp-tile">
                    <span className="fp-tile-icon">🔋</span>
                    <strong>
                      {profile.energyDropAfterMinutes ? `${profile.energyDropAfterMinutes} phút` : '—'}
                    </strong>
                    <span className="fp-tile-label">Ngưỡng cạn năng lượng</span>
                  </div>
                </section>

                {/* Bản đồ giờ vàng: môn × buổi */}
                {grid && (
                  <section className="fp-section">
                    <div className="fp-section-head">
                      <h3>🗺️ Bản đồ giờ vàng</h3>
                      <button
                        className="fp-toggle"
                        onClick={() => setShowTable((v) => !v)}
                        aria-pressed={showTable}
                      >
                        {showTable ? 'Xem bản đồ' : 'Xem dạng bảng'}
                      </button>
                    </div>
                    <p className="fp-section-note">
                      Điểm trung bình của từng môn theo buổi. Ô càng sáng càng tốt; ô trống
                      là buổi bạn chưa từng học môn đó.
                    </p>

                    {showTable ? (
                      <table className="fp-table">
                        <thead>
                          <tr>
                            <th>Môn</th>
                            {grid.columns.map((part) => (
                              <th key={part}>{DAY_PART_LABELS[part]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {grid.subjects.map((subject) => (
                            <tr key={subject}>
                              <th scope="row">{subject}</th>
                              {grid.columns.map((part) => {
                                const cell = grid.byKey.get(`${subject}|${part}`);
                                return (
                                  <td key={part}>
                                    {cell ? `${Math.round(cell.avgScore)} (${cell.sessions} phiên)` : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div
                        className="fp-heatmap"
                        style={{ gridTemplateColumns: `minmax(64px, 1fr) repeat(${grid.columns.length}, 1fr)` }}
                      >
                        <div className="fp-heat-corner" />
                        {grid.columns.map((part) => (
                          <div key={part} className="fp-heat-colhead">{DAY_PART_LABELS[part]}</div>
                        ))}

                        {grid.subjects.map((subject) => (
                          <React.Fragment key={subject}>
                            <div className="fp-heat-rowhead" title={subject}>{subject}</div>
                            {grid.columns.map((part) => {
                              const cell = grid.byKey.get(`${subject}|${part}`);
                              if (!cell) {
                                return (
                                  <div key={part} className="fp-heat-cell empty" aria-label="Không có dữ liệu">
                                    –
                                  </div>
                                );
                              }
                              const score = Math.round(cell.avgScore);
                              return (
                                <div
                                  key={part}
                                  className="fp-heat-cell"
                                  style={{ background: rampColor(cell.avgScore), color: inkFor(cell.avgScore) }}
                                  title={`${subject} · ${DAY_PART_LABELS[part]}: ${score} điểm, ${cell.sessions} phiên`}
                                >
                                  <span className="fp-heat-value">{score}</span>
                                  <span className="fp-heat-count">{cell.sessions}p</span>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Duy trì thói quen */}
                {profile.consistency && (
                  <section className={`fp-consistency ${profile.consistency.atRisk ? 'risk' : ''}`}>
                    <span className="fp-consistency-icon">
                      {profile.consistency.atRisk ? '⚠️' : '🔥'}
                    </span>
                    <div>
                      <strong>{profile.consistency.atRisk ? 'Nhịp học đang thưa dần' : 'Nhịp học đang ổn'}</strong>
                      <p>{profile.consistency.message}</p>
                    </div>
                  </section>
                )}

                {/* Toàn bộ phát hiện */}
                {profile.discoveries?.length > 0 && (
                  <section className="fp-section">
                    <h3>✨ Những gì AI đã tìm ra về bạn</h3>
                    <div className="fp-discoveries">
                      {profile.discoveries.map((d) => (
                        <article key={d.id} className="fp-discovery">
                          <span className="fp-discovery-icon">{d.icon}</span>
                          <div className="fp-discovery-body">
                            <strong>{d.title}</strong>
                            <p>{d.detail}</p>
                            <div className="fp-discovery-foot">
                              <span>{d.evidence}</span>
                              <span className="fp-meter" title={`Độ tin cậy ${d.confidence}%`}>
                                <span className="fp-meter-fill" style={{ width: `${d.confidence}%` }} />
                              </span>
                              <span>{d.confidence}%</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {/* Mốc mở khoá kế tiếp */}
                {profile.nextUnlockName && profile.sessionsToNextUnlock > 0 && (
                  <section className="fp-unlock">
                    🔓 Còn <strong>{profile.sessionsToNextUnlock} phiên</strong> nữa để mở khoá{' '}
                    <strong>{profile.nextUnlockName}</strong>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
