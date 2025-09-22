# GeoIP-API Vercel版

> 基于Vercel Serverless Functions的高性能IP地理位置查询API服务，支持IP地址和域名查询
> 

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/geoip-api-vercel)

## ✨ 特性

### 🌟 核心功能

- 🔍 **IP地址查询** - 精确的IPv4地理位置查询
- 🌐 **域名查询** - 自动DNS解析后查询地理位置 ⭐ 新增
- 📦 **混合批量查询** - 支持IP和域名混合批量查询 ⭐ 新增
- ⚡ **智能识别** - 自动识别输入类型（IP/域名）

### 🚀 性能优化

- 🔥 **Serverless架构** - Vercel边缘计算网络，超低延迟
- 📊 **高性能算法** - 二分查找 + 内存缓存，平均50ms响应
- 🔄 **智能缓存** - 30分钟内存缓存 + 5分钟CDN缓存
- 🔀 **并发处理** - 批量查询支持最多500个输入并发处理

### 🛡️ 可靠性

- 📈 **性能监控** - 详细的性能追踪和错误日志
- 🔒 **完整CORS** - 支持所有域名跨域请求
- 🛠️ **数据验证** - 严格的格式验证和错误处理
- ⏰ **超时保护** - DNS解析和查询超时保护

## 🚀 快速开始

### 方法1：一键部署到Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/geoip-api-vercel)

### 方法2：本地开发

```bash
# 克隆项目
git clone https://github.com/your-username/geoip-api-vercel.git
cd geoip-api-vercel

# 安装依赖
npm install

# 构建索引文件
npm run build

# 启动开发服务器
npm run dev

# 访问本地API
open http://localhost:3000
```

## 📡 API端点

### 🏠 基础信息

```
GET /api/index
```

返回API详细信息、使用指南和性能指标。

### ❤️ 健康检查

```
GET /api/health
```

返回服务状态、系统信息和性能统计。

### 🔍 单个查询

**IP地址查询**:

```
GET /api/lookup?ip=8.8.8.8
```

**域名查询** ⭐ 新增:

```
GET /api/lookup?domain=[google.com](http://google.com)
```

**示例**:

```bash
# IP查询
curl "https://your-app.vercel.app/api/lookup?ip=8.8.8.8"

# 域名查询
curl "https://your-app.vercel.app/api/lookup?domain=google.com"
```

**响应格式**:

```json
{
  "success": true,
  "data": {
    "[google.com](http://google.com)": {
      "input": "[google.com](http://google.com)",
      "input_type": "domain",
      "resolved_ip": "8.8.8.8",
      "ip": "8.8.8.8",
      "country_code": "US",
      "country_name": "United States"
    }
  },
  "stats": {
    "total": 1,
    "valid": 1,
    "processed": 1,
    "response_time_ms": 156,
    "dns_resolution_time_ms": 89,
    "geo_query_time_ms": 67
  },
  "cache_info": {
    "ttl_seconds": 300,
    "cached_at": "2025-09-22T14:00:00.000Z"
  }
}
```

### 📦 批量查询

**传统IP批量查询**:

```
POST /api/batch
Content-Type: application/json
```

```json
{
  "ips": ["8.8.8.8", "1.1.1.1", "114.114.114.114"]
}
```

**混合批量查询** ⭐ 新增:

```
POST /api/batch
Content-Type: application/json
```

```json
{
  "inputs": [
    "8.8.8.8",
    "[google.com](http://google.com)",
    "1.1.1.1",
    "[cloudflare.com](http://cloudflare.com)",
    "[baidu.com](http://baidu.com)"
  ]
}
```

**批量查询示例**:

```bash
# 混合批量查询
curl -X POST "https://your-app.vercel.app/api/batch" \
  -H "Content-Type: application/json" \
  -d '{"inputs":["8.8.8.8","[google.com](http://google.com)","1.1.1.1","[cloudflare.com](http://cloudflare.com)"]}'

# 传统IP批量查询（向下兼容）
curl -X POST "https://your-app.vercel.app/api/batch" \
  -H "Content-Type: application/json" \
  -d '{"ips":["8.8.8.8","1.1.1.1","114.114.114.114"]}'
```

## 📊 性能指标

### ⚡ 响应时间

