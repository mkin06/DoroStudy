import { useEffect, useRef, useState } from 'react';
import { googleLogin } from '../../api/authentication/auth';
import { useLanguage } from '../../hooks/useLanguage';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
let initializedSdk;
let activeCredentialHandler;

export default function GoogleAuthButton({ text = 'continue_with', onSuccess, onError, disabled = false }) {
  const { language, t } = useLanguage();
  const buttonRef = useRef(null);
  const callbacks = useRef({ onSuccess, onError });
  const busy = useRef(false);
  const mountedRef = useRef(false);
  const disabledRef = useRef(disabled);
  const [loading, setLoading] = useState(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { callbacks.current = { onSuccess, onError }; disabledRef.current = disabled; });

  useEffect(() => {
    let mounted = true;
    let poll;
    let attempts = 0;
    const handleCredential = async response => {
      if (!mounted || busy.current || disabledRef.current) return;
      if (!response.credential) return callbacks.current.onError?.(t('Google không trả về thông tin đăng nhập. Vui lòng thử lại.'));
      busy.current = true;
      setLoading(true);
      try {
        const result = await googleLogin(response.credential);
        if (!mountedRef.current) return;
        if (callbacks.current.onSuccess) callbacks.current.onSuccess(result);
        else window.location.assign('/');
      } catch (error) {
        if (mountedRef.current) callbacks.current.onError?.(t(error.message || 'Đăng nhập Google thất bại.'));
      } finally {
        busy.current = false;
        if (mountedRef.current) setLoading(false);
      }
    };
    activeCredentialHandler = handleCredential;
    if (!CLIENT_ID) callbacks.current.onError?.(t('Đăng nhập Google chưa được cấu hình. Vui lòng dùng tên đăng nhập và mật khẩu.'));
    const render = () => {
      const sdk = window.google?.accounts?.id;
      if (!mounted || !CLIENT_ID || !sdk || !buttonRef.current) return;
      try {
        // GSI is a page-wide singleton. Parent renders must not reset a live sign-in.
        if (initializedSdk !== sdk) {
          sdk.initialize({ client_id: CLIENT_ID, callback: response => activeCredentialHandler?.(response), auto_select: false });
          initializedSdk = sdk;
        }
        buttonRef.current.replaceChildren();
        sdk.renderButton(buttonRef.current, {
          type: 'standard', theme: 'outline', size: 'large', text, shape: 'rectangular',
          logo_alignment: 'left', locale: language,
          width: Math.min(400, Math.max(200, Math.floor(buttonRef.current.offsetWidth || 400))),
        });
      } catch {
        callbacks.current.onError?.(t('Không thể tải nút đăng nhập Google. Vui lòng tải lại trang.'));
      }
    };
    if (window.google?.accounts?.id) render();
    else if (CLIENT_ID) poll = setInterval(() => {
      if (window.google?.accounts?.id) { clearInterval(poll); render(); }
      else if (++attempts >= 100) {
        clearInterval(poll);
        callbacks.current.onError?.(t('Không thể tải nút đăng nhập Google. Vui lòng tải lại trang.'));
      }
    }, 150);
    return () => {
      mounted = false;
      clearInterval(poll);
      if (activeCredentialHandler === handleCredential) activeCredentialHandler = null;
    };
  }, [text, language, t]);

  return <div aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: 44 }}>
    {loading && <div role="status" style={{ color: '#fff', padding: '10px 0' }}>{t('Đang xác thực với Google…')}</div>}
    {CLIENT_ID ? <div ref={buttonRef} style={{ display: loading ? 'none' : 'flex', justifyContent: 'center', width: '100%', opacity: disabled ? 0.6 : 1, pointerEvents: disabled || loading ? 'none' : 'auto' }} />
      : <p role="status">{t('Đăng nhập Google hiện chưa khả dụng.')}</p>}
  </div>;
}
