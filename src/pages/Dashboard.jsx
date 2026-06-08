import React from 'react';
import { DollarSign, ShoppingCart, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export default function Dashboard({ products, partners, invoices }) {
  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 통계 계산
  const getStats = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const yyyymm = `${currentYear}-${currentMonth}`; // 'YYYY-MM'

    let monthSales = 0;
    let monthPurchase = 0;
    let totalReceivables = 0; // 매출 중 미수금 (청구(외상))
    let totalPayables = 0;    // 매입 중 미지급금 (청구(외상))

    invoices.forEach(inv => {
      const isCurrentMonth = inv.date.startsWith(yyyymm);
      const isCredit = inv.status === '청구(외상)';

      if (inv.type === 'sales') {
        if (isCurrentMonth) monthSales += inv.total_sum;
        if (isCredit) totalReceivables += inv.total_sum;
      } else if (inv.type === 'purchase') {
        if (isCurrentMonth) monthPurchase += inv.total_sum;
        if (isCredit) totalPayables += inv.total_sum;
      }
    });

    return {
      monthSales,
      monthPurchase,
      totalReceivables,
      totalPayables
    };
  };

  const stats = getStats();
  const recentInvoices = invoices.slice(0, 5); // 최근 5건

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 대시보드 타이틀 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>대시보드 종합 현황</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>당월 실시간 회계 연산 데이터 및 자금 흐름을 시각적으로 파악합니다.</p>
      </div>

      {/* 실시간 주요 지표 카드 그리드 */}
      <div className="dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {/* 당월 매출 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left'
        }}>
          <div>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>당월 매출 총액</p>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#a8e6cf', fontWeight: '800', fontFamily: 'monospace' }}>
              {formatNumber(stats.monthSales)}원
            </h3>
          </div>
          <div style={{
            background: 'rgba(168, 230, 207, 0.15)',
            color: '#a8e6cf',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <ArrowUpRight size={24} />
          </div>
        </div>

        {/* 당월 매입 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left'
        }}>
          <div>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>당월 매입 총액</p>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#ffb3b3', fontWeight: '800', fontFamily: 'monospace' }}>
              {formatNumber(stats.monthPurchase)}원
            </h3>
          </div>
          <div style={{
            background: 'rgba(255, 179, 179, 0.15)',
            color: '#ffb3b3',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <ArrowDownRight size={24} />
          </div>
        </div>

        {/* 총 미수금 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left'
        }}>
          <div>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>총 외상 미수금 (매출)</p>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#ffd3b6', fontWeight: '800', fontFamily: 'monospace' }}>
              {formatNumber(stats.totalReceivables)}원
            </h3>
          </div>
          <div style={{
            background: 'rgba(255, 211, 182, 0.15)',
            color: '#ffd3b6',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <DollarSign size={24} />
          </div>
        </div>

        {/* 총 미지급금 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left'
        }}>
          <div>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>총 외상 미지급금 (매입)</p>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#dcedc1', fontWeight: '800', fontFamily: 'monospace' }}>
              {formatNumber(stats.totalPayables)}원
            </h3>
          </div>
          <div style={{
            background: 'rgba(220, 237, 193, 0.15)',
            color: '#dcedc1',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <ShoppingCart size={24} />
          </div>
        </div>
      </div>

      {/* 하단 섹션: 최근 전표 내역 및 재고 위험 상품 알림 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
        {/* 최근 전표 목록 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: 'var(--primary-color)' }} />
            최근 작성 전표 내역
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>일자</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>구분</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>거래처</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>총액</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      최근 등록된 거래 전표 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px 8px' }}>{inv.date}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: inv.type === 'sales' ? 'rgba(168, 230, 207, 0.15)' : 'rgba(255, 179, 179, 0.15)',
                          color: inv.type === 'sales' ? '#a8e6cf' : '#ffb3b3'
                        }}>
                          {inv.type === 'sales' ? '매출' : '매입'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>{inv.partner_name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {formatNumber(inv.total_sum)}원
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: inv.status === '영수(완납)' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: inv.status === '영수(완납)' ? '#34d399' : '#f59e0b'
                        }}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 품목 현황 및 알림 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>상품 품목 개요</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>등록 상품 수</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{products.length} 품목</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>등록 거래처 수</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{partners.length} 업체</div>
            </div>
            
            {/* 재고가 0이거나 위험 품목 알림 */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fca5a5', marginBottom: '8px' }}>⚠️ 품절/재고 부족 위험 (5건 이하)</div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {products.filter(p => p.stock <= 5).slice(0, 3).map(p => (
                  <li key={p.id}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{p.name}</span>: {p.stock} {p.unit}
                  </li>
                ))}
                {products.filter(p => p.stock <= 5).length === 0 && (
                  <li style={{ listStyle: 'none', paddingLeft: 0, color: 'var(--text-muted)' }}>현재 품절 및 재고 위험 상품이 없습니다.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
