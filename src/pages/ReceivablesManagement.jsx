import React, { useState, useEffect } from 'react';
import { receivablesApi } from '../services/api';
import { Landmark, ArrowUpRight, ArrowDownRight, Edit3, X, Save } from 'lucide-react';

export default function ReceivablesManagement() {
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 수동 보정 모달 관련 상태
  const [showForceModal, setShowForceModal] = useState(false);
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editTotalSales, setEditTotalSales] = useState(0);
  const [editRecovered, setEditRecovered] = useState(0);
  const [editTotalPurchases, setEditTotalPurchases] = useState(0);
  const [editPaid, setEditPaid] = useState(0);

  useEffect(() => {
    fetchReceivables();
  }, []);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const data = await receivablesApi.getAll();
      setDataList(data);
    } catch (err) {
      console.error("Fetch receivables error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 수금/지급 등록 단축 기능 (프롬프트 팝업)
  const handleRegisterPayment = async (partnerName, mode) => {
    const labelText = mode === 'recovered' ? '수금액' : '지급액';
    const amountStr = prompt(`[${partnerName}] 거래처의 추가 ${labelText}을 입력해 주세요. (원 단위 숫자만 입력)`);
    if (amountStr === null) return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("올바른 금액 숫자를 입력해 주세요.");
      return;
    }

    try {
      await receivablesApi.update({
        partnerName,
        mode,
        amount
      });
      alert(`${labelText}이 성공적으로 반영되었습니다.`);
      fetchReceivables();
    } catch (err) {
      console.error(err);
      alert("반영에 실패했습니다.");
    }
  };

  // 수동 보정 모달 열기
  const handleOpenForceModal = (item) => {
    setEditPartnerName(item.partnerName);
    setEditTotalSales(item.totalSales);
    setEditRecovered(item.recovered);
    setEditTotalPurchases(item.totalPurchases);
    setEditPaid(item.paid);
    setShowForceModal(true);
  };

  // 수동 보정 저장
  const handleSaveForce = async (e) => {
    e.preventDefault();
    try {
      await receivablesApi.update({
        partnerName: editPartnerName,
        mode: 'force',
        totalSales: editTotalSales,
        recovered: editRecovered,
        totalPurchases: editTotalPurchases,
        paid: editPaid
      });
      alert(`[${editPartnerName}] 거래처의 원장이 성공적으로 수동 보정되었습니다.`);
      setShowForceModal(false);
      fetchReceivables();
    } catch (err) {
      console.error(err);
      alert("원장 보정에 실패했습니다.");
    }
  };

  const salesPartners = dataList.filter(item => item.partnerType === '매출처' || item.partnerType === '혼합');
  const purchasePartners = dataList.filter(item => item.partnerType === '매입처' || item.partnerType === '혼합');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>외상대금 / 미수금 대장 관리</h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          매출 거래처의 미수금 회수(수금) 및 매입처의 미지급금 정산(지급) 현황을 일괄 대조 관리합니다.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="responsive-split">
        
        {/* 좌측: 매출 외상 미수금 대장 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpRight size={20} style={{ color: '#34d399' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>외상 매출금 (미수금) 원장</h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '8px' }}>거래처명</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>총 외상 매출</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>수금 누계</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>미수 잔액</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '20px 0', textAlign: 'center' }}>데이터 로드 중...</td></tr>
                ) : salesPartners.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>외상 거래 내역이 없습니다.</td></tr>
                ) : (
                  salesPartners.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.partnerName}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.totalSales)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#34d399' }}>{formatNumber(item.recovered)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {formatNumber(item.receivableBalance)} 원
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn" style={{ padding: '3px 6px', fontSize: '0.72rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.25)' }} onClick={() => handleRegisterPayment(item.partnerName, 'recovered')}>
                            수금
                          </button>
                          <button className="btn" style={{ padding: '3px 6px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleOpenForceModal(item)}>
                            <Edit3 size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측: 매입 외상 미지급금 대장 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowDownRight size={20} style={{ color: '#f87171' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>외상 매입금 (미지급금) 원장</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '8px' }}>거래처명</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>총 외상 매입</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>지급 누계</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>미지급 잔액</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '20px 0', textAlign: 'center' }}>데이터 로드 중...</td></tr>
                ) : purchasePartners.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>외상 거래 내역이 없습니다.</td></tr>
                ) : (
                  purchasePartners.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.partnerName}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.totalPurchases)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{formatNumber(item.paid)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#fb7185' }}>
                        {formatNumber(item.payableBalance)} 원
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn" style={{ padding: '3px 6px', fontSize: '0.72rem', background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.25)' }} onClick={() => handleRegisterPayment(item.partnerName, 'paid')}>
                            지급
                          </button>
                          <button className="btn" style={{ padding: '3px 6px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleOpenForceModal(item)}>
                            <Edit3 size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 수동 강제 보정 모달 */}
      {showForceModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowForceModal(false)}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>[{editPartnerName}] 거래처 원장 강제 설정</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowForceModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveForce}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  ⚠️ 경고: 자동 전표 집계를 우회하고 데이터베이스 원장 수치(수금/지급 총액)를 강제 설정합니다.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>총 외상 매출 설정 (원)</label>
                    <input type="number" min="0" value={editTotalSales} onChange={e => setEditTotalSales(parseInt(e.target.value, 10) || 0)} />
                  </div>
                  <div className="form-group">
                    <label>총 수금 누계액 (원)</label>
                    <input type="number" min="0" value={editRecovered} onChange={e => setEditRecovered(parseInt(e.target.value, 10) || 0)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>총 외상 매입 설정 (원)</label>
                    <input type="number" min="0" value={editTotalPurchases} onChange={e => setEditTotalPurchases(parseInt(e.target.value, 10) || 0)} />
                  </div>
                  <div className="form-group">
                    <label>총 지급 누계액 (원)</label>
                    <input type="number" min="0" value={editPaid} onChange={e => setEditPaid(parseInt(e.target.value, 10) || 0)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={14} />
                  원장 보정 저장
                </button>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowForceModal(false)}>
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