- **单个IP查询**: 50-100ms
- **单个域名查询**: 150-300ms（含DNS解析）
- **小批量查询** (1-50个输入): ~200ms
- **中等批量查询** (50-200个输入): ~800ms
- **大批量查询** (200-500个输入): 2-5秒

### 📏 使用限制

- **最大批量大小**: 500个输入/请求
- **最大域名解析**: 100个域名/请求
- **内存限制**: 1024MB（批量查询）
- **执行时间**: 最大30秒
- **DNS超时**: 5秒/域名
- **并发处理**: Vercel自动扩展

### 🎯 DNS解析性能

- **并行解析**: 支持多个域名同时解析
- **超时保护**: 5秒DNS解析超时
- **错误处理**: 详细的DNS错误信息
- **成功率统计**: 实时DNS解析成功率

## 🏗️ 架构设计

### 📁 项目结构

```
geoip-api-vercel/
├── api/                    # Serverless Functions
│   ├── index.js           # 主页面和API信息
│   ├── health.js          # 健康检查
│   ├── lookup.js          # 单个查询（IP/域名）
│   ├── batch.js           # 批量查询（混合）
│   └── _lib/              # 共享库
│       ├── database.js    # 数据库操作引擎
│       ├── ipUtils.js     # IP/域名处理工具
│       └── monitor.js     # 性能监控
├── data/                  # 数据文件
│   ├── IP2LOCATION-LITE-DB1.CSV
│   └── ip-ranges.json     # 预构建索引
├── scripts/               # 构建脚本
│   └── build-index.js     # 索引构建器
├── .github/workflows/     # CI/CD配置
│   └── deploy.yml         # 自动部署
├── package.json           # 项目配置
├── vercel.json           # Vercel部署配置
└── [README.md](http://README.md)             # 项目文档
```

### 🛠️ 技术栈

- **Runtime**: Vercel Serverless Functions (Node.js 18+)
- **DNS解析**: Node.js DNS模块 + DNS over HTTPS备用
- **存储**: 内存缓存 + JSON索引文件
- **算法**: 二分查找 + 并发处理
- **监控**: 自定义性能追踪 + Vercel Analytics
- **部署**: GitHub Actions + Vercel平台

## 🔧 配置和部署

### 🌍 环境变量

```bash
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=1024
```

### ⚙️ Vercel配置 (vercel.json)

```json
{
  "functions": {
    "api/batch.js": {
      "memory": 1024,
      "maxDuration": 30
    },
    "api/lookup.js": {
      "memory": 512,
      "maxDuration": 15
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=300, stale-while-revalidate=600"
        }
      ]
    }
  ]
}
```

### 🚀 Vercel部署

```bash
# 使用Vercel CLI
npm i -g vercel
vercel --prod

# 或推送到GitHub（自动部署）
git push origin main
```

## 📈 性能优化策略

### 🔄 缓存策略

- **函数级缓存**: 30分钟内存缓存
- **CDN缓存**: 5分钟边缘缓存
- **DNS缓存**: 智能DNS结果缓存
- **智能失效**: 自动缓存失效和更新

### ⚡ 查询优化

1. **预构建索引**: 启动时生成优化的JSON索引
2. **二分查找**: O(log n)复杂度的IP范围查询
3. **并发DNS**: Promise.all并行DNS解析
4. **批量处理**: 智能分批并发处理
5. **超时控制**: 多层超时保护机制

### 📊 监控指标

- 实时性能统计
- DNS解析成功率
- 错误率追踪
- 内存使用监控
- 响应时间分析

## 🛠️ 开发指南

### 🔧 本地开发

```bash
# 启动开发服务器
npm run dev

# 访问本地API
open http://localhost:3000

# 测试API端点
curl "http://localhost:3000/api/lookup?ip=8.8.8.8"
curl "http://localhost:3000/api/lookup?domain=google.com"
```

### 🏗️ 构建和测试

```bash
# 构建优化索引
npm run build

# 验证索引文件
node scripts/verify-index.js

# 运行测试
npm test

# 性能基准测试
npm run benchmark
```

### 🐛 调试

```bash
# 查看详细日志
DEBUG=geoip:* npm run dev

# 测试DNS解析
node -e "console.log(require('dns').resolve4('[google.com](http://google.com)', console.log))"
```

