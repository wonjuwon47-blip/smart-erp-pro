import React, { useState, useEffect } from 'react';
import { receivableApi } from '../services/api';
import { ArrowUpRight, ArrowDownRight, Edit3, DollarSign, X } from 'lucide-react';

export default function ReceivablesManagement() {
  const [tab, setTab] = useState('receivable'); // 'receivable' (미수금), 'payable' (미지급금)
  const [loading, setLoading] = useState(false);
  const [receivablesList, setReceivablesList] = useState([]);

  // 수금/지급 등록 모달 상태
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPartnerName, setSelectedPartnerName] = useState('');
  const [payAmount, setPayAmount] = useState(0);

  // 수동 보정 모달 상태
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPartnerName, setAdjustPartnerName] = useState('');
  const [adjustTotalSales, setAdjustTotalSales] = useState('');
  const [adjustRecovered, setAdjustRecovered] = useState(0);
  const [adjustTotalPurchases, setAdjustTotalPurchases] = useState('');
  const [adjustPaid, setAdjustPaid] = useState(0);

  useEffect(() => {
    fetchReceivables();
  }, []);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const data = await receivableApi.getAll();
      setReceivablesList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 수금/지급 등록 단추 누를 시
  const openPayModal = (partnerName) => {
    setSelectedPartnerName(partnerName);
    setPayAmount(0);
    setShowPayModal(true);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (payAmount <= 0) {
      alert("올바른 금액을 입력해 주세요.");
      return;
    }

    try {
      const mode = tab === 'receivable' ? 'recovered' : 'paid';
      await receivableApi.payReceive({
        partnerName: selectedPartnerName,
        mode,
        amount: payAmount
      });
      alert(`${selectedPartnerName} 거래처의 대금 반영이 정상 처리되었습니다.`);
      setShowPayModal(false);
      fetchReceivables();
    } catch (err) {
      alert("대금 수납 처리에 실패했습니다.");
    }
  };

  // 원장 수동 보정 모달 누를 시
  const openAdjustModal = (item) => {
    setAdjustPartnerName(item.partnerName);
    setAdjustTotalSales(item.totalSales);
    setAdjustRecovered(item.recovered);
    setAdjustTotalPurchases(item.totalPurchases);
    setAdjustPaid(item.paid);
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    try {
      await receivableApi.adjust({
        partnerName: adjustPartnerName,
        totalSales: adjustTotalSales,
        recovered: adjustRecovered,
        totalPurchases: adjustTotalPurchases,
        paid: adjustPaid
      });
      alert(`${adjustPartnerName} 거래처 원장 보정이 성공적으로 반영되었습니다.`);
      setShowAdjustModal(false);
      fetchReceivables();
    } catch (err) {
      alert("보정 값 저장에 실패했습니다.");
    }
  };

  const receivables = receivablesList.filter(r => r.partnerType === '매출처' || r.partnerType === '혼합');
  const payables = receivablesList.filter(r => r.partnerType === '매입처' || r.partnerType === '혼합');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'left' }}>
      
      <div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', color: '#fff' }}>외상대금/미수금 대장 관리</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          매출 및 매입 거래에 대한 외상 미수금(받을 돈)과 미지급금(줄 돈) 잔액 대장 목록입니다.
        </p>
      </div>

      {/* 대장 선택 탭 */}
      <div style={{
        display: 'flex',
        gap: '6px',
        background: 'rgba(0,0,0,0.15)',
        padding: '4px',
        borderRadius: '8px',
        alignSelf: 'flex-start',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <button
          onClick={() => setTab('receivable')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: tab === 'receivable' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
            color: tab === 'receivable' ? '#34d399' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: tab === 'receivable' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          <ArrowUpRight size={15} />
          매출처 미수금 (받을 돈)
        </button>
        <button
          onClick={() => setTab('payable')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: tab === 'payable' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
            color: tab === 'payable' ? '#f87171' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: tab === 'payable' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          <ArrowDownRight size={15} />
          매입처 미지급금 (줄 돈)
        </button>
      </div>

      {/* 리스트 테이블 (글래스모피즘) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ overflowX: 'auto' }}>
          {tab === 'receivable' ? (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left' }}>매출처명</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>총 외상 매출액</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>수금 누계액</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>미수금 잔액 (받을돈)</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '200px' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center' }}>집계 데이터 로드 중...</td></tr>
                ) : receivables.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>외상 거래 내역이 존재하지 않습니다.</td></tr>
                ) : (
                  receivables.map(item => (
                    <tr key={item.partnerName} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{item.partnerName}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.totalSales)} 원</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#60a5fa' }}>{formatNumber(item.recovered)} 원</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {formatNumber(item.receivableBalance)} 원
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => openPayModal(item.partnerName)}
                          >
                            <DollarSign size={12} />
                            수금 등록
                          </button>
                          <button
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => openAdjustModal(item)}
                          >
                            <Edit3 size={12} />
                            원장 보정
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left' }}>매입처명</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>총 외상 매입액</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>지급 누계액</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>미지급금 잔액 (줄돈)</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '200px' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center' }}>집계 데이터 로드 중...</td></tr>
                ) : payables.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>외상 매입 거래 내역이 존재하지 않습니다.</td></tr>
                ) : (
                  payables.map(item => (
                    <tr key={item.partnerName} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{item.partnerName}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.totalPurchases)} 원</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{formatNumber(item.paid)} 원</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#fb7185' }}>
                        {formatNumber(item.payableBalance)} 원
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}
                            onClick={() => openPayModal(item.partnerName)}
                          >
                            <DollarSign size={12} />
                            지급 등록
                          </button>
                          <button
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => openAdjustModal(item)}
                          >
                            <Edit3 size={12} />
                            원장 보정
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 수금/지급 등록 팝업 모달 */}
      {showPayModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowPayModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{tab === 'receivable' ? '추가 외상 수금 등록' : '추가 외상 대금 지급 등록'}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowPayModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePaySubmit}>
              <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><strong>거래처명:</strong> {selectedPartnerName}</div>
                <div className="form-group">
                  <label>{tab === 'receivable' ? '추가 수납액 (원)' : '추가 지출액 (원)'}</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(parseInt(e.target.value, 10) || 0)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">등록 완료</button>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowPayModal(false)}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 원장 수동 보정 팝업 모달 */}
      {showAdjustModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowAdjustModal(false)}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>거래처 원장 강제 보정 설정 [{adjustPartnerName}]</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowAdjustModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit}>
              <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  ※ 입력값을 비워둘(빈칸) 경우, 전표(Invoices) 상의 실시간 합계가 자동으로 반영됩니다.
                </p>
                
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary-color)' }}>매출 외상대금 보정 (미수금)</h4>
                  <div className="form-group">
                    <label>총 외상 매출 설정액 (공란 가능)</label>
                    <input
                      type="number"
                      value={adjustTotalSales === null ? '' : adjustTotalSales}
                      onChange={(e) => setAdjustTotalSales(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="설정 안함 (전표 기준)"
                    />
                  </div>
                  <div className="form-group">
                    <label>총 수금 누계액 (원)</label>
                    <input
                      type="number"
                      required
                      value={adjustRecovered}
                      onChange={(e) => setAdjustRecovered(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fb7185' }}>매입 외상대금 보정 (미지급금)</h4>
                  <div className="form-group">
                    <label>총 외상 매입 설정액 (공란 가능)</label>
                    <input
                      type="number"
                      value={adjustTotalPurchases === null ? '' : adjustTotalPurchases}
                      onChange={(e) => setAdjustTotalPurchases(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="설정 안함 (전표 기준)"
                    />
                  </div>
                  <div className="form-group">
                    <label>총 지급 누계액 (원)</label>
                    <input
                      type="number"
                      required
                      value={adjustPaid}
                      onChange={(e) => setAdjustPaid(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">보정값 저장</button>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowAdjustModal(false)}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
