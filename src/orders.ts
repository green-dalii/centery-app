/**
 * 订单管理模块
 * 处理订单创建和管理（飞书多维表格集成脚手架）
 */

import type { Env } from './index';
import { requireAuth } from './auth';

/**
 * 处理订单相关请求
 */
export async function handleOrders(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // 验证用户身份
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权访问' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/orders' && method === 'POST') {
    return await createOrder(request, user, env);
  }

  if (path === '/api/orders' && method === 'GET') {
    return await getUserOrders(request, user, env);
  }

  if (path.match(/^\/api\/orders\/\w+$/) && method === 'GET') {
    const orderId = path.split('/').pop()!;
    return await getOrderById(orderId, user, env);
  }

  return new Response('Orders endpoint not found', { status: 404 });
}

/**
 * 创建订单
 * TODO: 集成飞书多维表格API
 */
async function createOrder(request: Request, user: { userId: number; username: string }, env: Env): Promise<Response> {
  try {
    const { productId, quantity, addressId } = await request.json();

    // 验证输入
    if (!productId || !quantity || !addressId) {
      return new Response(JSON.stringify({ error: '商品ID、数量和收货地址不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (quantity <= 0) {
      return new Response(JSON.stringify({ error: '商品数量必须大于0' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证收货地址是否属于当前用户
    const address = await env.DB.prepare(
      'SELECT id, recipient_name, phone, address FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, user.userId).first();

    if (!address) {
      return new Response(JSON.stringify({ error: '收货地址不存在或无权限' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: 验证商品库存（从飞书获取）
    // TODO: 将订单信息写入飞书多维表格
    
    // 暂时生成模拟订单ID
    const orderId = `order_${Date.now()}_${user.userId}`;
    const orderData = {
      orderId,
      userId: user.userId,
      username: user.username,
      productId,
      quantity,
      address: {
        recipientName: address.recipient_name,
        phone: address.phone,
        address: address.address
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // TODO: 实际写入飞书表格
    console.log('Order created (mock):', orderData);

    return new Response(JSON.stringify({
      success: true,
      message: '订单创建成功',
      orderId,
      order: orderData
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return new Response(JSON.stringify({ error: '创建订单失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 获取用户订单列表
 * TODO: 从飞书多维表格获取
 */
async function getUserOrders(request: Request, user: { userId: number; username: string }, env: Env): Promise<Response> {
  try {
    // 暂时返回模拟数据
    const mockOrders = [
      {
        id: `order_${Date.now() - 86400000}_${user.userId}`,
        productId: 'prod_001',
        productName: '精选苹果',
        quantity: 2,
        total: 25.6,
        status: 'completed', // 已完成
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: `order_${Date.now() - 172800000}_${user.userId}`,
        productId: 'prod_002',
        productName: '有机香蕉',
        quantity: 1,
        total: 8.5,
        status: 'shipped', // 待收货
        created_at: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: `order_${Date.now() - 259200000}_${user.userId}`,
        productId: 'prod_003',
        productName: '新鲜草莓',
        quantity: 3,
        total: 45.0,
        status: 'processing', // 待发货
        created_at: new Date(Date.now() - 259200000).toISOString(),
      },
      {
        id: `order_${Date.now() - 345600000}_${user.userId}`,
        productId: 'prod_004',
        productName: '进口蓝莓',
        quantity: 1,
        total: 30.0,
        status: 'pending', // 已下单
        created_at: new Date(Date.now() - 345600000).toISOString(),
      }
    ];

    return new Response(JSON.stringify({
      success: true,
      orders: mockOrders,
      total: mockOrders.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    return new Response(JSON.stringify({ error: '获取订单列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 根据ID获取订单详情
 * TODO: 从飞书多维表格获取
 */
async function getOrderById(orderId: string, user: { userId: number; username: string }, env: Env): Promise<Response> {
  try {
    // 暂时返回模拟数据
    const mockOrder = {
      orderId,
      userId: user.userId,
      productId: 'prod_001',
      productName: '精选苹果',
      quantity: 2,
      price: 12.8,
      totalAmount: 25.6,
      status: 'completed',
      createdAt: new Date().toISOString(),
      address: {
        recipientName: '张三',
        phone: '13800138000',
        address: '北京市朝阳区xxx街道xxx号'
      },
      timeline: [
        {
          status: 'created',
          message: '订单已创建',
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          status: 'confirmed',
          message: '订单已确认',
          timestamp: new Date(Date.now() - 1800000).toISOString()
        },
        {
          status: 'completed',
          message: '订单已完成',
          timestamp: new Date().toISOString()
        }
      ]
    };

    return new Response(JSON.stringify({
      success: true,
      order: mockOrder
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get order by id error:', error);
    return new Response(JSON.stringify({ error: '获取订单详情失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 飞书API集成函数（待实现）
 */

/**
 * 将订单写入飞书多维表格
 */
async function writeOrderToFeishu(orderData: any, env: Env): Promise<void> {
  // TODO: 实现飞书多维表格写入
  // const token = await getFeishuAccessToken(env);
  // const response = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${token}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     fields: orderData
  //   })
  // });
  
  throw new Error('Feishu integration not implemented yet');
}

/**
 * 从飞书多维表格获取订单数据
 */
async function fetchOrdersFromFeishu(userId: number, env: Env): Promise<any[]> {
  // TODO: 实现飞书多维表格数据获取
  // const token = await getFeishuAccessToken(env);
  // const response = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records?filter=user_id=${userId}`, {
  //   headers: {
  //     'Authorization': `Bearer ${token}`
  //   }
  // });
  // const data = await response.json();
  // return data.data.items;
  
  throw new Error('Feishu integration not implemented yet');
}