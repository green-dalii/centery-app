/**
 * 用户管理模块
 * 处理用户信息和收货地址管理
 */

import type { Env } from './index';
import { requireAuth } from './auth';

/**
 * 处理用户相关请求
 */
export async function handleUser(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // 验证用户身份
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权访问' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/user/profile' && method === 'GET') {
    return await getUserProfile(user.userId, env);
  }

  if (path === '/api/user/profile' && method === 'PUT') {
    return await updateUserProfile(request, user.userId, env);
  }

  if (path === '/api/user/addresses' && method === 'GET') {
    return await getUserAddresses(user.userId, env);
  }

  if (path === '/api/user/addresses' && method === 'POST') {
    return await createAddress(request, user.userId, env);
  }

  if (path.match(/^\/api\/user\/addresses\/\d+$/) && method === 'PUT') {
    const addressId = parseInt(path.split('/').pop()!);
    return await updateAddress(request, user.userId, addressId, env);
  }

  if (path.match(/^\/api\/user\/addresses\/\d+$/) && method === 'DELETE') {
    const addressId = parseInt(path.split('/').pop()!);
    return await deleteAddress(user.userId, addressId, env);
  }

  return new Response('User endpoint not found', { status: 404 });
}

/**
 * 获取用户信息
 */
async function getUserProfile(userId: number, env: Env): Promise<Response> {
  try {
    const user = await env.DB.prepare(
      'SELECT id, username, notes, created_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        notes: user.notes,
        createdAt: user.created_at
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return new Response(JSON.stringify({ error: '获取用户信息失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 更新用户信息
 */
async function updateUserProfile(request: Request, userId: number, env: Env): Promise<Response> {
  try {
    const { notes } = await request.json();

    const result = await env.DB.prepare(
      'UPDATE users SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(notes || '', userId).run();

    if (!result.success) {
      throw new Error('Failed to update user profile');
    }

    return new Response(JSON.stringify({
      success: true,
      message: '用户信息更新成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return new Response(JSON.stringify({ error: '更新用户信息失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 获取用户收货地址列表
 */
async function getUserAddresses(userId: number, env: Env): Promise<Response> {
  try {
    const addresses = await env.DB.prepare(
      'SELECT id, recipient_name, phone, address, is_default, created_at FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC'
    ).bind(userId).all();

    return new Response(JSON.stringify({
      success: true,
      addresses: addresses.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get user addresses error:', error);
    return new Response(JSON.stringify({ error: '获取收货地址失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 创建收货地址
 */
async function createAddress(request: Request, userId: number, env: Env): Promise<Response> {
  try {
    const { recipient_name, phone, address, is_default } = await request.json();

    // 验证输入
    if (!recipient_name || !phone || !address) {
      return new Response(JSON.stringify({ error: '收件人姓名、手机号和地址不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 如果设置为默认地址，先取消其他默认地址
    if (is_default) {
      await env.DB.prepare(
        'UPDATE addresses SET is_default = FALSE WHERE user_id = ?'
      ).bind(userId).run();
    }

    const result = await env.DB.prepare(
      'INSERT INTO addresses (user_id, recipient_name, phone, address, is_default) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, recipient_name, phone, address, is_default || false).run();

    if (!result.success) {
      throw new Error('Failed to create address');
    }

    return new Response(JSON.stringify({
      success: true,
      message: '收货地址添加成功',
      addressId: result.meta.last_row_id
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create address error:', error);
    return new Response(JSON.stringify({ error: '添加收货地址失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 更新收货地址
 */
async function updateAddress(request: Request, userId: number, addressId: number, env: Env): Promise<Response> {
  try {
    const { recipient_name, phone, address, is_default } = await request.json();

    // 验证地址是否属于当前用户
    const existingAddress = await env.DB.prepare(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, userId).first();

    if (!existingAddress) {
      return new Response(JSON.stringify({ error: '地址不存在或无权限' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 如果设置为默认地址，先取消其他默认地址
    if (is_default) {
      await env.DB.prepare(
        'UPDATE addresses SET is_default = FALSE WHERE user_id = ? AND id != ?'
      ).bind(userId, addressId).run();
    }

    const result = await env.DB.prepare(
      'UPDATE addresses SET recipient_name = ?, phone = ?, address = ?, is_default = ? WHERE id = ? AND user_id = ?'
    ).bind(recipient_name, phone, address, is_default || false, addressId, userId).run();

    if (!result.success) {
      throw new Error('Failed to update address');
    }

    return new Response(JSON.stringify({
      success: true,
      message: '收货地址更新成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update address error:', error);
    return new Response(JSON.stringify({ error: '更新收货地址失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 删除收货地址
 */
async function deleteAddress(userId: number, addressId: number, env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, userId).run();

    if (!result.success || result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: '地址不存在或无权限' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '收货地址删除成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete address error:', error);
    return new Response(JSON.stringify({ error: '删除收货地址失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}