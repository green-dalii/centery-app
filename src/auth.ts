/**
 * 用户认证模块
 * 处理用户注册、登录、JWT验证等功能
 */

import type { Env } from './index';
import { hashPassword, verifyPassword } from './utils/crypto';
import { generateJWT, verifyJWT } from './utils/jwt';

/**
 * 处理认证相关请求
 */
export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  if (path === '/api/auth/register' && method === 'POST') {
    return await handleRegister(request, env);
  }

  if (path === '/api/auth/login' && method === 'POST') {
    return await handleLogin(request, env);
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    return await handleLogout(request, env);
  }

  return new Response('Auth endpoint not found', { status: 404 });
}

/**
 * 用户注册
 */
async function handleRegister(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password, notes } = await request.json();

    // 验证输入
    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 用户名验证：至少3位字符，不能为纯数字
    if (username.length < 3) {
      return new Response(JSON.stringify({ error: '用户名长度至少为3位字符' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (/^\d+$/.test(username)) {
      return new Response(JSON.stringify({ error: '用户名不能为纯数字' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 密码验证：至少6位，不能为常见弱密码
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: '密码长度至少为6位' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 使用正则表达式检测弱密码模式
    const weakPasswordPatterns = [
      /^(\d)\1{5,}$/, // 6位或以上相同数字 (如: 111111, 000000)
      /^(.)\1{5,}$/, // 6位或以上相同字符 (如: aaaaaa)
      /^123456\d*$/, // 以123456开头
      /^\d*654321$/, // 以654321结尾
      /^(012|123|234|345|456|567|678|789|890){2,}$/, // 连续数字重复
      /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz){2,}$/i, // 连续字母重复
      /^(qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm){2,}$/i, // 键盘序列重复
      /^(password|admin|user|guest|test|demo)\d*$/i, // 常见单词+数字
      /^\d{6,}$/, // 纯数字6位以上
      /^[a-z]{6,}$/i, // 纯字母6位以上
      /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, // 日期格式 (YYYYMMDD)
      /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, // 日期格式 (YYMMDD)
    ];

    // 常见弱密码列表作为补充
    const commonWeakPasswords = ['password', 'admin', 'user', 'guest', 'test', 'demo', 'root', 'login', 'welcome', 'qwerty', 'asdfgh', 'zxcvbn'];

    const lowerPassword = password.toLowerCase();

    // 检查正则表达式模式
    for (const pattern of weakPasswordPatterns) {
      if (pattern.test(lowerPassword)) {
        return new Response(JSON.stringify({ error: '密码过于简单，请使用更复杂的密码' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 检查常见弱密码列表
    if (commonWeakPasswords.includes(lowerPassword)) {
      return new Response(JSON.stringify({ error: '密码过于简单，请使用更复杂的密码' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查用户名是否已存在
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: '用户名已存在' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 创建用户
    const passwordHash = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO users (username, password_hash, notes) VALUES (?, ?, ?)'
    ).bind(username, passwordHash, notes || '').run();

    if (!result.success) {
      throw new Error('Failed to create user');
    }

    // 生成JWT
    const token = await generateJWT({ userId: result.meta.last_row_id, username }, env.JWT_SECRET);

    return new Response(JSON.stringify({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: result.meta.last_row_id,
        username,
        notes: notes || ''
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: '注册失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 用户登录
 */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password } = await request.json();

    // 验证输入
    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 查找用户
    const user = await env.DB.prepare(
      'SELECT id, username, password_hash, notes FROM users WHERE username = ?'
    ).bind(username).first();

    if (!user) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证密码
    const isValidPassword = await verifyPassword(password, user.password_hash as string);
    if (!isValidPassword) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 生成JWT
    const token = await generateJWT({ userId: user.id, username: user.username }, env.JWT_SECRET);

    return new Response(JSON.stringify({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        notes: user.notes
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: '登录失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 用户登出
 */
async function handleLogout(request: Request, env: Env): Promise<Response> {
  // 客户端处理token清除，服务端返回成功响应
  return new Response(JSON.stringify({
    success: true,
    message: '登出成功'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 验证JWT中间件
 */
export async function requireAuth(request: Request, env: Env): Promise<{ userId: number; username: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}