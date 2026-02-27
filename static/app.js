const config = window.APP_CONFIG || { refreshSeconds: 15, baseCurrency: "CNY" };

const elements = {
  totalCost: document.getElementById("total-cost"),
  totalMarket: document.getElementById("total-market"),
  totalPnl: document.getElementById("total-pnl"),
  quoteStatus: document.getElementById("quote-status"),
  updatedAt: document.getElementById("updated-at"),
  positionsBody: document.getElementById("positions-body"),
  errorMessage: document.getElementById("error-message"),
  refreshSeconds: document.getElementById("refresh-seconds"),
  baseCurrency: document.getElementById("base-currency"),
  importForm: document.getElementById("fund-import-form"),
  fundCode: document.getElementById("fund-code"),
  fundAmount: document.getElementById("fund-amount"),
  fundName: document.getElementById("fund-name"),
  importButton: document.getElementById("import-button"),
  importMessage: document.getElementById("import-message"),
};

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const priceFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const formatMoney = (value, currency = "CNY") => {
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  return `${sign}${currency} ${numberFormatter.format(absValue)}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value >= 0 ? "+" : ""}${numberFormatter.format(value)}%`;
};

const trendClass = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "";
};

const renderTotals = (totals, currency) => {
  elements.totalCost.textContent = formatMoney(totals.total_cost, currency);
  elements.totalMarket.textContent = formatMoney(totals.total_market_value, currency);
  elements.totalPnl.textContent = `${formatMoney(totals.total_pnl_amount, currency)} (${formatPercent(
    totals.total_pnl_percent
  )})`;
  elements.totalPnl.className = trendClass(totals.total_pnl_amount);
  elements.quoteStatus.textContent = `${totals.successful_positions} / ${totals.failed_positions}`;
};

const renderRow = (position, currency) => {
  const row = document.createElement("tr");
  const pnlClass = trendClass(position.pnl_amount);
  const changeClass = trendClass(position.change_percent);
  const statusText = position.status === "ok" ? "正常" : "异常";
  const statusClass = position.status === "ok" ? "" : "error-tag";

  row.innerHTML = `
    <td>${position.name}</td>
    <td>${position.code}</td>
    <td>${numberFormatter.format(position.units)}</td>
    <td>${priceFormatter.format(position.cost_price)}</td>
    <td>${position.current_price !== null ? priceFormatter.format(position.current_price) : "--"}</td>
    <td class="${changeClass}">${formatPercent(position.change_percent)}</td>
    <td>${formatMoney(position.cost_value, currency)}</td>
    <td>${position.market_value !== null ? formatMoney(position.market_value, currency) : "--"}</td>
    <td class="${pnlClass}">${
      position.pnl_amount !== null
        ? `${formatMoney(position.pnl_amount, currency)} (${formatPercent(position.pnl_percent)})`
        : "--"
    }</td>
    <td class="${statusClass}">${statusText}</td>
  `;
  return row;
};

const renderPositions = (positions, currency) => {
  elements.positionsBody.innerHTML = "";
  positions.forEach((position) => {
    elements.positionsBody.appendChild(renderRow(position, currency));
  });
};

const setError = (message) => {
  if (!message) {
    elements.errorMessage.textContent = "";
    elements.errorMessage.classList.add("hidden");
    return;
  }
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
};

const setImportMessage = (message, isError = false) => {
  elements.importMessage.textContent = message || "";
  if (!message) {
    elements.importMessage.classList.remove("error-text");
    return;
  }
  elements.importMessage.classList.toggle("error-text", isError);
};

const fetchSnapshot = async () => {
  const response = await fetch("/api/portfolio", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`接口请求失败: ${response.status}`);
  }
  return response.json();
};

const refresh = async () => {
  try {
    const snapshot = await fetchSnapshot();
    const currency = snapshot.meta.base_currency || config.baseCurrency;
    elements.updatedAt.textContent = snapshot.meta.updated_at || "--";
    elements.refreshSeconds.textContent = snapshot.meta.refresh_seconds;
    elements.baseCurrency.textContent = currency;
    renderTotals(snapshot.totals, currency);
    renderPositions(snapshot.positions, currency);
    setError("");
  } catch (error) {
    setError(`拉取数据失败：${error.message}`);
  }
};

const importFund = async (event) => {
  event.preventDefault();
  setImportMessage("");
  const code = elements.fundCode.value.trim();
  const amount = Number(elements.fundAmount.value);
  const name = elements.fundName.value.trim();

  if (!code) {
    setImportMessage("请输入基金代码。", true);
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    setImportMessage("请输入有效的持仓金额。", true);
    return;
  }

  elements.importButton.disabled = true;
  elements.importButton.textContent = "导入中...";

  try {
    const payload = {
      items: [
        {
          code,
          amount,
          ...(name ? { name } : {}),
        },
      ],
    };
    const response = await fetch("/api/portfolio/import-funds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`导入失败: ${response.status}`);
    }

    const result = await response.json();
    const item = result.items?.[0];
    if (!item || item.status === "failed") {
      throw new Error(item?.error || "数据源返回异常");
    }

    const actionText = item.status === "added" ? "新增" : "合并";
    setImportMessage(
      `${actionText}成功：${item.code}，导入金额 ${numberFormatter.format(item.amount)}，换算份额 ${numberFormatter.format(
        item.units
      )}`
    );

    elements.importForm.reset();
    await refresh();
  } catch (error) {
    setImportMessage(`导入失败：${error.message}`, true);
  } finally {
    elements.importButton.disabled = false;
    elements.importButton.textContent = "导入";
  }
};

elements.importForm.addEventListener("submit", importFund);
refresh();
setInterval(refresh, Math.max(Number(config.refreshSeconds) || 15, 5) * 1000);
