/**
 * JWT工具模块
 * 处理JWT令牌的生成和验证
 */

/**
 * JWT载荷接口
 */
interface JWTPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * UTF-8安全的Base64 URL编码
 */
function base64UrlEncode(str: string): string {
  // 先将字符串转换为UTF-8字节，然后进行base64编码
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * UTF-8安全的Base64 URL解码
 */
function base64UrlDecode(str: string): string {
  // 补齐padding
  str += '='.repeat((4 - str.length % 4) % 4);
  const binaryString = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  // 将二进制字符串转换回UTF-8字符串
  const utf8Bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    utf8Bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(utf8Bytes);
}

/**
 * 生成JWT令牌
 */
export async function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24小时过期
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  // 生成签名
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    algorithm,
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    algorithm,
    key,
    encoder.encode(data)
  );

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${data}.${encodedSignature}`;
}

/**
 * 验证JWT令牌
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  // 验证签名
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    algorithm,
    false,
    ['verify']
  );

  const signature = Uint8Array.from(
    base64UrlDecode(encodedSignature),
    c => c.charCodeAt(0)
  );

  const isValid = await crypto.subtle.verify(
    algorithm,
    key,
    signature,
    encoder.encode(data)
  );

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  // 解析载荷
  const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

  // 检查过期时间
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT token expired');
  }

  return payload;
}