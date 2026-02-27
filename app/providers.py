import json
import re
import time
from dataclasses import dataclass

import httpx


class DataProviderError(RuntimeError):
    pass


@dataclass
class RawQuote:
    code: str
    name: str
    price: float
    change_percent: float | None
    quote_time: str | None
    source: str


class QuoteProvider:
    def __init__(self, cache_ttl_seconds: int = 8, timeout_seconds: float = 8.0) -> None:
        self._cache_ttl = cache_ttl_seconds
        self._cache: dict[str, tuple[float, RawQuote]] = {}
        self._client = httpx.AsyncClient(
            timeout=timeout_seconds,
            headers={
                "User-Agent": "Mozilla/5.0 (FundStockEstimator/1.0)",
            },
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get_quote(self, asset_type: str, code: str) -> RawQuote:
        normalized_code = code.strip()
        cache_key = f"{asset_type}:{normalized_code}"
        cached = self._cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < self._cache_ttl:
            return cached[1]

        if asset_type == "fund":
            quote = await self._fetch_fund_quote(normalized_code)
        elif asset_type == "stock":
            quote = await self._fetch_stock_quote(normalized_code)
        else:
            raise DataProviderError(f"不支持的资产类型: {asset_type}")

        self._cache[cache_key] = (time.monotonic(), quote)
        return quote

    async def _fetch_fund_quote(self, code: str) -> RawQuote:
        url = f"https://fundgz.1234567.com.cn/js/{code}.js"
        response = await self._client.get(url)
        if response.status_code != 200:
            raise DataProviderError(f"基金接口请求失败: {response.status_code}")

        match = re.search(r"jsonpgz\((.*?)\);?$", response.text.strip())
        if not match:
            raise DataProviderError("基金接口返回格式异常")

        payload = json.loads(match.group(1))
        price = self._as_float(payload.get("gsz"))
        if price is None:
            raise DataProviderError("基金估值为空")

        change_percent = self._as_float(payload.get("gszzl"))
        name = payload.get("name") or code
        quote_time = payload.get("gztime")
        return RawQuote(
            code=code,
            name=name,
            price=price,
            change_percent=change_percent,
            quote_time=quote_time,
            source="eastmoney",
        )

    async def _fetch_stock_quote(self, code: str) -> RawQuote:
        normalized_code = self._normalize_stock_code(code)
        url = f"https://qt.gtimg.cn/q={normalized_code}"
        response = await self._client.get(url)
        if response.status_code != 200:
            raise DataProviderError(f"股票接口请求失败: {response.status_code}")

        text = response.content.decode("gbk", errors="ignore").strip()
        match = re.search(r'="(.*)";?$', text)
        if not match:
            raise DataProviderError("股票接口返回格式异常")

        parts = match.group(1).split("~")
        if len(parts) < 5:
            raise DataProviderError("股票接口返回字段不足")

        name = parts[1] or normalized_code
        current_price = self._as_float(parts[3])
        prev_close = self._as_float(parts[4])
        if current_price is None:
            raise DataProviderError("股票价格为空")

        change_percent = None
        if prev_close and prev_close > 0:
            change_percent = (current_price - prev_close) / prev_close * 100

        quote_time = parts[30] if len(parts) > 30 and parts[30] else None
        return RawQuote(
            code=normalized_code,
            name=name,
            price=current_price,
            change_percent=change_percent,
            quote_time=quote_time,
            source="tencent",
        )

    def _normalize_stock_code(self, code: str) -> str:
        candidate = code.lower().strip()
        if candidate.startswith(("sh", "sz", "hk", "us")):
            return candidate
        if candidate.isdigit():
            if candidate.startswith(("5", "6", "9")):
                return f"sh{candidate}"
            return f"sz{candidate}"
        return candidate

    def _as_float(self, value: str | float | int | None) -> float | None:
        if value is None or value == "":
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
