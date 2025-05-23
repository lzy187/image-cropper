# Image Anchor Cropper | 动态区域锚定裁切工具

一个基于 Next.js 和 Canvas API 开发的图片裁切工具，支持用户选择锚点区域，并基于该区域进行智能裁切生成。


### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
npm start
```

## 部署选项

### 网页应用部署
推荐使用 Vercel 进行部署：
1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 自动部署完成

### 桌面应用打包
项目支持使用 Tauri 打包为桌面应用：
```bash
# 需要先安装 Rust 环境
npm run desktop        # 开发模式
npm run desktop-build  # 构建桌面应用
```

## 技术栈
- Next.js 14.1.0
- React 18.2.0
- TypeScript 5.3.3
- Canvas API
- Material-UI
- JSZip (用于批量下载)
- Tauri (可选，用于桌面应用)
