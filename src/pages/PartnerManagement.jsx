import React, { useState } from 'react';
import { partnerApi } from '../services/api';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';

export default function PartnerManagement({ partners, onDataChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  // 폼 필드
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('매입처'); // '매입처', '매출처', '혼합'

  const resetForm = () => {
    setCode('');
    setName('');
    setOwner('');
    setBizNo('');
    setAddress('');
    setPhone('');
    setType('매입처');
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleEditClick = (p) => {
    setIsEditing(true);
    setCurrentId(p.id);
    setCode(p.code);
    setName(p.name);
    setOwner(p.owner);
    setBizNo(p.biz_no);
    setAddress(p.address);
    setPhone(p.phone);
    setType(p.type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || !name) {
      alert("코드와 거래처명은 필수 입력 항목입니다.");
      return;
    }

    const payload = { code, name, owner, bizNo, address, phone, type };

    try {
      if (isEditing && currentId) {
        await partnerApi.update(currentId, payload);
        alert("거래처 정보가 수정되었습니다.");
      } else {
        await partnerApi.create(payload);
        alert("신규 거래처가 성공적으로 등록되었습니다.");
      }
      resetForm();
      onDataChange();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "거래처 등록 중 에러가 발생했습니다.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("해당 거래처를 정말 삭제하시겠습니까? 거래 내역이 연동되어 있을 수 있습니다.")) return;
    try {
      await partnerApi.delete(id);
      alert("삭제되었습니다.");
      onDataChange();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "삭제에 실패했습니다.");
    }
  };

  const filteredPartners = partners.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.biz_no.includes(searchQuery)
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 거래처 생성 및 수정 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        alignSelf: 'start'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem' }}>
            {isEditing ? '거래처 정보 수정' : '신규 거래처 등록'}
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            매입처, 매출처 및 혼합 거래를 위한 인적 사항 사전을 관리합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>거래처 코드</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: P-1002"
            />
          </div>

          <div className="form-group">
            <label>상호명 (법인/개인 상호)</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: (주)한라식품"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>대표자 성명</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="예: 김민수"
              />
            </div>
            <div className="form-group">
              <label>사업자 등록 번호</label>
              <input
                type="text"
                value={bizNo}
                onChange={(e) => setBizNo(e.target.value)}
                placeholder="예: 000-00-00000"
              />
            </div>
          </div>

          <div className="form-group">
            <label>대표 연락처</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예: 02-123-4567"
            />
          </div>

          <div className="form-group">
            <label>사업장 소재지 (주소)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울시 서초구 서초대로 12"
            />
          </div>

          <div className="form-group">
            <label>거래처 구분</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="매입처">매입처 (자재 공급처)</option>
              <option value="매출처">매출처 (납품 고객사)</option>
              <option value="혼합">혼합 (매출/매입 혼합)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {isEditing && (
              <button
                type="button"
                className="btn"
                onClick={resetForm}
                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {isEditing ? '정보 수정' : '거래처 등록 저장'}
            </button>
          </div>
        </form>
      </div>

      {/* 우측: 거래처 목록 조회 */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
            등록 거래처 리스트 ({filteredPartners.length}건)
          </h3>
          <div style={{ position: 'relative', width: '200px' }}>
            <Search style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '14px',
              height: '14px',
              color: 'var(--text-muted)'
            }} />
            <input
              type="text"
              placeholder="상호, 사업자번호 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                fontSize: '0.8rem',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>코드</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>구분</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>상호명</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>대표자</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>사업자번호</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>연락처</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    등록되었거나 검색어에 부합하는 거래처 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredPartners.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.code}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 6px',
                        background: p.type === '매입처' ? 'rgba(239, 68, 68, 0.15)' : p.type === '매출처' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: p.type === '매입처' ? '#ef4444' : p.type === '매출처' ? '#34d399' : '#f59e0b',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {p.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                    <td style={{ padding: '8px' }}>{p.owner}</td>
                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{p.biz_no}</td>
                    <td style={{ padding: '8px' }}>{p.phone}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 6px', background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                          onClick={() => handleEditClick(p)}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '3px 6px' }}
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 size={12} />
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
  );
}
