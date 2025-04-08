import { useState, useEffect } from 'react';
import '../public/styles.css';
import PasswordLock from './components/PasswordLock';

function MyApp({ Component, pageProps }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 防止水合作用不匹配
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 验证密码
  const handleAuthentication = (success) => {
    setIsAuthenticated(success);
  };

  // 仅在客户端渲染
  if (!isClient) return null;

  return (
    <>
      {!isAuthenticated ? (
        <PasswordLock onAuthenticate={handleAuthentication} />
      ) : (
        <Component {...pageProps} />
      )}

    </>
  );
}

export default MyApp;
