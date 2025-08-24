/**
 * 订单管理模块
 * 处理订单创建和管理（飞书多维表格集成脚手架）
 */

import type { Env } from './index';
import { requireAuth } from './auth';
import { callFeishuBitableApi } from './utils/feishu';
import { v4 as uuidv4 } from 'uuid';

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
 */
async function createOrder(request: Request, user: { userId: number; username: string }, env: Env): Promise<Response> {
  try {
    const { items, addressId } = await request.json();

    // 验证输入
    if (!items || !Array.isArray(items) || items.length === 0 || !addressId) {
      return new Response(JSON.stringify({ error: '订单项目和收货地址不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证收货地址是否属于当前用户
    const address = await env.DB.prepare(
      'SELECT recipient_name, phone, address FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, user.userId).first() as { recipient_name: string; phone: string; address: string } | null;

    if (!address) {
      return new Response(JSON.stringify({ error: '收货地址不存在或无权限' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证商品库存并获取最新单价
    const validatedItems = [];
    for (const item of items) {
      try {
        // 从飞书获取商品详情
        const productData = await callFeishuBitableApi(env, 'GET', `/tables/${env.FEISHU_STOCK_TABLE_ID}/records/${item.id}`);
        const productFields = productData.record.fields;
        
        const currentStock = productFields['库存剩余'] || 0;
        const currentPrice = productFields['商品单价'] || 0;
        const productName = productFields['商品名称'] && productFields['商品名称'][0] ? productFields['商品名称'][0].text : 'Unknown Product';
        
        // 检查库存是否足够
        if (item.quantity > currentStock) {
          return new Response(JSON.stringify({ 
            error: `商品「${productName}」库存不足，当前库存：${currentStock}，请求数量：${item.quantity}` 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        validatedItems.push({
          ...item,
          currentPrice,
          productName
        });
      } catch (error: any) {
        if (error.message.includes('code: 254404')) {
          return new Response(JSON.stringify({ error: `商品不存在：${item.id}` }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw error; // 重新抛出其他错误
      }
    }

    const orderId = uuidv4(); // 生成唯一订单号

    const records = validatedItems.map((item: any) => ({
      fields: {
        '订单号': orderId,
        '商品名称': [item.id],
        '订单状态': '已下单',
        '用户名称': user.username,
        '订购数量': item.quantity,
        '下单单价': parseFloat(item.currentPrice),
        '收货人': address.recipient_name,
        '联系方式': address.phone,
        '收货地址': address.address,
      },
    }));

    await callFeishuBitableApi(env, 'POST', `/tables/${env.FEISHU_ORDER_TABLE_ID}/records/batch_create`, {
      records,
    });

    return new Response(JSON.stringify({
      success: true,
      message: '订单创建成功',
      orderId,
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
 * 从飞书多维表格获取
 */
async function getUserOrders(request: Request, user: { userId: number; username: string }, env: Env): Promise<Response> {
  try {
    // 从飞书多维表格查询订单记录
    const searchResult = await callFeishuBitableApi(env, 'POST', `/tables/${env.FEISHU_ORDER_TABLE_ID}/records/search`, {
      field_names: [
        '订单号',
        '订单状态', 
        '商品名称',
        '订购数量',
        '订单金额',
        '下单时间',
        '收货人',
        '联系方式',
        '收货地址'
      ],
      filter: {
        conjunction: 'and',
        conditions: [
          {
            field_name: '用户名称',
            operator: 'is',
            value: [user.username]
          }
        ]
      },
      sort: [
        {
          field_name: '下单时间',
          desc: true
        }
      ]
    });

    // 按订单号聚合数据
    const orderMap = new Map();
    
    if (searchResult.items && searchResult.items.length > 0) {
      for (const record of searchResult.items) {
        const fields = record.fields;
        
        // 解析订单号 - 处理数组格式
        const orderIdField = fields['订单号'];
        const orderId = Array.isArray(orderIdField) ? orderIdField[0]?.text : orderIdField;
        
        if (!orderId) continue;
        
        if (!orderMap.has(orderId)) {
          // 映射飞书状态到前端状态
          const feishuStatus = fields['订单状态'];
          let frontendStatus = 'pending';
          
          switch (feishuStatus) {
            case '已下单':
              frontendStatus = 'pending';
              break;
            case '审核中':
              frontendStatus = 'processing';
              break;
            case '发货中':
              frontendStatus = 'shipped';
              break;
            case '已签收':
              frontendStatus = 'received';
              break;
            case '已结算':
              frontendStatus = 'completed';
              break;
            case '已取消':
              frontendStatus = 'cancelled';
              break;
            default:
              frontendStatus = 'pending';
          }
          
          // 解析收货人 - 处理数组格式
          const recipientField = fields['收货人'];
          const recipientName = Array.isArray(recipientField) ? recipientField[0]?.text : recipientField;
          
          // 解析收货地址 - 处理数组格式
          const addressField = fields['收货地址'];
          const address = Array.isArray(addressField) ? addressField[0]?.text : addressField;
          
          // 解析下单时间 - 处理时间戳
          const createdTime = fields['下单时间'];
          const createdAt = createdTime ? new Date(createdTime).toISOString() : new Date().toISOString();
          
          orderMap.set(orderId, {
            id: orderId,
            status: frontendStatus,
            items: [],
            total: 0,
            created_at: createdAt,
            address: {
              recipient_name: recipientName || '',
              phone: fields['联系方式'] || '',
              address: address || ''
            }
          });
        }
        
        // 添加商品项到订单
        const order = orderMap.get(orderId);
        
        // 解析商品名称 - 处理link_record_ids格式
        const productNameField = fields['商品名称'];
        const productId = productNameField?.link_record_ids?.[0] || 'unknown';
        
        // 解析订购数量
        const quantity = parseInt(fields['订购数量']) || 1;
        
        // 解析订单金额 - 处理复杂对象格式
        const amountField = fields['订单金额'];
        const amount = amountField?.value?.[0] || 0;
        
        order.items.push({
          productId,
          quantity,
          amount
        });
        
        order.total += amount;
      }
    }
    
    // 转换为数组格式
    const orders = Array.from(orderMap.values());

    return new Response(JSON.stringify({
      success: true,
      orders: orders,
      total: orders.length
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