## 📄 数据源和许可

### 🗄️ IP地理位置数据

本项目使用 [IP2Location LITE](https://lite.ip2location.com) 免费数据库：

- **文件**: `IP2LOCATION-LITE-DB1.CSV`
- **内容**: IP范围到国家代码的精确映射
- **更新**: 建议每月更新一次
- **许可**: 遵循IP2Location LITE许可协议

### 🔄 数据更新流程

1. 访问 [IP2Location LITE下载页面](https://lite.ip2location.com/database/ip-country)
2. 下载最新的 `IP2LOCATION-LITE-DB1.CSV`
3. 替换 `data/IP2LOCATION-LITE-DB1.CSV` 文件
4. 运行 `npm run build` 重新构建索引
5. 重新部署到Vercel

## 🔍 API使用示例

### JavaScript/Node.js

```jsx
// 单个IP查询
const response = await fetch('https://your-app.vercel.app/api/lookup?ip=8.8.8.8');
const data = await response.json();
console.log([data.data](http://data.data)['8.8.8.8'].country_name); // "United States"

// 域名查询
const domainResponse = await fetch('https://your-app.vercel.app/api/lookup?domain=google.com');
const domainData = await domainResponse.json();
console.log([domainData.data](http://domainData.data)['[google.com](http://google.com)'].country_name); // "United States"

// 批量混合查询
const batchResponse = await fetch('https://your-app.vercel.app/api/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputs: ['8.8.8.8', '[google.com](http://google.com)', '1.1.1.1', '[cloudflare.com](http://cloudflare.com)']
  })
});
const batchData = await batchResponse.json();
```

### Python

```python
import requests

# 单个查询
response = requests.get('https://your-app.vercel.app/api/lookup?domain=google.com')
data = response.json()
print(data['data']['[google.com](http://google.com)']['country_name'])  # "United States"

# 批量查询
batch_response = [requests.post](http://requests.post)(
    'https://your-app.vercel.app/api/batch',
    json={'inputs': ['8.8.8.8', '[google.com](http://google.com)', '1.1.1.1']}
)
batch_data = batch_response.json()
```

### cURL

```bash
# IP查询
curl "https://your-app.vercel.app/api/lookup?ip=8.8.8.8"

# 域名查询  
curl "https://your-app.vercel.app/api/lookup?domain=google.com"

# 批量查询
curl -X POST "https://your-app.vercel.app/api/batch" \
  -H "Content-Type: application/json" \
  -d '{"inputs":["8.8.8.8","[google.com](http://google.com)"]}'
```

## 📊 监控和维护

### ❤️ 健康检查

```bash
# 检查服务状态
curl https://your-app.vercel.app/api/health
```

### 📈 性能监控

- Vercel Analytics仪表板
- 函数执行时间监控
- DNS解析成功率统计
- 内存和错误率监控

### 🔧 故障排除

1. **DNS解析失败**: 检查域名有效性和DNS服务器状态
2. **查询超时**: 减少批量大小或检查网络连接
3. **内存不足**: 优化批量大小或升级Vercel计划
4. **IP未找到**: 确认使用最新的IP2Location数据

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 🔄 贡献流程

1. Fork本仓库到你的GitHub账号
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

### 💡 贡献类型

- 🐛 Bug修复和问题报告
- ✨ 新功能开发
- 📚 文档改进
- 🎨 代码优化和重构
- 🧪 测试用例添加

## 📜 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- ☁️ [Vercel平台](https://vercel.com)
- 🗄️ [IP2Location LITE](https://lite.ip2location.com)
- 📊 [性能监控](https://vercel.com/dashboard)

## 🎯 路线图

### 🚀 即将推出

- [ ]  IPv6地址支持
- [ ]  更详细的地理位置信息（城市、ISP）
- [ ]  GraphQL API端点
- [ ]  Webhook通知功能
- [ ]  API使用统计仪表板

### 💡 长期计划

- [ ]  多数据源支持
- [ ]  机器学习地理位置预测
- [ ]  实时IP地理位置更新
- [ ]  企业级SLA支持

---

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！您的支持是我们持续改进的动力。**

**🤝 有问题或建议？欢迎提交Issue或直接联系我们！**
