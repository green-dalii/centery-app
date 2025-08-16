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

    if (username.length < 3 || password.length < 6) {
      return new Response(JSON.stringify({ error: '用户名至少3位，密码至少6位' }), {
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