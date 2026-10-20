import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '@shared/api/http-client';
import { getErrorMessage } from '@shared/api/error-message';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal đổi mật khẩu lần đầu
  const [mustChangePwd, setMustChangePwd] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwdError, setChangePwdError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await httpClient.post('/auth/login', { username, password });
      const { accessToken, user } = res.data.data || res.data;
      localStorage.setItem('accessToken', accessToken);

      if (user?.mustChangePassword) {
        setMustChangePwd(true);
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Tên đăng nhập hoặc mật khẩu không đúng.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstTimeChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setChangePwdError('');
    if (newPassword !== confirmPassword) {
      setChangePwdError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 8) {
      setChangePwdError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }

    try {
      await httpClient.post('/auth/change-password', {
        oldPassword: password,
        newPassword,
      });
      alert('Đổi mật khẩu thành công! Bạn sẽ được chuyển đến trang chủ.');
      navigate('/');
    } catch (err: unknown) {
      setChangePwdError(getErrorMessage(err, 'Không thể đổi mật khẩu'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <span className="text-2xl font-bold text-blue-600">UTC</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">QLDATN</h1>
          <p className="mt-1 text-sm text-gray-500">Quản Lý Đồ Án Tốt Nghiệp - UTC</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!mustChangePwd ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Mã sinh viên / Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Ví dụ: 221231054"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Mật khẩu mặc định là mã SV"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition"
            >
              {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFirstTimeChangePassword} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Đây là lần đăng nhập đầu tiên. Bạn bắt buộc phải đổi mật khẩu mặc định (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt).
            </div>

            {changePwdError && (
              <div className="text-xs text-red-600">{changePwdError}</div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition"
            >
              Lưu mật khẩu mới & Tiếp tục
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
