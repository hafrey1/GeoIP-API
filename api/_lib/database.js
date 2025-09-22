const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// 全局缓存变量
let ipRanges = null;
let lastLoadTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30分钟缓存

// 性能统计
let queryStats = {
  totalQueries: 0,
  cacheHits: 0,
  avgResponseTime: 0
};

/**
 * 加载IP地理位置数据
 * 优先使用预构建的索引文件，否则解析CSV文件
 */
async function loadIPData() {
  const now = Date.now();
  
  // 检查缓存是否仍然有效
  if (ipRanges && (now - lastLoadTime) < CACHE_TTL) {
    console.log('Using cached IP data');
    return ipRanges;
  }
  
  console.log('Loading IP geolocation data...');
  const startTime = Date.now();
  
  try {
    // 优先尝试加载预构建的索引文件
    const indexPath = path.join(process.cwd(), 'data', 'ip-ranges.json');
    
    console.log(`Checking for index file at: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
      console.log('Loading from pre-built index file');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      const indexData = JSON.parse(indexContent);
      
      console.log(`Index metadata:`, indexData.metadata);
      
      // 检查数据格式
      if (!indexData.ranges || !Array.isArray(indexData.ranges)) {
        throw new Error('Invalid index file format: missing or invalid ranges array');
      }
      
      // 转换为Map以提高查询性能
      ipRanges = new Map();
      indexData.ranges.forEach((range, index) => {
        if (!range.start || !range.end || !range.code) {
          console.warn(`Invalid range at index ${index}:`, range);
          return;
        }
        
        ipRanges.set(range.start, {
          end: range.end,
          country_code: range.code,
          country_name: range.name || 'Unknown'
        });
      });
      
      lastLoadTime = now;
      const loadTime = Date.now() - startTime;
      console.log(`Loaded ${ipRanges.size} IP ranges from index in ${loadTime}ms`);
      
      return ipRanges;
    } else {
      console.log('Index file not found, checking for CSV...');
      
      // 如果索引文件不存在，尝试从CSV文件加载
      const csvPath = path.join(process.cwd(), 'data', 'IP2LOCATION-LITE-DB1.CSV');
      console.log(`Checking for CSV file at: ${csvPath}`);
      
      if (fs.existsSync(csvPath)) {
        console.log('CSV file found, but not implemented in this version');
        throw new Error('CSV parsing not implemented in runtime - please ensure ip-ranges.json is built');
      } else {
        console.error('Neither index file nor CSV file found');
        console.log('Current working directory:', process.cwd());
        console.log('Files in data directory:');
        
        try {
          const dataDir = path.join(process.cwd(), 'data');
          if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            console.log('Data directory contents:', files);
          } else {
            console.log('Data directory does not exist');
          }
        } catch (dirError) {
          console.error('Error reading data directory:', dirError.message);
        }
        
        throw new Error('No data files found - please ensure data files are deployed');
      }
    }
    
  } catch (error) {
    console.error('Failed to load IP data:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Unable to load IP geolocation data: ${error.message}`);
  }
}

/**
 * 将IP地址转换为32位整数
 * @param {string} ip - IPv4地址字符串
 * @returns {number} - 32位无符号整数
 */
