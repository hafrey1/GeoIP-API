const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

let db = null;

// 初始化内存数据库
function initDatabase() {
  return new Promise((resolve, reject) => {
    // 创建内存数据库
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Error creating database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite in-memory database');
    });

    // 创建表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ip2location (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_from INTEGER,
        ip_to INTEGER,
        country_code TEXT,
        country_name TEXT
      )
    `;

    db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating table:', err);
        reject(err);
        return;
      }

      // 创建索引提高查询性能
      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_ip_range 
        ON ip2location(ip_from, ip_to)
      `;

      db.run(createIndexSQL, (err) => {
        if (err) {
          console.error('Error creating index:', err);
          reject(err);
          return;
        }

        // 加载CSV数据
        loadCSVData()
          .then(() => resolve())
          .catch(reject);
      });
    });
  });
}

// 加载CSV数据到数据库
function loadCSVData() {
  return new Promise((resolve, reject) => {
    const csvFilePath = path.join(__dirname, '..', 'data', 'IP2LOCATION-LITE-DB1.CSV');
    
    // 检查CSV文件是否存在
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found at: ${csvFilePath}`);
      console.log('Please download IP2LOCATION-LITE-DB1.CSV from https://lite.ip2location.com');
      reject(new Error('CSV file not found'));
      return;
    }

    console.log('Loading IP2Location data from CSV...');
    let rowCount = 0;
    const batchSize = 1000;
    const batch = [];

    const insertSQL = `
      INSERT INTO ip2location (ip_from, ip_to, country_code, country_name)
      VALUES (?, ?, ?, ?)
    `;

    const stmt = db.prepare(insertSQL);

    fs.createReadStream(csvFilePath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        // IP2Location LITE DB1 CSV格式: ip_from, ip_to, country_code, country_name
        const rowData = Object.values(row);
        if (rowData.length >= 4) {
          batch.push([
            parseInt(rowData[0]), // ip_from
            parseInt(rowData[1]), // ip_to
            rowData[2] || '',     // country_code
            rowData[3] || ''      // country_name
          ]);

          if (batch.length >= batchSize) {
            // 批量插入
            for (const data of batch) {
              stmt.run(data);
            }
            rowCount += batch.length;
            batch.length = 0; // 清空批次
            
            if (rowCount % 10000 === 0) {
              console.log(`Loaded ${rowCount} records...`);
            }
          }
        }
      })
      .on('end', () => {
        // 插入剩余的数据
        for (const data of batch) {
          stmt.run(data);
        }
        rowCount += batch.length;

        stmt.finalize((err) => {
          if (err) {
            console.error('Error finalizing statement:', err);
            reject(err);
          } else {
            console.log(`✅ Successfully loaded ${rowCount} IP location records`);
            resolve();
          }
        });
      })
      .on('error', (err) => {
        console.error('Error reading CSV file:', err);
        reject(err);
      });
  });
}

// IP地址转换为整数
function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// 查询单个IP
function lookupIP(ip) {
  return new Promise((resolve, reject) => {
    const ipInt = ipToInt(ip);
    const sql = `
      SELECT country_code, country_name 
      FROM ip2location 
      WHERE ip_from <= ? AND ip_to >= ? 
      LIMIT 1
    `;

    db.get(sql, [ipInt, ipInt], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        resolve({
          ip,
          country_code: row.country_code,
          country_name: row.country_name
        });
      } else {
        resolve({
          ip,
          country_code: 'UNKNOWN',
          country_name: 'Unknown'
        });
      }
    });
  });
}

// 批量查询IP
async function lookupIPs(ips) {
  const results = {};
  
  for (const ip of ips) {
    try {
      results[ip] = await lookupIP(ip);
    } catch (error) {
      results[ip] = {
        ip,
        error: 'Lookup failed',
        country_code: 'ERROR',
        country_name: 'Error'
      };
    }
  }
  
  return results;
}

module.exports = {
  initDatabase,
  lookupIP,
  lookupIPs
};
