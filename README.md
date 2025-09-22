# GeoIP-API

基于IP2LOCATION-LITE-DB1.CSV的批量IP地理位置查询API服务，支持Railway一键部署。

[Node.js]()

[License]()

[Railway]()

## ✨ 特性

- 🚀 **Railway一键部署** - 支持Railway平台直接部署
- 📊 **批量查询支持** - 单次请求可查询多个IP地址（最多100个）
- 🌐 **RESTful API** - 标准的REST接口设计
- 💾 **内存数据库** - 使用SQLite内存数据库提高查询性能
- 📝 **详细日志** - 完整的请求和错误日志记录
- 🔒 **CORS支持** - 支持跨域请求
- 🛡️ **安全防护** - 集成Helmet安全中间件
- 📦 **数据压缩** - 自动响应压缩减少带宽使用

## 🚀 快速部署

### Railway部署（推荐）

1. 点击下面的按钮一键部署到Railway：

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

1. 或者手动部署：
    - Fork本项目到你的GitHub账户
    - 在Railway中连接你的GitHub仓库
    - 选择`geoip-api`项目进行部署
    - Railway会自动检测并部署Node.js项目

### 本地运行

```bash
# 克隆项目
git clone https://github.com/your-username/geoip-api.git
cd geoip-api

# 安装依赖
npm install

# 下载IP2Location数据库
# 请访问 https://lite.ip2location.com 下载 IP2LOCATION-LITE-DB1.CSV
# 将文件放置在 data/ 目录下

# 启动服务
npm start
```

## 📋 数据准备

1. 访问 [IP2Location LITE](https://lite.ip2location.com)
2. 注册账户并下载 **IP2LOCATION-LITE-DB1.CSV** 文件
3. 将CSV文件放置在项目的 `data/` 目录下
4. 文件结构应该是：`data/IP2LOCATION-LITE-DB1.CSV`

## 📚 API文档

### 基础信息

```
基础URL: https://your-app.railway.app
```

### 端点列表

### 1. 健康检查

```
GET /health
```

响应：

```json
{
  "status": "ok", 
  "timestamp": "2025-09-22T10:20:15.123Z"
}
```

### 2. 单个IP查询

```
GET /api/lookup?ip={ip_address}
```

**参数：**

- `ip` (必需): 要查询的IP地址

**示例：**

```bash
curl "https://your-app.railway.app/api/lookup?ip=8.8.8.8"
```

**响应：**

```json
{
  "success": true,
  "data": {
    "ip": "8.8.8.8",
    "country_code": "US",
    "country_name": "United States"
  }
}
```

### 3. 批量IP查询

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
curl -X POST "https://your-app.railway.app/api/batch" \
  -H "Content-Type: application/json" \
  -d '{"ips": ["8.8.8.8", "1.1.1.1", "114.114.114.114"]}'
```

**响应：**

```json
{
  "success": true,
  "count": 3,
  "data": {
    "8.8.8.8": {
      "ip": "8.8.8.8",
      "country_code": "US",
      "country_name": "United States"
    },
    "1.1.1.1": {
      "ip": "1.1.1.1",
      "country_code": "US",
      "country_name": "United States"
    },
    "114.114.114.114": {
      "ip": "114.114.114.114",
      "country_code": "CN",
      "country_name": "China"
    }
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误描述",
  "details": "详细错误信息（可选）"
}
```

### 限制

- 批量查询最多支持100个IP地址
- 请求体最大10MB
- 自动去重复的IP地址

## 🛠️ 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: SQLite (内存模式)
- **数据源**: IP2Location LITE DB1
- **部署**: Railway Platform

## 📁 项目结构

```
geoip-api/
├── src/
│   ├── index.js          # 主服务文件
│   ├── database.js       # 数据库操作
│   ├── routes/
│   │   └── api.js        # API路由
│   └── utils/
│       └── ipUtils.js    # IP处理工具
├── data/
│   └── IP2LOCATION-LITE-DB1.CSV  # IP数据库文件
├── package.json          # 依赖配置
├── railway.json          # Railway部署配置
├── .gitignore           # Git忽略文件
└── [README.md](http://README.md)            # 项目文档
```

## 🔧 环境变量

- `PORT` - 服务端口（默认: 3000）
- `NODE_ENV` - 运行环境（production/development）

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献

欢迎贡献代码！请先fork项目，然后创建feature分支提交Pull Request。

## 📞 支持

如果您遇到问题或有建议，请创建 [Issue](https://github.com/your-username/geoip-api/issues)。

---

**注意**: 请确保遵守IP2Location的使用条款和条件。
