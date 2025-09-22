/**
 * IPv4地址格式验证
 * 支持标准IPv4格式：0.0.0.0 - 255.255.255.255
 * @param {string} ip - 待验证的IP地址字符串
 * @returns {boolean} - 验证结果
 */
function validateIP(ip) {
  if (typeof ip !== 'string') {
    return false;
  }
  
  // IPv4正则表达式
  const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  
  // 额外验证：确保不是保留地址
  const octets = ip.split('.').map(Number);
  
  // 排除 0.0.0.0
  if (octets.every(octet => octet === 0)) {
    return false;
  }
  
  // 排除 255.255.255.255
  if (octets.every(octet => octet === 255)) {
    return false;
  }
  
  return true;
}

/**
 * 批量IP地址验证
 * @param {Array<string>} ips - IP地址数组
 * @returns {Object} - 包含有效和无效IP的分类结果
 */
function validateIPs(ips) {
  const results = {
    valid: [],
    invalid: [],
    duplicates: [],
    stats: {
      total: ips.length,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0
    }
  };
  
  const seen = new Set();
  
  ips.forEach((ip, index) => {
    // 检查重复
    if (seen.has(ip)) {
      results.duplicates.push({ ip, index });
      results.stats.duplicateCount++;
      return;
    }
    seen.add(ip);
    
    // 验证格式
    if (validateIP(ip)) {
      results.valid.push(ip);
      results.stats.validCount++;
    } else {
      results.invalid.push({ ip, index, reason: 'Invalid IPv4 format' });
      results.stats.invalidCount++;
    }
  });
  
  return results;
}

/**
 * IP地址转换为32位整数
 * @param {string} ip - IPv4地址字符串
 * @returns {number} - 32位无符号整数
 */
function ipToNumber(ip) {
  const octets = ip.split('.').map(Number);
  return (octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0;
}

/**
 * 32位整数转换为IP地址
 * @param {number} num - 32位无符号整数
 * @returns {string} - IPv4地址字符串
 */
function numberToIP(num) {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

/**
 * 检查IP是否在指定范围内
 * @param {string} ip - 待检查的IP地址
 * @param {string} startIP - 起始IP地址
 * @param {string} endIP - 结束IP地址
 * @returns {boolean} - 是否在范围内
 */
function isIPInRange(ip, startIP, endIP) {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(startIP);
  const endNum = ipToNumber(endIP);
  
  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * 将数组分割成指定大小的块
 * @param {Array} array - 原数组
 * @param {number} chunkSize - 块大小
 * @returns {Array<Array>} - 分割后的数组块
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  
  return chunks;
}

/**
 * 生成随机IP地址（用于测试）
 * @param {number} count - 生成数量
 * @param {boolean} includePrivate - 是否包含私有IP
 * @returns {Array<string>} - 随机IP地址数组
 */
function generateRandomIPs(count = 1, includePrivate = false) {
  const ips = [];
  
  for (let i = 0; i < count; i++) {
    let ip;
    
    do {
      const octets = [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
      ];
      
      ip = octets.join('.');
      
      // 如果不包含私有IP，则排除私有地址范围
      if (!includePrivate && isPrivateIP(ip)) {
        continue;
      }
      
      break;
    } while (true);
    
    ips.push(ip);
  }
  
  return ips;
}

/**
 * 检查是否为私有IP地址
 * @param {string} ip - IP地址
 * @returns {boolean} - 是否为私有IP
 */
function isPrivateIP(ip) {
  const ipNum = ipToNumber(ip);
  
  // 10.0.0.0/8
  if (ipNum >= ipToNumber('10.0.0.0') && ipNum <= ipToNumber('10.255.255.255')) {
    return true;
  }
  
  // 172.16.0.0/12
  if (ipNum >= ipToNumber('172.16.0.0') && ipNum <= ipToNumber('172.31.255.255')) {
    return true;
  }
  
  // 192.168.0.0/16
  if (ipNum >= ipToNumber('192.168.0.0') && ipNum <= ipToNumber('192.168.255.255')) {
    return true;
  }
  
  // 127.0.0.0/8 (localhost)
  if (ipNum >= ipToNumber('127.0.0.0') && ipNum <= ipToNumber('127.255.255.255')) {
    return true;
  }
  
  return false;
}

/**
 * 获取IP地址的类型信息
 * @param {string} ip - IP地址
 * @returns {Object} - IP类型信息
 */
function getIPInfo(ip) {
  if (!validateIP(ip)) {
    return {
      valid: false,
      type: 'invalid',
      class: null,
      private: false
    };
  }
  
  const octets = ip.split('.').map(Number);
  const firstOctet = octets[0];
  
  let ipClass = 'Unknown';
  if (firstOctet <= 127) {
    ipClass = 'A';
  } else if (firstOctet <= 191) {
    ipClass = 'B';
  } else if (firstOctet <= 223) {
    ipClass = 'C';
  } else if (firstOctet <= 239) {
    ipClass = 'D';
  } else {
    ipClass = 'E';
  }
  
  return {
    valid: true,
    type: 'ipv4',
    class: ipClass,
    private: isPrivateIP(ip),
    octets: octets,
    decimal: ipToNumber(ip)
  };
}

/**
 * 格式化IP统计信息
 * @param {Array<string>} ips - IP地址数组
 * @returns {Object} - 统计信息
 */
function getIPStats(ips) {
  const stats = {
    total: ips.length,
    valid: 0,
    invalid: 0,
    private: 0,
    public: 0,
    classes: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    uniqueIPs: 0,
    duplicates: 0
  };
  
  const uniqueIPs = new Set();
  
  ips.forEach(ip => {
    const info = getIPInfo(ip);
    
    if (info.valid) {
      stats.valid++;
      
      if (info.private) {
        stats.private++;
      } else {
        stats.public++;
      }
      
      if (info.class && stats.classes[info.class] !== undefined) {
        stats.classes[info.class]++;
      }
    } else {
      stats.invalid++;
    }
    
    if (uniqueIPs.has(ip)) {
      stats.duplicates++;
    } else {
      uniqueIPs.add(ip);
    }
  });
  
  stats.uniqueIPs = uniqueIPs.size;
  
  return stats;
}

module.exports = {
  validateIP,
  validateIPs,
  ipToNumber,
  numberToIP,
  isIPInRange,
  chunkArray,
  generateRandomIPs,
  isPrivateIP,
  getIPInfo,
  getIPStats
};
