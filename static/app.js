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
  positionForm: document.getElementById("position-form"),
  positionAssetType: document.getElementById("position-asset-type"),
  positionCode: document.getElementById("position-code"),
  positionName: document.getElementById("position-name"),
  positionUnits: document.getElementById("position-units"),
  positionCostPrice: document.getElementById("position-cost-price"),
  positionSubmit: document.getElementById("position-submit"),
  positionCancel: document.getElementById("position-cancel"),
  positionMessage: document.getElementById("position-message"),
};

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const priceFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const editState = {
  isEditing: false,
  assetType: "",
  code: "",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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
  elements.importMessage.classList.toggle("error-text", isError);
};

const setPositionMessage = (message, isError = false) => {
  elements.positionMessage.textContent = message || "";
  elements.positionMessage.classList.toggle("error-text", isError);
};

const resetPositionForm = () => {
  editState.isEditing = false;
  editState.assetType = "";
  editState.code = "";
  elements.positionForm.reset();
  elements.positionAssetType.disabled = false;
  elements.positionCode.disabled = false;
  elements.positionSubmit.textContent = "新增持仓";
  elements.positionCancel.classList.add("hidden");
};

const enterEditMode = (position) => {
  editState.isEditing = true;
  editState.assetType = position.asset_type;
  editState.code = position.code;
  elements.positionAssetType.value = position.asset_type;
  elements.positionCode.value = position.code;
  elements.positionName.value = position.name || "";
  elements.positionUnits.value = position.units;
  elements.positionCostPrice.value = position.cost_price;
  elements.positionAssetType.disabled = true;
  elements.positionCode.disabled = true;
  elements.positionSubmit.textContent = "保存修改";
  elements.positionCancel.classList.remove("hidden");
  setPositionMessage(`正在编辑 ${position.asset_type}:${position.code}`);
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
  const quotedName = escapeHtml(position.name);
  const quotedCode = escapeHtml(position.code);

  row.innerHTML = `
    <td>${quotedName}</td>
    <td>${quotedCode}</td>
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
    <td>
      <button class="table-btn" data-action="edit" data-asset-type="${position.asset_type}" data-code="${quotedCode}">修改</button>
      <button class="table-btn danger" data-action="delete" data-asset-type="${position.asset_type}" data-code="${quotedCode}">删除</button>
    </td>
  `;

  return row;
};

const renderPositions = (positions, currency) => {
  elements.positionsBody.innerHTML = "";
  positions.forEach((position) => {
    elements.positionsBody.appendChild(renderRow(position, currency));
  });
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
    return snapshot;
  } catch (error) {
    setError(`拉取数据失败：${error.message}`);
    return null;
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
    const response = await fetch("/api/portfolio/import-funds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            code,
            amount,
            ...(name ? { name } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`导入失败: ${response.status}`);
    }

    const result = await response.json();
    const item = result.items?.[0];
    if (!item || item.status === "failed") {
      throw new Error(item?.error || "基金数据不可用");
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

const submitPosition = async (event) => {
  event.preventDefault();
  setPositionMessage("");

  const assetType = elements.positionAssetType.value;
  const code = elements.positionCode.value.trim();
  const name = elements.positionName.value.trim();
  const units = Number(elements.positionUnits.value);
  const costPrice = Number(elements.positionCostPrice.value);

  if (!code) {
    setPositionMessage("请输入资产代码。", true);
    return;
  }
  if (!Number.isFinite(units) || units <= 0) {
    setPositionMessage("请输入有效的持仓份额/股数。", true);
    return;
  }
  if (!Number.isFinite(costPrice) || costPrice <= 0) {
    setPositionMessage("请输入有效的成本价。", true);
    return;
  }

  elements.positionSubmit.disabled = true;

  try {
    let response;
    if (editState.isEditing) {
      response = await fetch(
        `/api/positions/${encodeURIComponent(editState.assetType)}/${encodeURIComponent(editState.code)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name || null,
            units,
            cost_price: costPrice,
          }),
        }
      );
    } else {
      response = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_type: assetType,
          code,
          name: name || null,
          units,
          cost_price: costPrice,
        }),
      });
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `请求失败: ${response.status}`);
    }

    const result = await response.json();
    setPositionMessage(result.message || "操作成功");
    resetPositionForm();
    await refresh();
  } catch (error) {
    setPositionMessage(`操作失败：${error.message}`, true);
  } finally {
    elements.positionSubmit.disabled = false;
  }
};

const handleTableAction = async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const assetType = button.dataset.assetType;
  const code = button.dataset.code;
  if (!assetType || !code) {
    return;
  }

  if (action === "edit") {
    const snapshot = await fetchSnapshot();
    const target = snapshot?.positions?.find(
      (item) => item.asset_type === assetType && item.code === code
    );
    if (!target) {
      setPositionMessage("未找到可编辑的持仓记录。", true);
      return;
    }
    enterEditMode(target);
    return;
  }

  if (action === "delete") {
    if (!window.confirm(`确认删除 ${assetType}:${code} 吗？`)) {
      return;
    }
    try {
      const response = await fetch(
        `/api/positions/${encodeURIComponent(assetType)}/${encodeURIComponent(code)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `删除失败: ${response.status}`);
      }
      setPositionMessage(`删除成功：${assetType}:${code}`);
      if (editState.isEditing && editState.assetType === assetType && editState.code === code) {
        resetPositionForm();
      }
      await refresh();
    } catch (error) {
      setPositionMessage(`删除失败：${error.message}`, true);
    }
  }
};

elements.importForm.addEventListener("submit", importFund);
elements.positionForm.addEventListener("submit", submitPosition);
elements.positionCancel.addEventListener("click", () => {
  resetPositionForm();
  setPositionMessage("");
});
elements.positionsBody.addEventListener("click", handleTableAction);

refresh();
setInterval(refresh, Math.max(Number(config.refreshSeconds) || 15, 5) * 1000);
