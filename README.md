# 基金/股票实时估值系统

基于 Python + FastAPI 的轻量实时估值系统，支持：

- 基金实时估值（东方财富接口）
- 股票实时行情（腾讯行情接口）
- 网页端展示持仓组合的实时盈亏
- 在页面手动输入基金代码和持仓金额并导入持仓

## 1. 快速启动

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

浏览器访问：`http://127.0.0.1:8000`

## 2. 页面导入基金持仓

页面新增“导入基金持仓”表单：

- 输入 `基金代码`（如 `161725`）
- 输入 `持仓金额`（单位为配置币种）
- 可选输入 `名称`
- 点击“导入”

导入规则：

- 系统会先读取基金实时估值
- 持仓金额会按 `份额 = 持仓金额 / 当前净值` 自动换算
- 若该基金已存在，会按加权成本自动合并持仓
- 若不存在，会新增一条基金持仓

## 3. 持仓配置文件

默认配置文件：`data/portfolio.json`

字段说明：

- `base_currency`: 组合币种（如 `CNY`）
- `refresh_seconds`: 前端刷新秒数（5-300）
- `positions`: 持仓列表
  - `asset_type`: `fund` 或 `stock`
  - `code`: 资产代码（基金示例 `161725`，股票示例 `sh600519`）
  - `name`: 自定义名称（可选）
  - `units`: 持仓份额/股数
  - `cost_price`: 成本价

可通过环境变量指定配置路径：

```bash
set PORTFOLIO_FILE=E:\code\fund\data\portfolio.json
python -m uvicorn app.main:app --reload
```

## 4. API 接口

- `GET /`：实时看板页面
- `GET /api/portfolio`：组合估值 JSON
- `POST /api/portfolio/import-funds`：导入基金持仓
- `GET /health`：健康检查

导入接口示例：

```json
{
  "items": [
    {
      "code": "161725",
      "amount": 10000,
      "name": "招商中证白酒指数A"
    }
  ]
}
```

## 5. 免费数据源说明

- 基金估值：`https://fundgz.1234567.com.cn`
- 股票行情：`https://qt.gtimg.cn`

免费接口存在限频、偶发波动和结构变更风险，生产环境建议增加降级与备用源。
