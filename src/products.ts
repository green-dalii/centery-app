/**
 * 商品管理模块
 * 处理商品信息获取（飞书多维表格集成脚手架）
 */

import type { Env } from './index';
import { callFeishuBitableApi } from './utils/feishu';

/**
 * 处理商品相关请求
 */
export async function handleProducts(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  if (path === '/api/products' && method === 'GET') {
    return await getProducts(request, env);
  }

  if (path.match(/^\/api\/products\/\w+$/) && method === 'GET') {
    const productId = path.split('/').pop()!;
    return await getProductById(productId, env);
  }

  return new Response('Products endpoint not found', { status: 404 });
}

/**
 * 获取商品列表
 */
async function getProducts(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pageToken = url.searchParams.get('pageToken') || '';
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
    const searchTerm = url.searchParams.get('q') || '';

    const { products, hasMore, nextPageToken } = await fetchProductsFromFeishu(env, pageToken, pageSize, searchTerm);
    return new Response(JSON.stringify({
      success: true,
      products: products,
      hasMore: hasMore,
      nextPageToken: nextPageToken,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get products error:', error);
    return new Response(JSON.stringify({ error: '获取商品列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 根据ID获取商品详情
 */
async function getProductById(productId: string, env: Env): Promise<Response> {
  try {
    const data = await callFeishuBitableApi(env, 'GET', `/tables/${env.FEISHU_STOCK_TABLE_ID}/records/${productId}`);
    
    const item = data.record;
    const fields = item.fields;
    const imageUrl = fields['商品图片'] && fields['商品图片'][0] ? fields['商品图片'][0].url : '';

    const product = {
      id: item.record_id,
      name: fields['商品名称'] && fields['商品名称'][0] ? fields['商品名称'][0].text : 'Unnamed Product',
      price: fields['商品单价'] || 0,
      stock: fields['库存剩余'] || 0,
      image: imageUrl,
      description: fields['商品描述']?.[0]?.text || '',
      type: fields['类型'] || '',
      unit: fields['单位'] || ''
    };

    return new Response(JSON.stringify({
      success: true,
      product
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error.message.includes('code: 254404')) { // RecordIdNotFound
        return new Response(JSON.stringify({ error: '商品不存在' }), {
           status: 404,
           headers: { 'Content-Type': 'application/json' },
       });
   }
    console.error('Get product by id error:', error);
    return new Response(JSON.stringify({ error: '获取商品详情失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 从飞书多维表格获取商品数据
 */
async function fetchProductsFromFeishu(env: Env, pageToken?: string, pageSize?: number, searchTerm?: string): Promise<{ products: any[], hasMore: boolean, nextPageToken: string }> {
  const body: {
    page_size?: number;
    page_token?: string;
    filter?: any;
    field_names?: string[];
  } = {
    page_size: pageSize,
    page_token: pageToken,
    field_names: ["商品名称", "类型", "商品图片", "商品单价", "库存剩余", "单位", "商品描述"]
  };

  if (searchTerm) {
    body.filter = {
      conjunction: "and",
      conditions: [
        {
          field_name: "商品名称",
          operator: "contains",
          value: [searchTerm]
        }
      ]
    }
  }

  const data = await callFeishuBitableApi(env, 'POST', `/tables/${env.FEISHU_STOCK_TABLE_ID}/records/search`, body);

  // 将飞书返回的原始数据格式化为我们需要的商品数据格式
  const products = data.items.map((item: any) => {
    const fields = item.fields;
    const imageUrl = fields['商品图片'] && fields['商品图片'][0] ? `/api/image_proxy?file_token=${fields['商品图片'][0].file_token}` : '';

    return {
      id: item.record_id,
      name: fields['商品名称'] && fields['商品名称'][0] ? fields['商品名称'][0].text : 'Unnamed Product',
      price: fields['商品单价'] || 0,
      stock: fields['库存剩余'] || 0,
      image: imageUrl,
      description: fields['商品描述'] && fields['商品描述'][0] ? fields['商品描述'][0].text : '',
      type: fields['类型'] || '',
      unit: fields['单位'] || ''
    };
  });

  return {
      products,
      hasMore: data.has_more,
      nextPageToken: data.page_token || ''
  };
}

export async function handleImageProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const fileToken = url.searchParams.get('file_token');

  if (!fileToken) {
    return new Response('Missing file_token', { status: 400 });
  }

  const cache = (caches as any).default;
  const cacheKey = new Request(url.toString(), request);
  let response = await cache.match(cacheKey);

  if (response) {
    return response;
  }

  try {
    const accessToken = await getFeishuAccessToken(env);
    const feishuResponse = await fetch(`https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!feishuResponse.ok) {
      throw new Error(`Failed to download image from Feishu: ${feishuResponse.statusText}`);
    }

    const newHeaders = new Headers(feishuResponse.headers);
    newHeaders.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    response = new Response(feishuResponse.body, {
      status: feishuResponse.status,
      statusText: feishuResponse.statusText,
      headers: newHeaders
    });

    await cache.put(cacheKey, response.clone());

    return response;
  } catch (error) {
    console.error('Image proxy error:', error);
    return new Response('Failed to fetch image', { status: 500 });
  }
}

/**
 * 获取飞书 tenant_access_token
 */
async function getFeishuAccessToken(env: Env): Promise<string> {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to get tenant_access_token: ${data.msg}`);
  }
  return data.tenant_access_token;
}