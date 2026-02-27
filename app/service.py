import asyncio
import json
from datetime import datetime
from pathlib import Path

from app.providers import QuoteProvider
from app.schemas import (
    FundImportItem,
    FundImportResponse,
    FundImportResult,
    PortfolioConfig,
    PortfolioMeta,
    PortfolioSnapshot,
    PortfolioTotals,
    PositionConfig,
    PositionQuote,
)


class PortfolioService:
    def __init__(self, config_path: Path, provider: QuoteProvider) -> None:
        self._config_path = config_path
        self._provider = provider
        self._config_lock = asyncio.Lock()

    def load_config(self) -> PortfolioConfig:
        with self._config_path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        return PortfolioConfig.model_validate(payload)

    def save_config(self, config: PortfolioConfig) -> None:
        with self._config_path.open("w", encoding="utf-8") as file:
            json.dump(config.model_dump(mode="json"), file, ensure_ascii=False, indent=2)

    async def get_snapshot(self) -> PortfolioSnapshot:
        config = self.load_config()
        tasks = [self._evaluate_position(position) for position in config.positions]
        positions = await asyncio.gather(*tasks)
        totals = self._compute_totals(positions)
        meta = PortfolioMeta(
            base_currency=config.base_currency,
            refresh_seconds=config.refresh_seconds,
            updated_at=datetime.now().isoformat(timespec="seconds"),
        )
        return PortfolioSnapshot(meta=meta, totals=totals, positions=positions)

    async def _evaluate_position(self, position: PositionConfig) -> PositionQuote:
        display_name = position.name or position.code
        cost_value = round(position.units * position.cost_price, 2)

        try:
            raw_quote = await self._provider.get_quote(position.asset_type, position.code)
            market_value = round(position.units * raw_quote.price, 2)
            pnl_amount = round(market_value - cost_value, 2)
            pnl_percent = round((pnl_amount / cost_value * 100), 2) if cost_value > 0 else 0.0
            return PositionQuote(
                asset_type=position.asset_type,
                code=raw_quote.code,
                name=position.name or raw_quote.name or display_name,
                units=position.units,
                cost_price=position.cost_price,
                current_price=round(raw_quote.price, 4),
                change_percent=round(raw_quote.change_percent, 2)
                if raw_quote.change_percent is not None
                else None,
                market_value=market_value,
                cost_value=cost_value,
                pnl_amount=pnl_amount,
                pnl_percent=pnl_percent,
                source=raw_quote.source,
                quote_time=raw_quote.quote_time,
                status="ok",
            )
        except Exception as error:
            return PositionQuote(
                asset_type=position.asset_type,
                code=position.code,
                name=display_name,
                units=position.units,
                cost_price=position.cost_price,
                cost_value=cost_value,
                status="error",
                error=str(error),
            )

    def _compute_totals(self, positions: list[PositionQuote]) -> PortfolioTotals:
        total_cost = round(sum(item.cost_value for item in positions), 2)
        total_market_value = round(
            sum((item.market_value or 0) for item in positions if item.status == "ok"), 2
        )
        total_pnl_amount = round(total_market_value - total_cost, 2)
        total_pnl_percent = round((total_pnl_amount / total_cost * 100), 2) if total_cost > 0 else 0.0
        successful_positions = sum(1 for item in positions if item.status == "ok")
        failed_positions = len(positions) - successful_positions
        return PortfolioTotals(
            total_cost=total_cost,
            total_market_value=total_market_value,
            total_pnl_amount=total_pnl_amount,
            total_pnl_percent=total_pnl_percent,
            successful_positions=successful_positions,
            failed_positions=failed_positions,
        )

    async def import_fund_items(self, items: list[FundImportItem]) -> FundImportResponse:
        async with self._config_lock:
            config = self.load_config()
            results: list[FundImportResult] = []
            has_changes = False
            added = 0
            updated = 0
            failed = 0

            for item in items:
                code = item.code.strip()
                try:
                    quote = await self._provider.get_quote("fund", code)
                    if quote.price <= 0:
                        raise ValueError("基金净值无效")

                    import_amount = round(item.amount, 2)
                    imported_units = round(import_amount / quote.price, 4)
                    if imported_units <= 0:
                        raise ValueError("持仓金额过小，无法转换为有效份额")

                    existing_position = next(
                        (
                            position
                            for position in config.positions
                            if position.asset_type == "fund" and position.code.strip() == code
                        ),
                        None,
                    )
                    display_name = item.name or quote.name or code

                    if existing_position:
                        previous_cost = existing_position.units * existing_position.cost_price
                        total_cost = previous_cost + import_amount
                        total_units = round(existing_position.units + imported_units, 4)
                        existing_position.units = total_units
                        existing_position.cost_price = round(total_cost / total_units, 6)
                        if item.name:
                            existing_position.name = item.name
                        results.append(
                            FundImportResult(
                                code=code,
                                name=display_name,
                                amount=import_amount,
                                units=imported_units,
                                cost_price=round(quote.price, 6),
                                status="updated",
                            )
                        )
                        updated += 1
                    else:
                        config.positions.append(
                            PositionConfig(
                                asset_type="fund",
                                code=code,
                                name=display_name,
                                units=imported_units,
                                cost_price=round(quote.price, 6),
                            )
                        )
                        results.append(
                            FundImportResult(
                                code=code,
                                name=display_name,
                                amount=import_amount,
                                units=imported_units,
                                cost_price=round(quote.price, 6),
                                status="added",
                            )
                        )
                        added += 1

                    has_changes = True
                except Exception as error:
                    failed += 1
                    results.append(
                        FundImportResult(
                            code=code,
                            amount=round(item.amount, 2),
                            status="failed",
                            error=str(error),
                        )
                    )

            if has_changes:
                self.save_config(config)

            return FundImportResponse(
                added=added,
                updated=updated,
                failed=failed,
                items=results,
            )
