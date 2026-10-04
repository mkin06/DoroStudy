import React, { useEffect, useRef, useState } from 'react';
import { googleLogin } from '../../api/authentication/auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleAuthButton({ text = 'continue_with', onSuccess, onError, disabled = false }) {
  const buttonRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer;

    const handleCredentialResponse = async (response) => {
      if (!response.credential) {
        if (onError) onError('Google login failed: No credential received.');
        return;
      }

      setLoading(true);
      try {
        const res = await googleLogin(response.credential);
        if (res?.username) {
          localStorage.setItem('username', res.username);
        }
        if (onSuccess) {
          onSuccess(res);
        } else {
          window.location.href = '/';
        }
      } catch (err) {
        if (onError) onError(err.message || 'Google authentication failed.');
      } finally {
        setLoading(false);
      }
    };

    const setupGoogleButton = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
          });

          const measuredWidth = buttonRef.current.offsetWidth || 400;
          const targetWidth = Math.min(400, Math.max(200, Math.floor(measuredWidth)));

          buttonRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: text, // 'signin_with', 'signup_with', or 'continue_with'
            shape: 'rectangular',
            logo_alignment: 'left',
            width: targetWidth,
          });
        } catch (e) {
          console.error('Error rendering Google button:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogleButton();
    } else {
      timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          setupGoogleButton();
        }
      }, 150);
    }

    const handleResize = () => {
      setupGoogleButton();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [text, onSuccess, onError]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '44px' }}>
      {loading ? (
        <div style={{ color: '#fff', fontSize: '0.9rem', padding: '10px 0' }}>
          Processing Google authentication...
        </div>
      ) : (
        <div 
          ref={buttonRef} 
          style={{ 
            opacity: disabled ? 0.6 : 1, 
            pointerEvents: disabled ? 'none' : 'auto',
            display: 'flex',
            justifyContent: 'center',
            width: '100%'
          }} 
        />
      )}
    </div>
  );
}
