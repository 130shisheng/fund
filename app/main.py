import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.providers import QuoteProvider
from app.schemas import (
    AssetType,
    FundImportRequest,
    FundImportResponse,
    PositionDeleteResponse,
    PositionMutationResponse,
    PositionUpdateRequest,
    PositionUpsertRequest,
    PortfolioSnapshot,
)
from app.service import PortfolioService

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
DEFAULT_CONFIG = BASE_DIR / "data" / "portfolio.json"
CONFIG_PATH = Path(os.getenv("PORTFOLIO_FILE", str(DEFAULT_CONFIG)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    provider = QuoteProvider()
    app.state.portfolio_service = PortfolioService(CONFIG_PATH, provider)
    yield
    await provider.close()


app = FastAPI(
    title="Fund & Stock Realtime Estimator",
    description="基金/股票持仓实时估值与盈亏看板",
    version="1.1.0",
    lifespan=lifespan,
)

templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    config = request.app.state.portfolio_service.load_config()
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "refresh_seconds": config.refresh_seconds,
            "base_currency": config.base_currency,
        },
    )


@app.get("/api/portfolio", response_model=PortfolioSnapshot)
async def portfolio(request: Request):
    return await request.app.state.portfolio_service.get_snapshot()


@app.post("/api/portfolio/import-funds", response_model=FundImportResponse)
async def import_funds(payload: FundImportRequest, request: Request):
    return await request.app.state.portfolio_service.import_fund_items(payload.items)


@app.post("/api/positions", response_model=PositionMutationResponse)
async def add_position(payload: PositionUpsertRequest, request: Request):
    try:
        return await request.app.state.portfolio_service.add_position(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.patch("/api/positions/{asset_type}/{code}", response_model=PositionMutationResponse)
async def update_position(
    asset_type: AssetType, code: str, payload: PositionUpdateRequest, request: Request
):
    try:
        return await request.app.state.portfolio_service.update_position(asset_type, code, payload)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.delete("/api/positions/{asset_type}/{code}", response_model=PositionDeleteResponse)
async def delete_position(asset_type: AssetType, code: str, request: Request):
    try:
        return await request.app.state.portfolio_service.delete_position(asset_type, code)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/health")
async def health():
    return {"status": "ok"}
