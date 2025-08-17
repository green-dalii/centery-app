/**
 * Centery App - Cloudflare Workers 主入口文件
 * 处理静态资源和API路由
 */

import { handleAuth } from './auth';
import { handleUser } from './user';
import { handleProducts, handleImageProxy } from './products';
import { handleOrders } from './orders';

export interface Env {
  // Environment variables
  JWT_SECRET: string;
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  FEISHU_BASE_APP_TOKEN: string;
  FEISHU_STOCK_TABLE_ID: string;
  FEISHU_ORDER_TABLE_ID: string;
  // Cloudflare bindings
  DB: any; // D1Database type from @cloudflare/workers-types
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // API 路由处理
    if (path.startsWith('/api/')) {
      const originalResponse = await handleApiRequest(request, env, path);
      // 克隆响应以使 headers 可变
      const response = new Response(originalResponse.body, originalResponse);
      // 添加 CORS 头
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response;
    }

    // by default, we will return 404 to let wrangler handle static assets
    return new Response('Not found', { status: 404 });
  },
};

/**
 * 处理API请求路由
 */
async function handleApiRequest(request: Request, env: Env, path: string): Promise<Response> {
  try {
    // 认证相关API
    if (path.startsWith('/api/auth/')) {
      return await handleAuth(request, env, path);
    }

    // 用户相关API
    if (path.startsWith('/api/user/')) {
      return await handleUser(request, env, path);
    }

    // 商品相关API
    if (path.startsWith('/api/products')) {
      return await handleProducts(request, env, path);
    }

    // 图片代理
    if (path.startsWith('/api/image_proxy')) {
      return await handleImageProxy(request, env);
    }

    // 订单相关API
    if (path.startsWith('/api/orders')) {
      return await handleOrders(request, env, path);
    }

    return new Response('API endpoint not found', { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}