function ipToNumber(ip) {
  const octets = ip.split('.').map(Number);
  return (octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0;
}

/**
 * 查询单个IP地址的地理位置
 * @param {string} ip - IPv4地址字符串
 * @returns {Object} - 包含IP和地理位置信息的对象
 */
async function queryIP(ip) {
  const startTime = Date.now();
  queryStats.totalQueries++;
  
  try {
    console.log(`Querying IP: ${ip}`);
    
    // 确保数据已加载
    const ipData = await loadIPData();
    console.log(`Data loaded, total ranges: ${ipData.size}`);
    
    const ipNum = ipToNumber(ip);
    console.log(`IP ${ip} converted to number: ${ipNum}`);
    
    // 使用线性搜索（对于Map结构）
    for (const [startIP, info] of ipData) {
      if (ipNum >= startIP && ipNum <= info.end) {
        const responseTime = Date.now() - startTime;
        updateStats(responseTime);
        
        const result = {
          ip: ip,
          country_code: info.country_code,
          country_name: info.country_name
        };
        
        console.log(`Found match for IP ${ip}:`, result);
        return result;
      }
    }
    
    // 未找到匹配的IP范围
    const responseTime = Date.now() - startTime;
    updateStats(responseTime);
    
    const result = {
      ip: ip,
      country_code: 'UNKNOWN',
      country_name: 'Unknown'
    };
    
    console.log(`No match found for IP ${ip}, returning:`, result);
    return result;
    
  } catch (error) {
    console.error(`Query error for IP ${ip}:`, error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

/**
 * 批量查询多个IP地址的地理位置
 * @param {Array<string>} ips - IPv4地址数组
 * @returns {Object} - IP地址为键，地理位置信息为值的对象
 */
async function queryIPs(ips) {
  const startTime = Date.now();
  const results = {};
  
  try {
    console.log(`Starting batch query for ${ips.length} IPs`);
    
    // 确保数据已加载
    const ipData = await loadIPData();
    
    // 为提高性能，将Map转换为排序数组进行二分查找
    const sortedRanges = Array.from(ipData.entries()).map(([start, info]) => ({
      start: start,
      end: info.end,
      country_code: info.country_code,
      country_name: info.country_name
    }));
    
    console.log(`Processing ${ips.length} IPs with ${sortedRanges.length} ranges`);
    
    // 并行处理所有IP
    const promises = ips.map(async (ip) => {
      try {
        const ipNum = ipToNumber(ip);
        
        // 线性搜索（暂时简化）
        for (const range of sortedRanges) {
          if (ipNum >= range.start && ipNum <= range.end) {
            return {
              ip: ip,
              data: {
                ip: ip,
                country_code: range.country_code,
                country_name: range.country_name
              }
            };
          }
        }
        
        return {
          ip: ip,
          data: {
            ip: ip,
            country_code: 'UNKNOWN',
            country_name: 'Unknown'
          }
        };
      } catch (error) {
        console.error(`Error processing IP ${ip}:`, error);
        return {
          ip: ip,
          data: {
            ip: ip,
            country_code: 'ERROR',
            country_name: 'Processing Error'
          }
        };
      }
    });
    
    const ipResults = await Promise.all(promises);
    
    // 合并结果
    ipResults.forEach(({ ip, data }) => {
      results[ip] = data;
    });
    
    const responseTime = Date.now() - startTime;
    queryStats.totalQueries += ips.length;
    updateStats(responseTime / ips.length); // 平均每个IP的处理时间
    
    console.log(`Batch query completed: ${ips.length} IPs in ${responseTime}ms`);
    
    return results;
    
  } catch (error) {
    console.error('Batch query error:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

/**
 * 更新性能统计
 * @param {number} responseTime - 响应时间（毫秒）
 */
function updateStats(responseTime) {
  queryStats.avgResponseTime = 
    (queryStats.avgResponseTime * (queryStats.totalQueries - 1) + responseTime) / queryStats.totalQueries;
}

/**
 * 获取查询统计信息
 * @returns {Object} - 统计信息对象
 */
function getQueryStats() {
  return {
    ...queryStats,
    cacheStatus: ipRanges ? 'loaded' : 'empty',
    lastLoadTime: new Date(lastLoadTime).toISOString(),
    rangeCount: ipRanges ? ipRanges.size : 0,
    dataLoadedAt: lastLoadTime ? new Date(lastLoadTime).toISOString() : 'never'
  };
}

/**
 * 获取数据加载状态（调试用）
 * @returns {Object} - 详细的数据状态信息
 */
function getDataStatus() {
  const indexPath = path.join(process.cwd(), 'data', 'ip-ranges.json');
  const csvPath = path.join(process.cwd(), 'data', 'IP2LOCATION-LITE-DB1.CSV');
  
  return {
    workingDirectory: process.cwd(),
    indexFile: {
      path: indexPath,
      exists: fs.existsSync(indexPath),
      size: fs.existsSync(indexPath) ? fs.statSync(indexPath).size : 0
    },
    csvFile: {
      path: csvPath,
      exists: fs.existsSync(csvPath),
      size: fs.existsSync(csvPath) ? fs.statSync(csvPath).size : 0
    },
    cacheStatus: {
      loaded: ipRanges !== null,
      rangeCount: ipRanges ? ipRanges.size : 0,
      lastLoadTime: lastLoadTime ? new Date(lastLoadTime).toISOString() : 'never'
    }
  };
}

/**
 * 清理缓存（用于测试和调试）
 */
function clearCache() {
  ipRanges = null;
  lastLoadTime = 0;
  console.log('IP data cache cleared');
}

module.exports = {
  queryIP,
  queryIPs,
  getQueryStats,
  getDataStatus,
  clearCache,
  loadIPData
};
