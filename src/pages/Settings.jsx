import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Award, Printer } from 'lucide-react';

export default function Settings({ onDataChange }) {
  // 본사 기본 정보 설정
  const [hqName, setHqName] = useState('본사 사업소');
  const [owner, setOwner] = useState('대표자명');
  const [bizNo, setBizNo] = useState('123-45-67890');
  const [address, setAddress] = useState('서울특별시 서초구 서초대로 123');
  const [phone, setPhone] = useState('02-1234-5678');
  
  // 직인 도장 이미지 (Base64)
  const [sealImage, setSealImage] = useState('');

  useEffect(() => {
    // 기존 설정 로드
    const savedHq = localStorage.getItem('smart_erp_hq_info');
    if (savedHq) {
      try {
        const parsed = JSON.parse(savedHq);
        setHqName(parsed.hqName || '본사 사업소');
        setOwner(parsed.owner || '대표자명');
        setBizNo(parsed.bizNo || '123-45-67890');
        setAddress(parsed.address || '서울특별시 서초구 서초대로 123');
        setPhone(parsed.phone || '02-1234-5678');
      } catch (e) {
        console.error(e);
      }
    }

    const savedSeal = localStorage.getItem('smart_erp_seal_image');
    if (savedSeal) {
      setSealImage(savedSeal);
    }
  }, []);

  const handleSaveHqInfo = (e) => {
    e.preventDefault();
    const info = { hqName, owner, bizNo, address, phone };
    localStorage.setItem('smart_erp_hq_info', JSON.stringify(info));
    alert("본사 사업소 설정이 성공적으로 저장되었습니다!");
    if (onDataChange) onDataChange();
  };

  // 대표자 직인 도장 이미지 업로드 (Base64 변환)
  const handleSealUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result;
      setSealImage(base64);
      localStorage.setItem('smart_erp_seal_image', base64);
      alert("대표자 직인 도장 이미지가 설정되었습니다. 거래명세서 출력 시 대표명 옆에 자동 인쇄됩니다.");
      if (onDataChange) onDataChange();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSealDelete = () => {
    if (!confirm("등록된 대표자 직인 도장 이미지를 삭제하시겠습니까?")) return;
    setSealImage('');
    localStorage.removeItem('smart_erp_seal_image');
    alert("직인 이미지가 삭제되었습니다. 이제 기본 붉은색 [인] 인주 텍스트가 대신 출력됩니다.");
    if (onDataChange) onDataChange();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 회사 기본 정보 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} style={{ color: 'var(--primary-color)' }} />
            본사 사업소 정보 설정
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            매출 및 매입 거래명세서 발행 시 공급자(본사) 정보로 인쇄될 기본 인적사항입니다.
          </p>
        </div>

        <form onSubmit={handleSaveHqInfo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>상호 (회사명)</label>
            <input
              type="text"
              required
              value={hqName}
              onChange={(e) => setHqName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>대표자 성명</label>
              <input
                type="text"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>사업자 등록 번호</label>
              <input
                type="text"
                required
                value={bizNo}
                onChange={(e) => setBizNo(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>대표 전화 번호</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>사업소 소재지 (주소)</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '8px' }}
          >
            본사 설정 저장
          </button>
        </form>
      </div>

      {/* 우측: 인쇄 용지 및 대표자 직인 설정 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* 대표자 직인 도장 설정 */}
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={20} style={{ color: '#34d399' }} />
            인쇄 용지 및 대표자 직인 이미지 설정
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            인쇄 시 출력될 대표자 서명 직인(도장) 이미지 파일을 등록합니다.
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '30px 20px',
          background: 'rgba(0,0,0,0.15)',
          textAlign: 'center',
          gap: '16px'
        }}>
          {sealImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '72px',
                height: '72px',
                background: '#fff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                padding: '4px'
              }}>
                <img
                  src={sealImage}
                  alt="CEO Seal"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>대표자 직인 도장이 등록되었습니다.</div>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={handleSealDelete}
              >
                <Trash2 size={12} />
                등록 직인 삭제
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.3)'
              }}>
                <Upload size={28} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                배경이 없거나(PNG 투명) 흰색인<br />도장 이미지 파일을 업로드해 주세요.
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  padding: '6px 16px'
                }}
                onClick={() => document.getElementById('seal-file-input').click()}
              >
                직인 이미지 찾기
              </button>
              <input
                type="file"
                id="seal-file-input"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleSealUpload}
              />
            </div>
          )}
        </div>

        {/* 인쇄 관련 안내 */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5
        }}>
          💡 <strong>거래명세서 출력 및 도장 배치 팁:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>직인 이미지가 없으면 기본 붉은색 인주 서식인 <span style={{ color: '#f87171', fontWeight: 'bold' }}>[인]</span> 가상 도장이 대체 출력됩니다.</li>
            <li>직인 업로드 시 명세서 공급자 정보의 대표자 성명 우측에 오버랩되어 리얼한 실물 인쇄처럼 도장 마크가 렌더링됩니다.</li>
            <li>브라우저 인쇄 모달이 켜지면 <strong>[배경 그래픽]</strong> 옵션을 활성화해야 글래스모피즘 외곽선이나 도장 이미지가 깨끗하게 출력됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
