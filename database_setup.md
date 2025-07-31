# 数据库视图设置

## 创建最新空气质量数据视图

为了优化查询性能，需要在Supabase数据库中创建一个视图来获取每个站点的最新数据。

### SQL语句

```sql
CREATE VIEW latest_luftqualitaet AS
SELECT DISTINCT ON (station_id) 
    station_id,
    station_name,
    timestamp,
    no2,
    pm10,
    pm2,
    o3,
    created_at
FROM luftqualitaet 
ORDER BY station_id, timestamp DESC;
```

### 视图说明

- **视图名称**: `latest_luftqualitaet`
- **功能**: 获取每个站点的最新时间戳对应的空气质量数据
- **使用的技术**: `DISTINCT ON (station_id)` 结合 `ORDER BY station_id, timestamp DESC` 来获取每个站点的最新记录

### 使用方法

创建视图后，前端代码将通过以下方式访问：

1. **获取所有站点最新数据**:
   ```
   /.netlify/functions/supabaseProxy?type=latest_luftqualitaet
   ```

2. **获取特定站点最新数据**:
   ```
   /.netlify/functions/supabaseProxy?type=latest_luftqualitaet&stationId=STATION_ID
   ```

### 性能优势

- 减少了多次API调用，从N次调用减少到1次调用
- 数据库层面优化，查询速度更快
- 减少网络传输量
- 简化前端逻辑

### 权限设置

确保视图具有适当的RLS (Row Level Security) 权限，如果原表有RLS策略，视图也需要相应的权限设置。

```sql
-- 如果需要，为视图设置权限
GRANT SELECT ON latest_luftqualitaet TO anon;
GRANT SELECT ON latest_luftqualitaet TO authenticated;
```