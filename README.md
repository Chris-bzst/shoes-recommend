# 鞋类购物助手

这是一个使用 Next.js 和 Claude API 创建的鞋类购物助手应用。该应用可以根据用户的需求推荐合适的鞋子产品。

## 特点

- 使用 Claude API 进行自然语言处理和产品推荐
- 从 Markdown 文件加载产品数据
- 响应式设计，适配各种设备
- 支持关键词匹配和智能产品推荐
- 服务器端 API 代理，解决 CORS 问题
- API 密钥安全存储在服务器端，不暴露给客户端

## 安装与使用

1. 克隆这个仓库

```bash
git clone <repository-url>
cd next-shop-assistant
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

创建 `.env.local` 文件并添加 Claude API 密钥：

```
CLAUDE_API_KEY=你的Claude_API密钥
```

> 注意：`.env.local` 文件包含敏感信息，不应提交到版本控制系统。

4. 将产品数据文件 `productData.md` 放在 `/public` 目录下

5. 启动开发服务器

```bash
npm run dev
```

6. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## 部署

这个应用可以轻松部署到 Vercel 或其他支持 Next.js 的平台：

```bash
npm run build
npm run start
```

在部署到生产环境时，确保设置环境变量：

- **Vercel**: 在项目设置中添加环境变量
- **其他平台**: 按照平台文档设置环境变量

## 目录结构

```
next-shop-assistant/
├── .env.local          # 环境变量（本地开发）
├── next.config.js      # Next.js 配置
├── pages/              # Next.js 页面
│   ├── index.js        # 主页面
│   └── api/            # API 路由
│       └── claude.js   # Claude API 代理
├── public/             # 静态文件
│   ├── styles.css      # 全局样式
│   └── productData.md  # 产品数据
└── package.json        # 项目依赖
```

## 技术栈

- Next.js
- React
- Claude API
- CSS
