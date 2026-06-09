import React, { useState, useEffect } from 'react';
import { hqApi, employeeApi, bankApi } from '../services/api';
import { Building2, Users, Landmark, Plus, Trash2, CheckCircle2, Upload, AlertCircle } from 'lucide-react';

export default function CompanyBaseManagement({ onDataChange }) {
  const [subTab, setSubTab] = useState('hq'); // 'hq', 'emp', 'bank'
  const [loading, setLoading] = useState(false);

  // 데이터 상태
  const [hqList, setHqList] = useState([]);
  const [empList, setEmpList] = useState([]);
  const [bankList, setBankList] = useState([]);

  // 입력 폼 상태 (본사)
  const [hqName, setHqName] = useState('');
  const [hqRegNo, setHqRegNo] = useState('');
  const [hqOwner, setHqOwner] = useState('');
  const [hqAddress, setHqAddress] = useState('');
  const [hqPhone, setHqPhone] = useState('');
  const [hqBusiness, setHqBusiness] = useState('');
  const [hqStamp, setHqStamp] = useState('');

  // 입력 폼 상태 (사원)
  const [empCode, setEmpCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empPosition, setEmpPosition] = useState('');
  const [empPhone, setEmpPhone] = useState('');

  // 입력 폼 상태 (은행)
  const [bankName, setBankName] = useState('');
  const [bankAccNo, setBankAccNo] = useState('');
  const [bankOwner, setBankOwner] = useState('');
  const [bankBalance, setBankBalance] = useState(0);

  useEffect(() => {
    fetchData();
  }, [subTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (subTab === 'hq') {
        const data = await hqApi.getAll();
        setHqList(data);
      } else if (subTab === 'emp') {
        const data = await employeeApi.getAll();
        setEmpList(data);
      } else if (subTab === 'bank') {
        const data = await bankApi.getAll();
        setBankList(data);
      }
    } catch (err) {
      console.error("Fetch Base Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 본사 신규 등록
  const handleAddHq = async (e) => {
    e.preventDefault();
    if (!hqName || !hqRegNo || !hqOwner) {
      alert("상호, 등록번호, 대표자명은 필수 값입니다.");
      return;
    }

    try {
      const payload = {
        name: hqName,
        regNo: hqRegNo,
        owner: hqOwner,
        address: hqAddress,
        phone: hqPhone,
        business: hqBusiness,
        stamp: hqStamp
      };
      await hqApi.create(payload);
      alert("본사 정보가 성공적으로 등록되었습니다!");
      
      // 폼 초기화
      setHqName('');
      setHqRegNo('');
      setHqOwner('');
      setHqAddress('');
      setHqPhone('');
      setHqBusiness('');
      setHqStamp('');
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err) {
      alert(err.response?.data?.error || "본사 등록 중 오류가 발생했습니다.");
    }
  };

  // 본사 도장 stamp 등록/변경 (Base64 변환)
  const handleHqStampUpload = (e, index, hqId) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("이미지 파일만 등록할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target.result;
      try {
        const hq = hqList[index];
        const payload = {
          name: hq.name,
          regNo: hq.reg_no,
          owner: hq.owner,
          address: hq.address,
          phone: hq.phone,
          business: hq.business,
          stamp: base64
        };
        await hqApi.update(hqId, payload);
        alert("본사 인감 도장이 성공적으로 등록되었습니다.");
        fetchData();
        if (onDataChange) onDataChange();
      } catch (err) {
        alert("직인 이미지 등록에 실패했습니다.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 본사 인감 이미지 신규 폼 등록용 변환
  const handleNewHqStamp = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setHqStamp(evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  // 활성 본사 변경
  const handleSetActiveHq = async (id) => {
    try {
      await hqApi.setActive(id);
      alert("활성 본사 지정이 완료되었습니다.");
      fetchData();
      
      // 헤더 등에 바인딩할 활성 본사명 로컬스토리지 임시 동기화
      const activeHq = hqList.find(h => h.id === id);
      if (activeHq) {
        localStorage.setItem('smart_erp_hq_info', JSON.stringify({
          hqName: activeHq.name,
          owner: activeHq.owner,
          bizNo: activeHq.reg_no,
          address: activeHq.address,
          phone: activeHq.phone
        }));
      }
      
      if (onDataChange) onDataChange();
    } catch (err) {
      alert("활성 본사 지정에 실패했습니다.");
    }
  };

  // 본사 삭제
  const handleDeleteHq = async (id) => {
    if (!confirm("정말 본사 정보를 삭제하시겠습니까?")) return;
    try {
      await hqApi.delete(id);
      alert("삭제되었습니다.");
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err) {
      alert(err.response?.data?.error || "본사 삭제에 실패했습니다.");
    }
  };

  // 사원 등록
  const handleAddEmp = async (e) => {
    e.preventDefault();
    if (!empCode || !empName) {
      alert("사원코드와 성명은 필수값입니다.");
      return;
    }

    try {
      const payload = {
        code: empCode,
        name: empName,
        dept: empDept,
        position: empPosition,
        phone: empPhone
      };
      await employeeApi.create(payload);
      alert("사원 정보가 등록되었습니다.");
      setEmpCode('');
      setEmpName('');
      setEmpDept('');
      setEmpPosition('');
      setEmpPhone('');
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err) {
      alert(err.response?.data?.error || "사원 등록 중 에러가 발생했습니다.");
    }
  };

  // 사원 삭제
  const handleDeleteEmp = async (id) => {
    if (!confirm("해당 사원 정보를 영구 삭제하시겠습니까?")) return;
    try {
      await employeeApi.delete(id);
      alert("삭제되었습니다.");
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err) {
      alert("사원 삭제에 실패했습니다.");
    }
  };

  // 계좌 등록
  const handleAddBank = async (e) => {
    e.preventDefault();
    if (!bankName || !bankAccNo) {
      alert("은행명과 계좌번호는 필수 값입니다.");
      return;
    }

    try {
      const payload = {
        name: bankName,
        accNo: bankAccNo,
        owner: bankOwner,
        balance: bankBalance
      };
      await bankApi.create(payload);
      alert("금융 계좌가 정상 등록되었습니다.");
      setBankName('');
      setBankAccNo('');
      setBankOwner('');
      setBankBalance(0);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "계좌 등록 중 오류가 발생했습니다.");
    }
  };

  // 계좌 삭제
  const handleDeleteBank = async (id) => {
    if (!confirm("해당 계좌 정보를 삭제하시겠습니까?")) return;
    try {
      await bankApi.delete(id);
      alert("삭제되었습니다.");
      fetchData();
    } catch (err) {
      alert("계좌 정보 삭제 중 에러가 발생했습니다.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'left' }}>
      <div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', color: '#fff' }}>회사/부서/은행 통합 관리</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          회사 전체의 기초 인적사항, 금융 계좌 자산 상황, 부서별 사원 현황을 통제합니다.
        </p>
      </div>

      {/* 이너 탭 네비게이션 */}
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
          onClick={() => setSubTab('hq')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: subTab === 'hq' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
            color: subTab === 'hq' ? '#fff' : 'rgba(255,255,255,0.6)',
            fontWeight: subTab === 'hq' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          <Building2 size={15} />
          회사본사 사업소 관리
        </button>
        <button
          onClick={() => setSubTab('emp')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: subTab === 'emp' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
            color: subTab === 'emp' ? '#fff' : 'rgba(255,255,255,0.6)',
            fontWeight: subTab === 'emp' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          <Users size={15} />
          부서 사원 정보
        </button>
        <button
          onClick={() => setSubTab('bank')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: subTab === 'bank' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
            color: subTab === 'bank' ? '#fff' : 'rgba(255,255,255,0.6)',
            fontWeight: subTab === 'bank' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          <Landmark size={15} />
          금융 계좌 잔액 현황
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }} className="responsive-split">
        
        {/* 좌측: 신규 입력 폼 (글래스모피즘) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          alignSelf: 'start'
        }}>
          {subTab === 'hq' && (
            <form onSubmit={handleAddHq} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#fff' }}>본사 사업소 신규 추가</h3>
              
              <div className="form-group">
                <label>상호 (회사명) *</label>
                <input type="text" required value={hqName} onChange={(e) => setHqName(e.target.value)} placeholder="(주)식품유통 본사" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>대표자명 *</label>
                  <input type="text" required value={hqOwner} onChange={(e) => setHqOwner(e.target.value)} placeholder="홍길동" />
                </div>
                <div className="form-group">
                  <label>사업자 등록번호 *</label>
                  <input type="text" required value={hqRegNo} onChange={(e) => setHqRegNo(e.target.value)} placeholder="123-45-67890" />
                </div>
              </div>
              <div className="form-group">
                <label>전화번호</label>
                <input type="text" value={hqPhone} onChange={(e) => setHqPhone(e.target.value)} placeholder="02-123-4567" />
              </div>
              <div className="form-group">
                <label>업태 / 종목</label>
                <input type="text" value={hqBusiness} onChange={(e) => setHqBusiness(e.target.value)} placeholder="도소매 / 농수산물" />
              </div>
              <div className="form-group">
                <label>사업소 소재지 (주소)</label>
                <input type="text" value={hqAddress} onChange={(e) => setHqAddress(e.target.value)} placeholder="서울특별시 강남구 테헤란로" />
              </div>
              
              <div className="form-group">
                <label>인감 도장 이미지 등록</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="file" accept="image/*" onChange={handleNewHqStamp} id="new-hq-stamp-file" style={{ display: 'none' }} />
                  <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.78rem' }} onClick={() => document.getElementById('new-hq-stamp-file').click()}>
                    <Upload size={14} style={{ marginRight: '4px' }} />
                    파일 선택
                  </button>
                  {hqStamp && (
                    <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', padding: '2px' }}>
                      <img src={hqStamp} alt="stamp preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>본사 추가</button>
            </form>
          )}

          {subTab === 'emp' && (
            <form onSubmit={handleAddEmp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#fff' }}>부서 사원 정보 등록</h3>
              
              <div className="form-group">
                <label>사원 코드 *</label>
                <input type="text" required value={empCode} onChange={(e) => setEmpCode(e.target.value)} placeholder="E001" />
              </div>
              <div className="form-group">
                <label>성명 *</label>
                <input type="text" required value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="김철수" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>부서</label>
                  <input type="text" value={empDept} onChange={(e) => setEmpDept(e.target.value)} placeholder="물류부" />
                </div>
                <div className="form-group">
                  <label>직급</label>
                  <input type="text" value={empPosition} onChange={(e) => setEmpPosition(e.target.value)} placeholder="대리" />
                </div>
              </div>
              <div className="form-group">
                <label>연락처</label>
                <input type="text" value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} placeholder="010-1234-5678" />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>사원 추가</button>
            </form>
          )}

          {subTab === 'bank' && (
            <form onSubmit={handleAddBank} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#fff' }}>금융 주거래 계좌 등록</h3>
              
              <div className="form-group">
                <label>주거래 은행명 *</label>
                <input type="text" required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="신한은행" />
              </div>
              <div className="form-group">
                <label>계좌 번호 *</label>
                <input type="text" required value={bankAccNo} onChange={(e) => setBankAccNo(e.target.value)} placeholder="110-382-998877" />
              </div>
              <div className="form-group">
                <label>예금주명</label>
                <input type="text" value={bankOwner} onChange={(e) => setBankOwner(e.target.value)} placeholder="(주)본사사업소" />
              </div>
              <div className="form-group">
                <label>기초 잔액 (원)</label>
                <input type="number" value={bankBalance} onChange={(e) => setBankBalance(parseInt(e.target.value, 10) || 0)} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>금융계좌 추가</button>
            </form>
          )}
        </div>

        {/* 우측: 데이터 현황 테이블 (글래스모피즘) */}
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
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
              {subTab === 'hq' && '본사 사업소 등록 대장'}
              {subTab === 'emp' && '부서 직원 명부'}
              {subTab === 'bank' && '회사 보유 금융 계좌 대장'}
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {subTab === 'hq' && '여러 개의 사업소를 관리하며 명세서에 인쇄될 대표(활성) 사업소를 토글 선택합니다.'}
              {subTab === 'emp' && '시스템 상에 연계된 전 임직원의 부서 직급 정보를 관리합니다.'}
              {subTab === 'bank' && '거래 대금의 수납 및 이체가 발생하는 주거래 은행 자산 현황입니다.'}
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {subTab === 'hq' && (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>활성</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>상호명</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '100px' }}>등록번호</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '70px' }}>대표</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>소재지</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>인감</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {hqList.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>등록된 본사 정보가 없습니다.</td></tr>
                  ) : (
                    hqList.map((hq, index) => (
                      <tr key={hq.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleSetActiveHq(hq.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: hq.is_active ? 'var(--primary-color)' : 'rgba(255,255,255,0.2)'
                            }}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        </td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{hq.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace' }}>{hq.reg_no}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{hq.owner}</td>
                        <td style={{ padding: '8px', fontSize: '0.78rem' }}>{hq.address}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            {hq.stamp ? (
                              <img src={hq.stamp} alt="seal" style={{ width: '22px', height: '22px', objectFit: 'contain', background: '#fff', padding: '1px', borderRadius: '3px' }} />
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>미등록</span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              id={`stamp-file-input-${index}`}
                              style={{ display: 'none' }}
                              onChange={(e) => handleHqStampUpload(e, index, hq.id)}
                            />
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: '2px 4px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                              onClick={() => document.getElementById(`stamp-file-input-${index}`).click()}
                            >
                              변경
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button className="btn btn-danger" style={{ padding: '4px 6px', fontSize: '0.75rem' }} onClick={() => handleDeleteHq(hq.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {subTab === 'emp' && (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '90px' }}>사원코드</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>성명</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>부서</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>직급</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>연락처</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {empList.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>등록된 임직원 정보가 존재하지 않습니다.</td></tr>
                  ) : (
                    empList.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}><code>{emp.code}</code></td>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{emp.name}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{emp.dept}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{emp.position}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{emp.phone}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button className="btn btn-danger" style={{ padding: '4px 6px', fontSize: '0.75rem' }} onClick={() => handleDeleteEmp(emp.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {subTab === 'bank' && (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>은행명</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>계좌번호</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>예금주</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>보유 잔액</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {bankList.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>금융 거래용 계좌가 등록되어 있지 않습니다.</td></tr>
                  ) : (
                    bankList.map(bank => (
                      <tr key={bank.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{bank.name}</td>
                        <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{bank.acc_no}</td>
                        <td style={{ padding: '10px 8px' }}>{bank.owner}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                          {formatNumber(bank.balance)} 원
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button className="btn btn-danger" style={{ padding: '4px 6px', fontSize: '0.75rem' }} onClick={() => handleDeleteBank(bank.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
