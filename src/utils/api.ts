/**
 * 全局API调用工具函数
 * 统一处理401未授权错误和数据清理
 */

// 声明全局类型
declare global {
    interface Window {
        globalApiCall: (endpoint: string, options?: RequestInit) => Promise<any>;
        showToast?: (message: string, type: string) => void;
    }
}

/**
 * 清除所有本地存储的用户数据
 */
function clearUserData(): void {
    // 清除localStorage中的数据
    localStorage.removeItem('authToken');
    localStorage.removeItem('cart');
    
    // 清除sessionStorage中的商品数据
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
        if (key.startsWith('products_')) {
            sessionStorage.removeItem(key);
        }
    });
}

/**
 * 处理401未授权错误
 */
function handle401Error(): void {
    clearUserData();
    if (window.showToast) {
        window.showToast('登录已过期，请重新登录', 'error');
    }
    // 强制跳转到登录页面
    setTimeout(() => {
        window.location.href = '/';
        // 确保显示登录界面
        document.dispatchEvent(new CustomEvent('forcelogout'));
    }, 1000);
}

/**
 * 全局API调用函数
 * @param endpoint - API端点
 * @param options - fetch选项
 * @returns API响应数据
 */
async function globalApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const authToken = localStorage.getItem('authToken');
    const config: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        ...options
    };

    try {
        const response = await fetch(`/api${endpoint}`, config);
        
        // 检查401未授权状态
        if (response.status === 401) {
            handle401Error();
            throw new Error('未授权访问');
        }
        
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            throw new Error(data.error || `API请求失败，状态码: ${response.status}`);
        }
        
        return data;
    } catch (error: any) {
        console.error('API Error:', error);
        
        // 如果是网络错误或其他错误，也检查是否可能是认证问题
        if (error.message.includes('401') || error.message.includes('未授权')) {
            handle401Error();
        }
        
        throw error;
    }
}

// 将函数挂载到window对象上
if (typeof window !== 'undefined') {
    window.globalApiCall = globalApiCall;
}

// 导出函数供其他模块使用
export {
    globalApiCall,
    clearUserData,
    handle401Error
};