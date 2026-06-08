import React, { useState } from 'react';
import { authApi } from '../services/api';
import { Shield, Lock, Briefcase, User as UserIcon } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await authApi.login(username, password);
        if (data.success) {
          onAuthSuccess(data.user);
        } else {
          setError(data.error || '로그인에 실패했습니다.');
        }
      } else {
        const data = await authApi.register(username, password, companyName, name);
        if (data.success) {
          alert('회원가입이 완료되었습니다! 로그인 해 주세요.');
          setIsLogin(true);
          // 입력 폼 정리
          setPassword('');
        } else {
          setError(data.error || '회원가입에 실패했습니다.');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || '서버와의 통신 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at top right, #2c1b4d, #0f0c1b)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}>
        {/* Title/Logo */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
            color: '#fff',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)'
          }}>
            <Shield size={28} />
          </div>
          <h2 style={{
            margin: '0 0 8px 0',
            color: '#fff',
            fontSize: '1.75rem',
            fontWeight: '800',
            letterSpacing: '-0.5px'
          }}>Smart ERP Pro</h2>
          <p style={{
            margin: 0,
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.9rem'
          }}>
            {isLogin ? '회사 통합 업무 재무 관리 시스템 로그인' : '스마트 회계 솔루션 파트너 가입'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            textAlign: 'left',
            lineHeight: 1.4
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Input Forms */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '6px',
              fontWeight: 600
            }}>아이디 (ID)</label>
            <div style={{ position: 'relative' }}>
              <UserIcon style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)',
                width: '16px',
                height: '16px'
              }} />
              <input
                type="text"
                placeholder="아이디를 입력하세요"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '6px',
              fontWeight: 600
            }}>비밀번호</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)',
                width: '16px',
                height: '16px'
              }} />
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
          </div>

          {/* Registration Extra Fields */}
          {!isLogin && (
            <>
              <div style={{ textAlign: 'left' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '6px',
                  fontWeight: 600
                }}>회사명 (신규 등록)</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.4)',
                    width: '16px',
                    height: '16px'
                  }} />
                  <input
                    type="text"
                    placeholder="회사 상호명을 입력하세요"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 38px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '6px',
                  fontWeight: 600
                }}>성명 (사용자 실명)</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.4)',
                    width: '16px',
                    height: '16px'
                  }} />
                  <input
                    type="text"
                    placeholder="본인의 이름을 입력하세요"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 38px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '14px',
              background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseDown={(e) => !loading && (e.target.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => !loading && (e.target.style.transform = 'scale(1)')}
          >
            {loading ? '처리 중...' : (isLogin ? '로그인 완료' : '무료 회사 ERP 개설')}
          </button>
        </form>

        {/* Tab Toggle */}
        <div style={{
          marginTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '16px',
          fontSize: '0.85rem',
          color: 'rgba(255, 255, 255, 0.5)'
        }}>
          {isLogin ? (
            <>
              아직 회사 계정이 없으신가요?{' '}
              <span
                onClick={() => { setIsLogin(false); setError(''); }}
                style={{ color: '#c084fc', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
              >
                신규 개설 및 가입
              </span>
            </>
          ) : (
            <>
              이미 등록된 아이디가 있으신가요?{' '}
              <span
                onClick={() => { setIsLogin(true); setError(''); }}
                style={{ color: '#c084fc', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
              >
                로그인 화면 이동
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
