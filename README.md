# GeoIP-API Vercel版

> 基于Vercel Serverless Functions的高性能IP地理位置查询API服务
> 

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/geoip-api-vercel)

## ✨ 特性

- 🚀 **Vercel Serverless Functions** - 每个API端点都是独立的无服务器函数
- 🌐 **全球CDN加速** - Vercel边缘网络，超低延迟响应
- ⚡ **高性能算法** - 二分查找 + 内存缓存，平均50ms响应时间
- 📊 **批量查询优化** - 单次请求支持最多500个IP地址查询
- 🔄 **智能缓存** - 30分钟内存缓存 + 5分钟CDN缓存
- 📈 **性能监控** - 内置详细的性能追踪和错误日志
- 🔒 **完整CORS支持** - 支持所有域名的跨域请求
- 🛡️ **数据验证** - 严格的IPv4格式验证和错误处理

## 🚀 快速开始

### 方法1：一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/geoip-api-vercel)

### 方法2：本地开发

```bash
# 克隆项目
git clone https://github.com/your-username/geoip-api-vercel.git
cd geoip-api-vercel

# 安装依赖
npm install

# 下载IP地理位置数据
# 访问 https://lite.ip2location.com/database/ip-country
# 下载 IP2LOCATION-LITE-DB1.CSV 并放置在 data/ 目录

# 构建优化索引
npm run build

# 本地开发
npm run dev

# 部署到生产环境
npm run deploy
```

## 📡 API端点

### 基础信息

```
GET /
```

返回API详细信息、使用指南和性能指标。

### 健康检查

```
GET /health
```

返回服务状态、系统信息和性能统计。

### 单个IP查询

```
GET /api/lookup?ip={ip_address}
```

**示例：**

```bash
curl "https://your-app.vercel.app/api/lookup?ip=8.8.8.8"
```

**响应：**

```json
{
  "success": true,
  "data": {
    "8.8.8.8": {
      "ip": "8.8.8.8",
      "country_code": "US",
      "country_name": "United States"
    }
  },
  "stats": {
    "total": 1,
    "valid": 1,
    "processed": 1,
    "response_time_ms": 45
  }
}
```

### 批量IP查询

```
POST /api/batch
Content-Type: application/json
```

**请求体：**

```json
{
  "ips": ["8.8.8.8", "1.1.1.1", "114.114.114.114"]
}
```

**示例：**

```bash
curl -X POST "https://your-app.vercel.app/api/batch" \
  -H "Content-Type: application/json" \
  -d '{"ips":["8.8.8.8","1.1.1.1","114.114.114.114"]}'
```

## 📊 性能指标

### 响应时间

- **单个IP查询**: 50-100ms
- **小批量查询** (1-50个IP): ~200ms
- **中等批量查询** (50-200个IP): ~800ms
- **大批量查询** (200-500个IP): 2-5秒

### 使用限制

- **最大批量大小**: 500个IP/请求
- **内存限制**: 1024MB (批量查询)
- **执行时间**: 最大30秒
- **并发处理**: Vercel自动扩展

## 🏗️ 架构设计

### 项目结构

```
geoip-api-vercel/
├── api/                    # Serverless Functions
│   ├── index.js           # 主页面和API信息
│   ├── health.js          # 健康检查
│   ├── lookup.js          # 单个IP查询
│   ├── batch.js           # 批量IP查询
│   └── _lib/              # 共享库
│       ├── database.js    # 数据库操作引擎
│       ├── ipUtils.js     # IP处理工具
│       └── monitor.js     # 性能监控
├── data/                  # 数据文件
│   ├── IP2LOCATION-LITE-DB1.CSV
│   └── ip-ranges.json     # 优化索引
├── scripts/               # 构建脚本
│   └── build-index.js     # 索引构建器
└── .github/workflows/     # CI/CD配置
```

### 技术栈

- **Runtime**: Vercel Serverless Functions (Node.js 18+)
- **Storage**: 内存缓存 + JSON索引文件
- **Algorithm**: 二分查找 + 并发处理
- **Monitoring**: 自定义性能追踪
- **Deployment**: GitHub Actions + Vercel

## 🔧 配置选项

### 环境变量

```bash
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=1024
```

### Vercel配置 (vercel.json)

```json
{
  "functions": {
    "api/batch.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

## 📈 性能优化

### 数据处理优化

1. **预构建索引**: 启动时生成优化的JSON索引文件
2. **二分查找**: O(log n)复杂度的IP范围查询
3. **内存缓存**: 30分钟TTL缓存减少数据加载
4. **并发处理**: Promise.all并行处理批量查询

### 缓存策略

- **函数级缓存**: 30分钟内存缓存
- **CDN缓存**: 5分钟边缘缓存
- **智能失效**: 自动缓存失效和更新

### 监控指标

- 实时性能统计
- 错误率追踪
- 内存使用监控
- 响应时间分析

## 🛠️ 开发指南

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 访问本地API
open http://localhost:3000
```

### 构建索引

```bash
# 生成优化索引文件
npm run build

# 验证索引文件
node scripts/verify-index.js
```

### 测试API

```bash
# 运行API测试
npm test

# 性能基准测试
npm run benchmark
```

## 📄 数据源

本项目使用 [IP2Location LITE](https://lite.ip2location.com/) 免费数据库：

- **文件**: IP2LOCATION-LITE-DB1.CSV
- **包含**: IP范围到国家的映射关系
- **更新**: 建议每月更新一次
- **许可**: 遵循IP2Location LITE许可协议

### 数据更新

1. 访问 [IP2Location LITE下载页面](https://lite.ip2location.com/database/ip-country)
2. 下载最新的 `IP2LOCATION-LITE-DB1.CSV`
3. 替换 `data/IP2LOCATION-LITE-DB1.CSV`
4. 运行 `npm run build` 重新构建索引
5. 重新部署应用

## 🚀 部署

### Vercel部署

```bash
# 使用Vercel CLI
vercel --prod

# 或使用GitHub集成
git push origin main  # 自动触发部署
```

### 环境配置

在Vercel Dashboard设置以下环境变量：

- `NODE_ENV`: `production`
- `NODE_OPTIONS`: `--max-old-space-size=1024`

## 📊 监控和维护

### 健康检查

```bash
# 检查服务状态
curl https://your-app.vercel.app/health
```

### 性能监控

- 查看Vercel Analytics仪表板
- 监控函数执行时间和错误率
- 定期检查内存使用情况

### 故障排除

- 检查Vercel函数日志
- 验证数据文件完整性
- 确认API请求格式正确

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 📜 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- [Vercel Platform](https://vercel.com/)
- [IP2Location LITE](https://lite.ip2location.com/)
- [项目文档](./docs/)
- [API测试工具](https://your-app.vercel.app/)

---

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！**
