# 基金/股票实时估值系统

基于 Python + FastAPI 的轻量实时估值系统，支持：

- 基金实时估值（东方财富接口）
- 股票实时行情（腾讯行情接口）
- 网页端展示组合实时盈亏
- 页面手动新增、修改、删除持仓
- 页面按基金代码 + 持仓金额快速导入

## 1. 快速启动

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

浏览器访问：`http://127.0.0.1:8000`

## 2. 页面操作

### 2.1 新增/修改/删除持仓

- 新增：在“新增 / 修改持仓”表单输入资产类型、代码、持仓份额/股数、成本价后提交
- 修改：在表格中点击“修改”，编辑后保存
- 删除：在表格中点击“删除”

> 提示：编辑模式下，资产类型和代码不可改；如需改代码，请删除后重新新增。

### 2.2 按金额导入基金

- 输入基金代码与持仓金额
- 系统按实时净值自动换算份额：`份额 = 金额 / 净值`
- 已存在基金时会自动按加权成本合并

## 3. 配置文件

默认配置文件：`data/portfolio.json`

- `base_currency`: 币种（如 `CNY`）
- `refresh_seconds`: 前端刷新间隔（5-300 秒）
- `positions`: 持仓列表（可为空）
  - `asset_type`: `fund` 或 `stock`
  - `code`: 资产代码
  - `name`: 名称（可选）
  - `units`: 份额/股数
  - `cost_price`: 成本价

也可以通过环境变量指定配置路径：

```bash
set PORTFOLIO_FILE=E:\code\fund\data\portfolio.json
python -m uvicorn app.main:app --reload
```

## 4. API 接口

- `GET /`：看板页面
- `GET /api/portfolio`：组合估值快照
- `POST /api/portfolio/import-funds`：按金额导入基金
- `POST /api/positions`：新增持仓
- `PATCH /api/positions/{asset_type}/{code}`：修改持仓
- `DELETE /api/positions/{asset_type}/{code}`：删除持仓
- `GET /health`：健康检查

## 5. 免费数据源说明

- 基金估值：`https://fundgz.1234567.com.cn`
- 股票行情：`https://qt.gtimg.cn`

免费接口存在限频、偶发波动和结构变更风险，生产环境建议增加降级和备用数据源。
