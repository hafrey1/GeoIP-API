// 验证IP地址格式
function validateIP(ip) {
  const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

// 清理和验证IP数组
function sanitizeIPs(ips) {
  const valid = [];
  const invalid = [];

  for (const ip of ips) {
    if (typeof ip === 'string' && validateIP(ip.trim())) {
      const cleanIP = ip.trim();
      if (!valid.includes(cleanIP)) { // 去重
        valid.push(cleanIP);
      }
    } else {
      invalid.push(ip);
    }
  }

  return { valid, invalid };
}

// IP地址转换为整数
function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// 整数转换为IP地址
function longToIp(long) {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255
  ].join('.');
}

module.exports = {
  validateIP,
  sanitizeIPs,
  ipToLong,
  longToIp
};
