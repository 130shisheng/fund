from typing import Literal

from pydantic import BaseModel, Field, model_validator


AssetType = Literal["fund", "stock"]


class PositionConfig(BaseModel):
    asset_type: AssetType
    code: str = Field(min_length=2, max_length=20)
    name: str | None = Field(default=None, max_length=50)
    units: float = Field(gt=0)
    cost_price: float = Field(gt=0)


class PortfolioConfig(BaseModel):
    base_currency: str = Field(default="CNY", min_length=3, max_length=6)
    refresh_seconds: int = Field(default=15, ge=5, le=300)
    positions: list[PositionConfig] = Field(default_factory=list)


class PositionQuote(BaseModel):
    asset_type: AssetType
    code: str
    name: str
    units: float
    cost_price: float
    current_price: float | None = None
    change_percent: float | None = None
    market_value: float | None = None
    cost_value: float
    pnl_amount: float | None = None
    pnl_percent: float | None = None
    source: str | None = None
    quote_time: str | None = None
    status: Literal["ok", "error"]
    error: str | None = None


class PortfolioTotals(BaseModel):
    total_cost: float
    total_market_value: float
    total_pnl_amount: float
    total_pnl_percent: float
    successful_positions: int
    failed_positions: int


class PortfolioMeta(BaseModel):
    base_currency: str
    refresh_seconds: int
    updated_at: str


class PortfolioSnapshot(BaseModel):
    meta: PortfolioMeta
    totals: PortfolioTotals
    positions: list[PositionQuote]


class FundImportItem(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    amount: float = Field(gt=0)
    name: str | None = Field(default=None, max_length=50)


class FundImportRequest(BaseModel):
    items: list[FundImportItem] = Field(min_length=1, max_length=100)


class FundImportResult(BaseModel):
    code: str
    name: str | None = None
    amount: float
    units: float | None = None
    cost_price: float | None = None
    status: Literal["added", "updated", "failed"]
    error: str | None = None


class FundImportResponse(BaseModel):
    added: int
    updated: int
    failed: int
    items: list[FundImportResult]


class PositionUpsertRequest(BaseModel):
    asset_type: AssetType
    code: str = Field(min_length=2, max_length=20)
    name: str | None = Field(default=None, max_length=50)
    units: float = Field(gt=0)
    cost_price: float = Field(gt=0)


class PositionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    units: float | None = Field(default=None, gt=0)
    cost_price: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_has_fields(self):
        if self.name is None and self.units is None and self.cost_price is None:
            raise ValueError("至少提供一个待修改字段")
        return self


class PositionMutationResponse(BaseModel):
    message: str
    position: PositionConfig


class PositionDeleteResponse(BaseModel):
    message: str
    asset_type: AssetType
    code: str
