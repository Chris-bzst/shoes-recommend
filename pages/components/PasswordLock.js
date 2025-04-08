import { useState, useEffect } from 'react';
import Head from 'next/head';

const PasswordLock = ({ onAuthenticate }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 尝试使用localStorage存储认证状态
  useEffect(() => {
    const authData = localStorage.getItem('authData');
    if (authData) {
      const { isAuthenticated, expiry } = JSON.parse(authData);
      const now = new Date().getTime();
      
      // 检查是否过期（1天 = 86400000毫秒）
      if (isAuthenticated && now < expiry) {
        onAuthenticate(true);
      } else {
        // 清除过期的验证数据
        localStorage.removeItem('authData');
      }
    }
  }, [onAuthenticate]);

  const handleSubmit = async (e) => {
    console.log('handleSubmit');
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 获取环境变量中的密码
      const correctPassword = process.env.NEXT_PUBLIC_ACCESS_PASSWORD;
      
      if (password === correctPassword) {
        // 密码正确，存储认证状态并设置1天过期时间
        const now = new Date().getTime();
        const expiryTime = now + 86400000; // 当前时间 + 1天（毫秒）
        
        localStorage.setItem('authData', JSON.stringify({
          isAuthenticated: true,
          expiry: expiryTime
        }));
        
        onAuthenticate(true);
      } else {
        setError('Incorrect password, please try again');
      }
    } catch (err) {
      setError('Error during verification, please try again');
      console.error('Authentication error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lock-container">
      <Head>
        <title>Access Restricted - Please Enter Password</title>
        <meta name="description" content="Access restricted page" />
      </Head>

      <div className="lock-card">
        <h1>Access Restricted</h1>
        <p>Please enter password to access this page</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Submit'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .lock-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: #f8fafc;
          padding: 1rem;
        }
        
        .lock-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          padding: 2rem;
          width: 100%;
          max-width: 400px;
          text-align: center;
        }
        
        h1 {
          color: #4a6fff;
          margin-bottom: 0.5rem;
          font-size: 1.8rem;
        }
        
        p {
          color: #666;
          margin-bottom: 1.5rem;
        }
        
        .input-group {
          margin-bottom: 1rem;
        }
        
        input {
          width: 100%;
          padding: 0.8rem 1rem;
          border: 1px solid #eaeef2;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.3s ease;
        }
        
        input:focus {
          border-color: #4a6fff;
          outline: none;
          box-shadow: 0 0 0 3px rgba(74, 111, 255, 0.2);
        }
        
        .error-message {
          color: #e53e3e;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        
        .submit-button {
          width: 100%;
          padding: 0.8rem 1rem;
          background-color: #4a6fff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .submit-button:hover {
          background-color: #3a5be0;
        }
        
        .submit-button:disabled {
          background-color: #a0aec0;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default PasswordLock;