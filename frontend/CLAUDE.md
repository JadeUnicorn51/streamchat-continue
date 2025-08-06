# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 React + TypeScript + Vite 的**流式聊天应用**前端，核心功能包括实时流式对话和智能会话恢复。采用 Server-Sent Events (SSE) 技术实现流式传输，支持网络中断后的自动恢复。

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run lint     # 运行ESLint检查
npm run preview  # 预览构建结果
```

## 核心架构

### 双API设计模式
```typescript
sessionApi  # 常规HTTP请求(axios): 会话管理、消息历史
chatApi     # 流式请求(fetch): 流式对话、会话恢复
```

### 关键组件结构
- `App.tsx` - 主应用：会话列表管理和路由
- `ChatInterface.tsx` - 聊天界面：消息发送、流式接收、UI交互
- `useSSE.ts` - SSE流处理：管理流式数据接收和解码
- `useSessionRecovery.ts` - 会话恢复：中断检测、状态持久化、恢复逻辑

### 流式对话实现

**SSE事件类型**:
```typescript
'content' | 'done' | 'error' | 'resume' | 'retry'
```

**关键流程**:
1. 用户发送消息 → `chatApi.startCompletion()` 
2. 建立SSE连接 → `useSSE` hook处理流式数据
3. 实时更新UI → `setCurrentStreamingMessage()` 增量显示
4. 完成或错误 → 转为历史消息或触发恢复机制

### 会话恢复机制

**自动恢复特性**:
- 页面刷新/重新打开时自动检测中断会话
- 24小时内有效，最多重试5次
- LocalStorage持久化状态 (`streamchat_streaming_state`)
- 智能重试计数和错误提示

**状态管理**:
```typescript
interface StreamingState {
  sessionId: string;
  isStreaming: boolean; 
  lastMessageId?: string;
  timestamp: number;
  retryCount?: number;
}
```

## 重要技术细节

### 状态管理策略
- **无外部状态库**：使用React原生状态 + localStorage
- **会话状态**：`useSessionRecovery` 统一管理
- **UI状态**：各组件独立管理，通过props传递

### 错误处理模式
- **流式中断**：保留部分内容，显示恢复提示
- **网络错误**：增加重试计数，保持恢复选项
- **API失败**：友好提示，不清理恢复状态

### 内存管理
- SSE流必须正确关闭避免内存泄漏
- 组件卸载时清理事件监听器
- `beforeunload` 事件保存流式状态

## 开发注意事项

### 修改恢复逻辑时
- 状态清理时机很关键：只有成功完成才清理，错误时保留重试机会
- `ChatInterface` 和 `useSessionRecovery` 的状态管理要保持一致
- 重试计数和过期时间需要合理设置

### API交互模式
- 常规操作用 `sessionApi` (axios)
- 流式对话用 `chatApi` (fetch + SSE)
- 错误处理要区分网络错误和业务错误

### 类型安全
- 所有API响应都有完整的TypeScript类型定义
- SSE数据类型必须与后端保持同步
- 状态更新时要确保类型安全

## 调试流式功能

开发者工具中查看：
- Network tab → EventStream 查看SSE连接
- Application → Local Storage → `streamchat_*` 查看持久化状态  
- Console 中的恢复相关日志

## 常见修改场景

### 添加新的SSE事件类型
1. 更新 `types.ts` 中的 `SSEData` 接口
2. 在 `ChatInterface.tsx` 的 `handleSSEData` 中添加处理逻辑
3. 必要时更新 `useSessionRecovery.ts` 中的恢复处理

### 修改恢复策略
- 调整 `RECOVERY_EXPIRE_TIME` 和 `MAX_RETRY_COUNT` 常量
- 修改 `StreamingState` 接口添加新字段
- 更新状态检查和清理逻辑