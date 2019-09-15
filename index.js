"use strict";
function escapeCsvField(value) {
    const s = String(value);
    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
async function getData() {
    try {
        const res = await fetch(new URL("dummy-data.json", document.baseURI));
        if (res.ok) {
            const json = await res.json();
            if (json && Array.isArray(json.dataObject)) {
                return json;
            }
        }
    } catch {}
    const fb = window.PROCESSING_LOGS_FALLBACK;
    if (fb && Array.isArray(fb.dataObject)) {
        return fb;
    }
    return null;
}

const start = async function () {
    const errEl = document.getElementById("app-error");
    const btnCsv = document.getElementById("download-csv");
    const btnJson = document.getElementById("download-json");
    const showError = (msg) => {
        errEl.textContent = msg;
        errEl.hidden = false;
    };
    const clearError = () => {
        errEl.textContent = "";
        errEl.hidden = true;
    };

    btnCsv.disabled = true;
    btnJson.disabled = true;

    let resp = await getData();
    if (!resp || !Array.isArray(resp.dataObject)) {
        showError("Unable to load processing logs.");
        return;
    }
    clearError();

    let data = [];
    for (const val of resp.dataObject) {
        let status = val.status == 1 ? "Processed" : "Pending";
        let synced = val.synced == 1 ? "Synced" : "Queued";
        data.push({
            "Run ID": val.runId,
            "Date Time": val.datetime,
            "Processing Status": status,
            "Sync Status": synced
        });
    }

    window.processingLogsTable = new RdataTB("myTable", {
        fixedTable: true,
        ShowSelect: true,
        ShowPaginate: true,
        RenderJSON: data
    });

    btnCsv.disabled = false;
    btnJson.disabled = false;
    btnCsv.onclick = () => window.processingLogsTable.DownloadCSV("processing-logs");
    btnJson.onclick = () => window.processingLogsTable.DownloadJSON("processing-logs");
};
class RdataTB {
    constructor(IdTable, Options = {
        RenderJSON: null,
        ShowSearch: true,
        ShowSelect: true,
        ShowPaginate: true,
        SelectionNumber: [5, 10, 20, 50],
        HideColumn: [],
        ShowHighlight: false,
        fixedTable: false,
        sortAnimate: true
    }) {
        this.HeaderDataTable = [];
        this.RowDataTable = [];
        this.DataTable = [];
        this.DataToRender = [];
        this.PageSize = 10;
        this.Assc = false;
        this.DataSearch = [];
        this.i = 0;
        this.searchValue = "";
        this.ListHiding = [];
        this.SelectionNumber = [5, 10, 20, 50];
        this.SelectElementString = "";
        this.ShowHighlight = false;
        this.listTypeDate = [];
        this.TableElement = document.getElementById(IdTable);
        this.detectTyped();
        this.ConvertToJson();
        if (Options.ShowPaginate !== false) {
            this.paginateRender();
        }
        this.Control();
        this.search();
        this.RenderToHTML();
        this.PaginateUpdate();
        this.Options = Options;
        if (Options.RenderJSON != null) {
            this.JSONinit(Options.RenderJSON);
        }
        if (Options.ShowSelect === false) {
            document.getElementById("my-select")?.remove();
        }
        if (Options.ShowHighlight != false) {
            if (Options.ShowHighlight != null || Options.ShowHighlight === true) {
                this.ShowHighlight = true;
            }
        }
        if (Options.fixedTable != false) {
            if (Options.fixedTable != null || Options.fixedTable === true) {
                this.TableElement?.classList.add("table_layout_fixed");
            } else {
                this.TableElement?.classList.remove("table_layout_fixed");
            }
        } else {
            this.TableElement?.classList.add("table_layout_fixed");
        }
        if (Options.ShowSearch === false) {
            document.getElementById("SearchControl")?.remove();
        }
        if (Options.HideColumn != null) {
            this.ListHiding = Options.HideColumn;
            this.DoHide();
        }
        if (Options.SelectionNumber != null) {
            this.SelectionNumber = Options.SelectionNumber;
            this.ChangeSelect();
        }
    }
    detectTyped() {
        const getHead = this.TableElement?.getElementsByTagName("th");
        if (!getHead) {
            return;
        }
        for (let z = 0; z < getHead.length; z++) {
            if (getHead[z].attributes['type-date']) {
                this.listTypeDate.push({
                    HeaderIndex: z,
                    dateVal: true
                });
            }
        }
    }
    ChangeSelect() {
        const sel = document.getElementById("my-select");
        if (!sel) {
            return "";
        }
        this.SelectElementString = "";
        for (let x = 0; x < this.SelectionNumber.length; x++) {
            this.SelectElementString += `<option value="${this.SelectionNumber[x]}">${this.SelectionNumber[x]}</option>`;
        }
        sel.innerHTML = this.SelectElementString;
        return this.SelectElementString;
    }
    Control() {
        const span1 = document.createElement("span");
        span1.innerHTML = `
        <div class="table-controls">
            <div class="table-controls-row">
                <label class="control-label" for="my-select">Rows per page</label>
                <select id="my-select" class="form-select form-select--compact" aria-describedby="my-select-hint">
                    <option value="5">5</option><option value="10" selected>10</option><option value="20">20</option><option value="50">50</option>
                </select>
                <span id="my-select-hint" class="visually-hidden">Changes how many rows appear on each page</span>
                <label class="control-label" for="SearchControl">Search</label>
                <input id="SearchControl" class="form-control form-control--grow" placeholder="Search columns…" type="search" autocomplete="off" />
            </div>
        </div>`;
        span1.className = "Selc";
        this.TableElement.parentNode.insertBefore(span1, this.TableElement);
        this.TableElement.style.width = "100%";
        const ChangeV = (params) => {
            this.PageSize = params;
            this.i = 0;
            this.RenderToHTML();
            this.highlight(this.searchValue);
            this.DoHide();
        };
        document.getElementById("my-select").addEventListener("change", function () {
            ChangeV(this.value);
        });
        const nextBtn = document.getElementById("x__NEXT__X");
        const prevBtn = document.getElementById("x__PREV__X");
        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                this.nextItem();
                this.highlight(this.searchValue);
                this.DoHide();
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                this.prevItem();
                this.highlight(this.searchValue);
                this.DoHide();
            });
        }
        const pg = document.getElementById("pgN");
        if (pg && !pg.dataset.rdatabound) {
            pg.dataset.rdatabound = "1";
            pg.addEventListener("click", (e) => {
                const btn = e.target.closest("button.page-num");
                if (!btn || btn.disabled || btn.classList.contains("is-active")) {
                    return;
                }
                const idx = parseInt(btn.getAttribute("data-page-index"), 10);
                if (!Number.isFinite(idx)) {
                    return;
                }
                this.i = idx;
                this.RenderToHTML();
                this.highlight(this.searchValue);
                this.DoHide();
            });
        }
    }
    nextItem() {
        const chunks = this.Divide();
        if (chunks.length === 0) {
            return;
        }
        this.i = (this.i + 1) % chunks.length;
        this.RenderToHTML();
    }
    prevItem() {
        const chunks = this.Divide();
        if (chunks.length === 0) {
            return;
        }
        if (this.i === 0) {
            this.i = chunks.length - 1;
        } else {
            this.i = this.i - 1;
        }
        this.RenderToHTML();
    }
    paginateRender() {
        const k = `
        <div class="pagination-wrap" id="pgN" role="navigation" aria-label="Table pagination">
            <div class="pagination-inner">
                <button type="button" class="page-nav" id="x__PREV__X" aria-label="Previous page">&lsaquo; Prev</button>
                <div class="pagination-pages" id="PF"></div>
                <button type="button" class="page-nav" id="x__NEXT__X" aria-label="Next page">Next &rsaquo;</button>
            </div>
            <p class="pagination-summary" id="pagination-summary" aria-live="polite"></p>
        </div>`;
        const span = document.createElement("span");
        span.innerHTML = k;
        span.className = "asterisk";
        this.TableElement.parentNode.insertBefore(span, this.TableElement.nextSibling);
    }
    buildPaginationItems() {
        const total = this.Divide().length;
        const cur = this.i;
        if (total <= 0) {
            return [];
        }
        if (total <= 11) {
            return Array.from({ length: total }, (_, i) => i);
        }
        const add = (set, x) => {
            if (x >= 0 && x < total) {
                set.add(x);
            }
        };
        const s = new Set();
        add(s, 0);
        add(s, total - 1);
        add(s, cur);
        add(s, cur - 1);
        add(s, cur + 1);
        add(s, cur - 2);
        add(s, cur + 2);
        const sorted = [...s].sort((a, b) => a - b);
        const out = [];
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
                out.push("ellipsis");
            }
            out.push(sorted[i]);
        }
        return out;
    }
    PaginateUpdate() {
        const pf = document.getElementById("PF");
        const summary = document.getElementById("pagination-summary");
        const prev = document.getElementById("x__PREV__X");
        const next = document.getElementById("x__NEXT__X");
        if (!pf) {
            return;
        }
        const chunks = this.Divide();
        const totalPages = chunks.length;
        const totalRows = this.DataTable === undefined ? 0 : this.DataTable.length;
        const pageSize = typeof this.PageSize === "string" ? parseInt(this.PageSize, 10) : this.PageSize;
        if (totalPages === 0) {
            pf.innerHTML = "";
            if (summary) {
                summary.textContent = totalRows === 0 ? "No entries to display." : "No entries match your search.";
            }
            if (prev) {
                prev.disabled = true;
            }
            if (next) {
                next.disabled = true;
            }
            return;
        }
        if (this.i >= totalPages) {
            this.i = totalPages - 1;
        }
        if (this.i < 0) {
            this.i = 0;
        }
        const items = this.buildPaginationItems();
        let html = "";
        for (let k = 0; k < items.length; k++) {
            const item = items[k];
            if (item === "ellipsis") {
                html += "<span class=\"pagination-gap\" aria-hidden=\"true\">…</span>";
            } else {
                const idx = item;
                const pageNum = idx + 1;
                const isActive = idx === this.i;
                html += `<button type="button" class="page-num${isActive ? " is-active" : ""}" data-page-index="${idx}" aria-label="Page ${pageNum}"${isActive ? " aria-current=\"page\"" : ""}>${pageNum}</button>`;
            }
        }
        pf.innerHTML = html;
        const startRow = totalRows === 0 ? 0 : this.i * pageSize + 1;
        const endRow = Math.min((this.i + 1) * pageSize, totalRows);
        if (summary) {
            summary.textContent = `Showing ${startRow}–${endRow} of ${totalRows} entries · Page ${this.i + 1} of ${totalPages}`;
        }
        if (prev) {
            prev.disabled = this.i <= 0;
        }
        if (next) {
            next.disabled = this.i >= totalPages - 1;
        }
    }
    search() {
        this.DataSearch = this.DataTable;
        const el = document.getElementById("SearchControl");
        if (!el) {
            return;
        }
        el.addEventListener("input", (evt) => {
            this.searchValue = evt.target.value;
            const q = evt.target.value.toLowerCase();
            this.DataTable = this.DataSearch.filter((element) => {
                for (let index = 0; index < this.HeaderDataTable.length; index++) {
                    const fg = element[this.HeaderDataTable[index]].toString().toLowerCase().includes(q);
                    if (fg) {
                        return true;
                    }
                }
                return false;
            });
            this.i = 0;
            this.RenderToHTML();
            this.highlight(evt.target.value);
        });
    }
    ConvertToJson() {
        const getHead = this.TableElement?.getElementsByTagName("th");
        if (getHead) {
            for (let v = 0; v < getHead.length; v++) {
                this.HeaderDataTable.push(getHead[v].textContent);
            }
        }
        const getbody = this.TableElement?.getElementsByTagName("tbody");
        const tbody = getbody?.[0];
        const rowCount = tbody ? tbody.rows.length : 0;
        for (let row = 0; row < rowCount; row++) {
            const cellsD = [];
            for (let cellsIndex = 0; cellsIndex < tbody.rows[row].cells.length; cellsIndex++) {
                cellsD.push(tbody.rows[row].cells[cellsIndex].innerHTML);
            }
            this.RowDataTable.push(cellsD);
        }
        this.DataTable = this.RowDataTable.reduce((acc, e) => {
            acc.push(this.HeaderDataTable.reduce((x, y, i) => {
                x[y] = e[i];
                return x;
            }, {}));
            return acc;
        }, []);
        return this.DataTable;
    }
    Divide() {
        const gh = [];
        const h = (typeof this.PageSize === "string") ? parseInt(this.PageSize) : this.PageSize;
        for (let i = 0; i < ((this.DataTable === undefined) ? 0 : this.DataTable.length); i += h) {
            gh.push(this.DataTable.slice(i, i + h));
        }
        return gh;
    }
    RenderToHTML() {
        this.TableElement.innerHTML = '';
        const chunks = this.Divide();
        const n = chunks.length;
        if (n === 0) {
            this.DataToRender = [];
        } else {
            if (this.i >= n) {
                this.i = n - 1;
            }
            if (this.i < 0) {
                this.i = 0;
            }
            this.DataToRender = chunks[this.i];
        }
        let header = '';
        let footer = '';
        for (let I = 0; I < this.HeaderDataTable.length; I++) {
            header += `<th class="columns tablesorter-header logs-col-header" id="${this.HeaderDataTable[I]}_header">${this.HeaderDataTable[I]}</th>\n`;
            footer += `<th class="columns tablesorter-header logs-col-header" id="${this.HeaderDataTable[I]}_footer">${this.HeaderDataTable[I]}</th>\n`;
        }
        const ifUndefinded = (this.DataToRender === undefined || !this.DataToRender) ? 0 : this.DataToRender.length;
        let row = '';
        for (let ___row = 0; ___row < ifUndefinded; ___row++) {
            let ToCell = '';
            for (let ___cell = 0; ___cell < this.HeaderDataTable.length; ___cell++) {
                ToCell += `<td class="logs-col-cell ${this.HeaderDataTable[___cell]}__row">${this.DataToRender[___row][this.HeaderDataTable[___cell]]}</td>\n`;
            }
            row += `<tr>${ToCell}</tr>\n`;
        }
        const ToEl = `<thead><tr>${header}</tr></thead><tbody>${row}</tbody><tfoot style="display: none;">${footer}</tfoot>`;
        this.TableElement.innerHTML = ToEl;
        for (let n = 0; n < this.HeaderDataTable.length; n++) {
            const cv = document.getElementById(`${this.HeaderDataTable[n]}_header`);
            document.getElementById(`${this.HeaderDataTable[n]}_header`).style.opacity = '100%';
            cv.onclick = () => {
                this.sort(this.HeaderDataTable[n]);
                document.getElementById(`${this.HeaderDataTable[n]}_header`).style.opacity = '60%';
                if (this.Assc) {
                    document.getElementById(`${this.HeaderDataTable[n]}_header`).classList.remove('tablesorter-header-asc');
                    document.getElementById(`${this.HeaderDataTable[n]}_header`).classList.add('tablesorter-header-desc');
                }
                else {
                    document.getElementById(`${this.HeaderDataTable[n]}_header`).classList.remove('tablesorter-header-desc');
                    document.getElementById(`${this.HeaderDataTable[n]}_header`).classList.add('tablesorter-header-asc');
                }
                if (this.Options.sortAnimate) {
                    const s = document.getElementsByClassName(`${this.HeaderDataTable[n]}__row`);
                    for (let NN = 0; NN < s.length; NN++) {
                        setTimeout(() => s[NN].classList.add('blink_me'), 21 * NN);
                    }
                }
            };
        }
        this.PaginateUpdate();
        this.DoHide();
    }
    sort(column) {
        function naturalCompare(a, b) {
            const ax = [];
            const bx = [];
            a.toString().replace(/(^\$|,)/g, '').replace(/(\d+)|(\D+)/g, function (_, $1, $2) { ax.push([$1 || Infinity, $2 || ""]); });
            b.toString().replace(/(^\$|,)/g, '').replace(/(\d+)|(\D+)/g, function (_, $1, $2) { bx.push([$1 || Infinity, $2 || ""]); });
            for (let index = 0; ax.length && bx.length; index++) {
                const an = ax.shift();
                const bn = bx.shift();
                const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
                if (nn)
                    return nn;
            }
            return ax.length - bx.length;
        }
        const IndexHead = this.HeaderDataTable.indexOf(column);
        const listDated = this.listTypeDate.find((x) => x.HeaderIndex === IndexHead);
        const isDate = listDated?.HeaderIndex === IndexHead;
        const data = this.DataTable;
        if (this.Assc) {
            this.Assc = !this.Assc;
            if (!isDate) {
                data.sort((a, b) => {
                    return naturalCompare(a[column], b[column]);
                });
            }
            else {
                data.sort((a, b) => {
                    return Date.parse(a[column]) - Date.parse(b[column]);
                });
            }
        }
        else {
            this.Assc = !this.Assc;
            if (!isDate) {
                data.sort((a, b) => {
                    return naturalCompare(b[column], a[column]);
                });
            }
            else {
                data.sort((a, b) => {
                    return Date.parse(b[column]) - Date.parse(a[column]);
                });
            }
        }
        this.i = 0;
        this.RenderToHTML();
        return this.DataTable;
    }
    DownloadCSV(filename = "Export") {
        const lines = [this.HeaderDataTable.map((h) => escapeCsvField(h)).join(",")];
        for (let i = 0; i < this.DataTable.length; i++) {
            lines.push(this.HeaderDataTable.map((h) => escapeCsvField(this.DataTable[i][h])).join(","));
        }
        const str = lines.join("\r\n");
        const element = document.createElement("a");
        element.href = "data:text/csv;charset=utf-8," + encodeURIComponent(str);
        element.target = "_blank";
        element.download = filename + ".csv";
        element.click();
    }
    DownloadJSON(filename = 'Export') {
        const element = document.createElement('a');
        element.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.DataTable));
        element.target = '_blank';
        element.download = filename + '.json';
        element.click();
    }
    highlight(text) {
        if (!this.ShowHighlight) {
            return;
        }
        const getbody = this.TableElement?.getElementsByTagName("tbody");
        const tbody = getbody?.[0];
        if (!tbody) {
            return;
        }
        for (let row = 0; row < tbody.rows.length; row++) {
            for (let cellsIndex = 0; cellsIndex < tbody.rows[row].cells.length; cellsIndex++) {
                let innerHTML = tbody.rows[row].cells[cellsIndex].innerHTML;
                const index = innerHTML.indexOf(text);
                if (index >= 0) {
                    innerHTML = innerHTML.substring(0, index) + "<span style='background-color: yellow;'>" + innerHTML.substring(index, index + text.length) + "</span>" + innerHTML.substring(index + text.length);
                    tbody.rows[row].cells[cellsIndex].innerHTML = innerHTML;
                    tbody.rows[row].cells[cellsIndex].classList.add(`${this.HeaderDataTable[cellsIndex].replace(/\s/g, "_")}__row`);
                }
            }
        }
    }
    JSONinit(PayLoad = []) {
        if (!PayLoad.length) {
            return;
        }
        this.HeaderDataTable = [];
        for (const key in PayLoad[0]) {
            this.HeaderDataTable.push(key);
        }
        this.DataTable = PayLoad;
        this.DataSearch = PayLoad;
        this.i = 0;
        this.RenderToHTML();
    }
    HideCol(column) {
        const Classes = document.getElementsByClassName(`${column}__row`);
        for (let O = 0; O < Classes.length; O++) {
            Classes[O].style.display = "none";
        }
        if (document.getElementById(`${column}_header`)) {
            document.getElementById(`${column}_header`).style.display = "none";
            document.getElementById(`${column}_footer`).style.display = "none";
        }
    }
    ShowCol(column) {
        const Classes = document.getElementsByClassName(`${column}__row`);
        for (let O = 0; O < Classes.length; O++) {
            Classes[O].style.display = "";
        }
        if (document.getElementById(`${column}_header`)) {
            document.getElementById(`${column}_header`).style.display = "";
            document.getElementById(`${column}_footer`).style.display = "";
        }
    }
    DoHide() {
        const GetHeadArr = this.HeaderDataTable;
        const ListOftrutc = [];
        for (let T = 0; T < this.HeaderDataTable.length; T++) {
            ListOftrutc.push(true);
        }
        for (let O = 0; O < this.ListHiding.length; O++) {
            const Index = GetHeadArr.indexOf(this.ListHiding[O]);
            if (Index > -1) {
                ListOftrutc[Index] = false;
            }
        }
        const IndexTrue = [];
        const IndexFalse = [];
        for (let U = 0; U < ListOftrutc.length; U++) {
            if (ListOftrutc[U]) {
                IndexTrue.push(U);
            }
            if (!ListOftrutc[U]) {
                IndexFalse.push(U);
            }
        }
        for (let V = 0; V < IndexTrue.length; V++) {
            this.ShowCol(GetHeadArr[IndexTrue[V]]);
        }
        for (let F = 0; F < IndexFalse.length; F++) {
            this.HideCol(GetHeadArr[IndexFalse[F]]);
        }
    }
}

(function init() {
    try {
        const b = window.parent?.document?.body;
        if (b) {
            b.style.zoom = "0.8";
        }
    } catch {
        try {
            document.body.style.zoom = "0.8";
        } catch {}
    }
    start();
})();
