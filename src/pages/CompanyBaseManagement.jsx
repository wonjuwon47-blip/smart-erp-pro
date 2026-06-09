import React, { useState, useEffect } from 'react';
import { hqApi, employeeApi, bankApi } from '../services/api';
import { Building2, Users, Landmark, Plus, Trash2, Award, Upload } from 'lucide-react';

export default function CompanyBaseManagement() {
  const [activeSubTab, setActiveSubTab] = useState('hq');
  
  // 데이터 상태
  const [hqs, setHqs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);

  // 본사 입력 상태
  const [hqName, setHqName] = useState('');
  const [hqRegNo, setHqRegNo] = useState('');
  const [hqOwner, setHqOwner] = useState('');
  const [hqAddress, setHqAddress] = useState('');
  const [hqPhone, setHqPhone] = useState('');
  const [hqBusiness, setHqBusiness] = useState('');
  const [hqStamp, setHqStamp] = useState('');

  // 사원 입력 상태
  const [empCode, setEmpCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empPosition, setEmpPosition] = useState('');
  const [empPhone, setEmpPhone] = useState('');

  // 은행 계좌 입력 상태
  const [bankName, setBankName] = useState('');
  const [bankAccNo, setBankAccNo] = useState('');
  const [bankOwner, setBankOwner] = useState('');
  const [bankBalance, setBankBalance] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'hq') {
        const data = await hqApi.getAll();
        setHqs(data);
      } else if (activeSubTab === 'employee') {
        const data = await employeeApi.getAll();
        setEmployees(data);
      } else if (activeSubTab === 'bank') {
        const data = await bankApi.getAll();
        setBanks(data);
      }
    } catch (err) {
      console.error("Fetch data error in base management:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 본사 등록
  const handleAddHq = async (e) => {
    e.preventDefault();
    if (!hqName) return;
    try {
      await hqApi.create({
        name: hqName,
        regNo: hqRegNo,
        owner: hqOwner,
        address: hqAddress,
        phone: hqPhone,
        business: hqBusiness,
        stamp: hqStamp
      });
      alert("본사 사업소가 성공적으로 등록되었습니다.");
      setHqName('');
      setHqRegNo('');
      setHqOwner('');
      setHqAddress('');
      setHqPhone('');
      setHqBusiness('');
      setHqStamp('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert("본사 등록에 실패했습니다.");
    }
  };

  // 본사 삭제
  const handleDeleteHq = async (id) => {
    if (hqs.length <= 1) {
      alert("최소 1개 이상의 본사 정보가 등록되어 있어야 합니다.");
      return;
    }
    if (!confirm("해당 사업소 정보를 삭제하시겠습니까?")) return;
    try {
      await hqApi.delete(id);
      alert("삭제되었습니다.");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // 도장 이미지 파일 업로드
  const handleStampUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setHqStamp(evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  // 사원 등록
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empCode || !empName) return;
    try {
      await employeeApi.create({
        code: empCode,
        name: empName,
        dept: empDept,
        position: empPosition,
        phone: empPhone
      });
      alert("사원이 성공적으로 임용 등록되었습니다.");
      setEmpCode('');
      setEmpName('');
      setEmpDept('');
      setEmpPosition('');
      setEmpPhone('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert("사원 등록에 실패했습니다.");
    }
  };

  // 사원 삭제
  const handleDeleteEmployee = async (id) => {
    if (!confirm("해당 사원 정보를 영구 삭제하시겠습니까?")) return;
    try {
      await employeeApi.delete(id);
      alert("사원 정보가 제거되었습니다.");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // 금융 계좌 등록
  const handleAddBank = async (e) => {
    e.preventDefault();
    if (!bankName || !bankAccNo) return;
    try {
      await bankApi.create({
        name: bankName,
        accNo: bankAccNo,
        owner: bankOwner,
        balance: bankBalance
      });
      alert("신규 금융 계좌가 개설 등록되었습니다.");
      setBankName('');
      setBankAccNo('');
      setBankOwner('');
      setBankBalance('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert("계좌 등록에 실패했습니다.");
    }
  };

  // 금융 계좌 삭제
  const handleDeleteBank = async (id) => {
    if (!confirm("해당 은행 계좌 정보를 시스템에서 삭제하시겠습니까?")) return;
    try {
      await bankApi.delete(id);
      alert("계좌 정보가 삭제되었습니다.");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>회사 / 부서 / 은행 관리</h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          사업소 기초 정보, 사원 명부 및 회사 금융 원장을 기입하고 제어합니다.
        </p>
      </div>

      {/* 서브탭 내비게이션 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: '8px'
      }}>
        <button
          onClick={() => setActiveSubTab('hq')}
          style={{
            padding: '8px 16px',
            background: activeSubTab === 'hq' ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
            color: activeSubTab === 'hq' ? '#fff' : 'rgba(255,255,255,0.5)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: activeSubTab === 'hq' ? 'bold' : 'normal'
          }}
        >
          <Building2 size={16} />
          본사 사업소 관리
        </button>
        <button
          onClick={() => setActiveSubTab('employee')}
          style={{
            padding: '8px 16px',
            background: activeSubTab === 'employee' ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
            color: activeSubTab === 'employee' ? '#fff' : 'rgba(255,255,255,0.5)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: activeSubTab === 'employee' ? 'bold' : 'normal'
          }}
        >
          <Users size={16} />
          부서 사원 관리
        </button>
        <button
          onClick={() => setActiveSubTab('bank')}
          style={{
            padding: '8px 16px',
            background: activeSubTab === 'bank' ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
            color: activeSubTab === 'bank' ? '#fff' : 'rgba(255,255,255,0.5)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: activeSubTab === 'bank' ? 'bold' : 'normal'
          }}
        >
          <Landmark size={16} />
          금융 계좌 관리
        </button>
      </div>

      {/* 탭 본문 내용 */}
      {activeSubTab === 'hq' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }} className="responsive-split">
          {/* 본사 등록 폼 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            alignSelf: 'start'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-color)' }}>본사 신규 등록</h3>
            <form onSubmit={handleAddHq} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>상호명 (사업소명)</label>
                <input type="text" required value={hqName} onChange={e => setHqName(e.target.value)} placeholder="(주)푸드유통 서울본사" />
              </div>
              <div className="form-group">
                <label>사업자 등록 번호</label>
                <input type="text" value={hqRegNo} onChange={e => setHqRegNo(e.target.value)} placeholder="120-81-12345" />
              </div>
              <div className="form-group">
                <label>대표자 성명</label>
                <input type="text" value={hqOwner} onChange={e => setHqOwner(e.target.value)} placeholder="김대표" />
              </div>
              <div className="form-group">
                <label>사업소 소재지 (주소)</label>
                <input type="text" value={hqAddress} onChange={e => setHqAddress(e.target.value)} placeholder="서울특별시 강남구 테헤란로 501" />
              </div>
              <div className="form-group">
                <label>대표 전화번호</label>
                <input type="text" value={hqPhone} onChange={e => setHqPhone(e.target.value)} placeholder="02-555-9988" />
              </div>
              <div className="form-group">
                <label>업태 및 종목</label>
                <input type="text" value={hqBusiness} onChange={e => setHqBusiness(e.target.value)} placeholder="도소매 / 농수산물" />
              </div>
              
              {/* 도장 등록 */}
              <div className="form-group">
                <label>서명 직인/도장 등록</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="file" id="stamp-file-input" accept="image/*" style={{ display: 'none' }} onChange={handleStampUpload} />
                  <button type="button" className="btn" style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)' }} onClick={() => document.getElementById('stamp-file-input').click()}>
                    <Upload size={14} style={{ marginRight: '6px' }} />
                    직인 찾기
                  </button>
                  {hqStamp && (
                    <div style={{ width: '36px', height: '36px', background: '#fff', borderRadius: '4px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={hqStamp} alt="stamp preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                <Plus size={16} />
                사업소 등록
              </button>
            </form>
          </div>

          {/* 본사 목록 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>등록 본사 일람</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '8px' }}>상호명</th>
                    <th style={{ padding: '8px' }}>등록번호</th>
                    <th style={{ padding: '8px' }}>대표자</th>
                    <th style={{ padding: '8px' }}>소재지</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>직인</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {hqs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>등록된 사업소 정보가 없습니다.</td>
                    </tr>
                  ) : (
                    hqs.map(hq => (
                      <tr key={hq.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{hq.name}</td>
                        <td style={{ padding: '8px' }}>{hq.reg_no}</td>
                        <td style={{ padding: '8px' }}>{hq.owner}</td>
                        <td style={{ padding: '8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hq.address}>{hq.address}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {hq.stamp ? (
                            <img src={hq.stamp} style={{ width: '24px', height: '24px', objectFit: 'contain', background: '#fff', borderRadius: '4px', padding: '1px' }} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>미등록</span>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDeleteHq(hq.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'employee' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }} className="responsive-split">
          {/* 사원 등록 폼 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            alignSelf: 'start'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-color)' }}>사원 등록</h3>
            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>사원 코드</label>
                <input type="text" required value={empCode} onChange={e => setEmpCode(e.target.value)} placeholder="E003" />
              </div>
              <div className="form-group">
                <label>성명</label>
                <input type="text" required value={empName} onChange={e => setEmpName(e.target.value)} placeholder="김동아" />
              </div>
              <div className="form-group">
                <label>소속 부서</label>
                <input type="text" value={empDept} onChange={e => setEmpDept(e.target.value)} placeholder="영업기획팀" />
              </div>
              <div className="form-group">
                <label>직급</label>
                <input type="text" value={empPosition} onChange={e => setEmpPosition(e.target.value)} placeholder="대리" />
              </div>
              <div className="form-group">
                <label>연락처</label>
                <input type="text" value={empPhone} onChange={e => setEmpPhone(e.target.value)} placeholder="010-1234-5678" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                <Plus size={16} />
                임용 등록
              </button>
            </form>
          </div>

          {/* 사원 목록 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>사원 명부</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '8px' }}>사원코드</th>
                    <th style={{ padding: '8px' }}>성명</th>
                    <th style={{ padding: '8px' }}>부서</th>
                    <th style={{ padding: '8px' }}>직급</th>
                    <th style={{ padding: '8px' }}>연락처</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>등록된 사원 정보가 없습니다.</td>
                    </tr>
                  ) : (
                    employees.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px' }}><code>{emp.code}</code></td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{emp.name}</td>
                        <td style={{ padding: '8px' }}>{emp.dept}</td>
                        <td style={{ padding: '8px' }}>{emp.position}</td>
                        <td style={{ padding: '8px' }}>{emp.phone}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDeleteEmployee(emp.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'bank' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }} className="responsive-split">
          {/* 계좌 등록 폼 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            alignSelf: 'start'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-color)' }}>계좌 개설 등록</h3>
            <form onSubmit={handleAddBank} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>은행명</label>
                <input type="text" required value={bankName} onChange={e => setBankName(e.target.value)} placeholder="신한은행" />
              </div>
              <div className="form-group">
                <label>계좌 번호</label>
                <input type="text" required value={bankAccNo} onChange={e => setBankAccNo(e.target.value)} placeholder="110-382-998877" />
              </div>
              <div className="form-group">
                <label>예금주</label>
                <input type="text" value={bankOwner} onChange={e => setBankOwner(e.target.value)} placeholder="(주)푸드유통본사" />
              </div>
              <div className="form-group">
                <label>초기 잔액 (원)</label>
                <input type="number" value={bankBalance} onChange={e => setBankBalance(e.target.value)} placeholder="45000000" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                <Plus size={16} />
                계좌 등록
              </button>
            </form>
          </div>

          {/* 계좌 목록 */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>금융 원장 계좌 목록</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '8px' }}>은행명</th>
                    <th style={{ padding: '8px' }}>계좌번호</th>
                    <th style={{ padding: '8px' }}>예금주</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>잔액 (원)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>등록된 계좌 정보가 없습니다.</td>
                    </tr>
                  ) : (
                    banks.map(bank => (
                      <tr key={bank.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{bank.name}</td>
                        <td style={{ padding: '8px', fontFamily: 'monospace' }}>{bank.acc_no}</td>
                        <td style={{ padding: '8px' }}>{bank.owner}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                          {formatNumber(bank.balance)} 원
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDeleteBank(bank.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
