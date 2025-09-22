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
    
    if (fs.existsSync(indexPath)) {
      console.log('Loading from pre-built index file');
      const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      
      // 转换为Map以提高查询性能
      ipRanges = new Map();
      indexData.forEach(range => {
        ipRanges.set(range.start, {
          end: range.end,
          country_code: range.code,
          country_name: range.name
        });
      });
      
      lastLoadTime = now;
      const loadTime = Date.now() - startTime;
      console.log(`Loaded ${ipRanges.size} IP ranges from index in ${loadTime}ms`);
      
      return ipRanges;
    }
    
    // 如果索引文件不存在，从CSV文件加载
    console.log('Index file not found, loading from CSV');
    return await loadFromCSV();
    
  } catch (error) {
    console.error('Failed to load IP data:', error);
    throw new Error('Unable to load IP geolocation data');
  }
}

/**
 * 从CSV文件加载IP数据
 */
async function loadFromCSV() {
  return new Promise((resolve, reject) => {
    const csvPath = path.join(process.cwd(), 'data', 'IP2LOCATION-LITE-DB1.CSV');
    
    if (!fs.existsSync(csvPath)) {
      return reject(new Error('CSV data file not found: ' + csvPath));
    }
    
    const ranges = [];
    const startTime = Date.now();
    
    fs.createReadStream(csvPath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        try {
          const [startIP, endIP, countryCode, countryName] = Object.values(row);
          
          ranges.push({
            start: parseInt(startIP),
            end: parseInt(endIP),
            country_code: countryCode.replace(/"/g, ''),
            country_name: countryName.replace(/"/g, '')
          });
        } catch (error) {
          console.warn('Skipping invalid CSV row:', row);
        }
      })
      .on('end', () => {
        // 按起始IP排序以支持二分查找
        ranges.sort((a, b) => a.start - b.start);
        
        // 转换为Map格式
        ipRanges = new Map();
        ranges.forEach(range => {
          ipRanges.set(range.start, {
            end: range.end,
            country_code: range.country_code,
            country_name: range.country_name
          });
        });
        
        lastLoadTime = Date.now();
        const loadTime = Date.now() - startTime;
        console.log(`Loaded ${ranges.length} IP ranges from CSV in ${loadTime}ms`);
        
        resolve(ipRanges);
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(new Error('Failed to parse CSV data: ' + error.message));
      });
  });
}

/**
 * 将IP地址转换为32位整数
 * @param {string} ip - IPv4地址字符串
 * @returns {number} - 32位无符号整数
 */
function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => {
    return (acc << 8) + parseInt(octet, 10);
  }, 0) >>> 0; // 无符号右移确保正数
}

/**
 * 使用二分查找算法查询IP地址
 * @param {number} ipNum - IP地址的数字表示
 * @param {Array} sortedRanges - 排序后的IP范围数组
 * @returns {Object|null} - 地理位置信息或null
 */
function binarySearchIP(ipNum, sortedRanges) {
  let left = 0;
  let right = sortedRanges.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const range = sortedRanges[mid];
    
    if (ipNum >= range.start && ipNum <= range.end) {
      return {
        country_code: range.country_code,
        country_name: range.country_name
      };
    }
    
    if (ipNum < range.start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  return null;
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
    // 确保数据已加载
    const ipData = await loadIPData();
    const ipNum = ipToNumber(ip);
    
    // 使用线性搜索（对于Map结构）
    for (const [startIP, info] of ipData) {
      if (ipNum >= startIP && ipNum <= info.end) {
        const responseTime = Date.now() - startTime;
        updateStats(responseTime);
        
        return {
          ip: ip,
          country_code: info.country_code,
          country_name: info.country_name
        };
      }
    }
    
    // 未找到匹配的IP范围
    const responseTime = Date.now() - startTime;
    updateStats(responseTime);
    
    return {
      ip: ip,
      country_code: 'UNKNOWN',
      country_name: 'Unknown'
    };
    
  } catch (error) {
    console.error(`Query error for IP ${ip}:`, error);
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
    // 确保数据已加载
    const ipData = await loadIPData();
    
    // 为提高性能，将Map转换为排序数组进行二分查找
    const sortedRanges = Array.from(ipData.entries()).map(([start, info]) => ({
      start: start,
      end: info.end,
      country_code: info.country_code,
      country_name: info.country_name
    }));
    
    console.log(`Processing ${ips.length} IPs with binary search`);
    
    // 并行处理所有IP
    const promises = ips.map(async (ip) => {
      try {
        const ipNum = ipToNumber(ip);
        const result = binarySearchIP(ipNum, sortedRanges);
        
        if (result) {
          return {
            ip: ip,
            data: {
              ip: ip,
              country_code: result.country_code,
              country_name: result.country_name
            }
          };
        } else {
          return {
            ip: ip,
            data: {
              ip: ip,
              country_code: 'UNKNOWN',
              country_name: 'Unknown'
            }
          };
        }
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
    rangeCount: ipRanges ? ipRanges.size : 0
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
  clearCache,
  loadIPData
};
