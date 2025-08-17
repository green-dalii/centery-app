/**
 * 飞书 API 通用模块
 */
import type { Env } from '../index';

/**
 * 获取飞书 tenant_access_token
 */
export async function getFeishuAccessToken(env: Env): Promise<string> {
  // TODO: Add caching for access token
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

/**
 * 调用飞书多维表格 API
 */
export async function callFeishuBitableApi(
  env: Env,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: any = null
): Promise<any> {
  const token = await getFeishuAccessToken(env);
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (data.code !== 0) {
    console.error(`Feishu API Error: code=${data.code}, msg=${data.msg}, path=${path}, body=${JSON.stringify(body)}`);
    throw new Error(`Feishu API request failed: ${data.msg} (code: ${data.code})`);
  }

  return data.data;
}