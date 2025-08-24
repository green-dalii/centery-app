# Centery App

一个基于 Cloudflare Workers 和 Astro 构建的现代化购物和订单管理应用。

## ✨ 功能特性

- 🛍️ **商品浏览与搜索** - 支持分页浏览和实时搜索商品
- 🛒 **购物车管理** - 添加、删除商品，实时计算总价
- 📦 **订单管理** - 查看订单详情，显示真实商品名称
- 👤 **用户系统** - 注册、登录、个人资料管理
- 🎨 **响应式设计** - 移动端优先的现代化 UI
- 🔗 **飞书集成** - 与飞书多维表格数据同步

## 🛠️ 技术栈

- **前端框架**: [Astro](https://astro.build/) - 现代化的静态站点生成器
- **样式框架**: [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
- **运行时**: [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- **数据库**: [Cloudflare D1](https://developers.cloudflare.com/d1/) + [飞书多维表格](https://bitable.feishu.cn/)

## 📦 项目结构

```
centery-app/
├── src/
│   ├── components/          # Astro 组件
│   │   ├── Auth.astro      # 用户认证组件
│   │   ├── BottomNav.astro # 底部导航
│   │   ├── Cart.astro      # 购物车组件
│   │   ├── Header.astro    # 页面头部
│   │   ├── Products.astro  # 商品列表组件
│   │   ├── Profile.astro   # 用户资料组件
│   │   └── Toast.astro     # 消息提示组件
│   ├── layouts/
│   │   └── Layout.astro    # 页面布局模板
│   ├── pages/
│   │   └── index.astro     # 主页面
│   ├── styles/
│   │   └── global.css      # 全局样式
│   ├── utils/              # 工具函数
│   │   ├── crypto.ts       # 加密工具
│   │   ├── feishu.ts       # 飞书 API 集成
│   │   └── jwt.ts          # JWT 令牌处理
│   ├── auth.ts             # 用户认证逻辑
│   ├── index.ts            # Workers 入口文件
│   ├── orders.ts           # 订单管理
│   ├── products.ts         # 商品管理
│   └── user.ts             # 用户管理
├── public/                 # 静态资源
├── schema.sql              # 数据库结构
├── wrangler.jsonc          # Cloudflare Workers 配置
├── astro.config.mjs        # Astro 配置
├── tailwind.config.mjs     # Tailwind CSS 配置
└── package.json            # 项目依赖
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm (推荐) 或 npm
- Cloudflare 账户

### 安装依赖

```bash
pnpm install
```

### 本地开发

1. **初始化数据库**:
   ```bash
   pnpm run db:migrate
   ```

2. **启动开发服务器**:
   ```bash
   pnpm run dev
   ```

3. **访问应用**: 打开 http://localhost:8787

### 部署到 Cloudflare Workers

1. **登录 Cloudflare**:
   ```bash
   npx wrangler login
   ```

2. **部署应用**:
   ```bash
   pnpm run deploy
   ```

### 在手机上安装

1. 使用手机浏览器访问应用
2. 点击浏览器菜单中的"添加到主屏幕"
3. 确认安装，应用图标将出现在桌面

## 🔧 配置说明

### 环境变量

在 Cloudflare Workers 控制台中设置以下环境变量：

```bash
# 飞书 API 配置
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_TABLE_ID=your_table_id

# JWT 密钥
JWT_SECRET=your_jwt_secret
```

### 数据库配置

项目使用 Cloudflare D1 数据库，配置在 `wrangler.jsonc` 中：

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "centery-app-db",
      "database_id": "your_database_id"
    }
  ]
}
```

## 🎨 自定义主题

项目使用 DaisyUI 主题系统，主要颜色配置在 `src/layouts/Layout.astro` 中：

```css
:root {
  --color-primary: oklch(72% 0.219 149.579); /* 主色调 */
  --color-secondary: oklch(92% 0 0);         /* 次要色 */
}
```

## 📄 API 文档

### 用户认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/profile` - 获取用户信息

### 商品管理

- `GET /api/products` - 获取商品列表
- `GET /api/products/search` - 搜索商品

### 订单管理

- `GET /api/orders` - 获取用户订单
- `POST /api/orders` - 创建订单

### 用户地址

- `GET /api/addresses` - 获取用户地址
- `POST /api/addresses` - 添加地址
- `PUT /api/addresses/:id` - 更新地址
- `DELETE /api/addresses/:id` - 删除地址

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 更新日志

### v0.4.0
- 增加注册时的安全性验证功能
- 优化库存提示的信息
- 为商品详情页增加图片和描述文字显示
- 其他UI交互的优化

### v0.3.0
- 升级至TailwindCSS v4
- 修复UI样式显示错误

### v0.2.0
- ✨ 添加 PWA 支持
- 🎨 优化移动端 UI
- 🔧 完善订单显示逻辑
- 📱 添加响应式设计

### v0.1.0
- 🎉 初始版本发布
- ✨ 基础功能实现
- 🔗 飞书集成

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

- [Astro](https://astro.build/) - 优秀的静态站点生成器
- [Cloudflare Workers](https://workers.cloudflare.com/) - 强大的边缘计算平台
- [Tailwind CSS](https://tailwindcss.com/) - 实用的 CSS 框架
- [DaisyUI](https://daisyui.com/) - 美观的组件库

---

如有问题或建议，欢迎提交 [Issue](https://github.com/your-username/centery-app/issues) 或 [Pull Request](https://github.com/your-username/centery-app/pulls)。
