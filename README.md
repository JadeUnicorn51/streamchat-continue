# StreamChat Continue Demo

基于 SSE 的流式聊天系统，支持页面刷新后的会话恢复功能。

## 功能特性

- ✅ **SSE 流式对话**：实时流式输出AI回复
- ✅ **会话管理**：创建和管理多个聊天会话
- ✅ **会话恢复**：页面刷新或重新进入时自动恢复中断的流式对话
- ✅ **状态持久化**：Redis缓存 + MySQL持久化的双重存储
- ✅ **实时状态指示**：显示流式输出状态和会话状态

## 技术架构

**后端**：
- FastAPI + Uvicorn
- SQLModel + MySQL (持久化存储)
- Redis (会话状态缓存)
- SSE (Server-Sent Events)

**前端**：
- React 18 + TypeScript
- Vite 构建工具
- Axios HTTP 客户端
- LocalStorage 状态恢复

## API 接口

### 会话管理
- `POST /api/sessions/` - 创建新会话
- `GET /api/sessions/{id}` - 获取会话详情
- `GET /api/sessions/{id}/messages` - 获取会话消息
- `GET /api/sessions/` - 获取所有会话

### 流式对话
- `POST /api/chat/{session_id}/completions` - 开始新的流式对话
- `POST /api/chat/{session_id}/completions-continue` - 恢复中断的流式对话

## 会话恢复机制

1. **状态检测**：页面加载时检查 localStorage 中的流式状态
2. **自动恢复**：如果检测到中断的流式对话，显示恢复提示
3. **断点续传**：从 Redis 获取已输出内容，继续剩余内容的流式输出
4. **状态同步**：实时更新数据库和缓存中的消息状态

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- Redis 6.0+

### 安装依赖

后端：
```bash
cd backend
pip install -r requirements.txt
```

前端：
```bash
cd frontend
npm install
```

### 配置数据库和OpenAI

1. 创建 MySQL 数据库：
```sql
CREATE DATABASE streamchat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 配置环境变量：

复制 `.env.example` 到 `.env`:
```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，配置以下必要参数：
```bash
# OpenAI 配置（必须）
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# 数据库配置
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/streamchat
REDIS_URL=redis://localhost:6379
```

**重要：必须设置有效的 OpenAI API Key 才能正常使用！**

### 启动服务

1. 启动 Redis：
```bash
redis-server
```

2. 启动后端：
```bash
cd backend
python main.py
```

3. 启动前端：
```bash
cd frontend
npm run dev
```

访问 http://localhost:5173 开始使用。

## 项目结构

```
streamchat-continue/
├── backend/                 # FastAPI 后端
│   ├── main.py             # 应用入口
│   ├── database.py         # 数据库配置
│   ├── models.py           # 数据模型
│   ├── routes/             # API 路由
│   │   ├── sessions.py     # 会话管理
│   │   └── chat.py         # 聊天接口
│   ├── services/           # 业务逻辑
│   │   └── chat_service.py # 聊天服务
│   └── requirements.txt    # Python 依赖
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/     # React 组件
│   │   │   └── ChatInterface.tsx
│   │   ├── hooks/          # 自定义 Hooks
│   │   │   ├── useSSE.ts
│   │   │   └── useSessionRecovery.ts
│   │   ├── types.ts        # 类型定义
│   │   ├── api.ts          # API 客户端
│   │   ├── App.tsx         # 主应用
│   │   └── App.css         # 样式
│   └── package.json        # 前端依赖
└── README.md
```

## 核心实现亮点

1. **智能会话恢复**：
   - 页面刷新检测中断状态
   - Redis 存储流式进度
   - 断点续传机制

2. **双重存储策略**：
   - MySQL 持久化历史数据
   - Redis 缓存实时状态

3. **SSE 流式优化**：
   - 逐字符流式输出
   - 实时状态更新
   - 错误处理机制

这个实现远比你最初想象的"两个接口"复杂得多，但这才是一个真正可用的流式聊天系统应该有的样子！