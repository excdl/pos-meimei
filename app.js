
const API_URL = "https://script.google.com/macros/s/AKfycbxIONfqq50nNi5V0XKYaWN1k4-1pBhUChyOLsFOkCYGUr55y6FfG_Vb5f3Jrl7l9xk0Kg/exec";
function formatNumber(num) { if (num === null || num === undefined || num === "") return "0"; let n = Number(num); if (isNaN(n)) return "0"; return n.toLocaleString('zh-TW'); }
let POS_STORE = "";
let posCart = [], currentTax = "應稅";
let editIndex = null;       // 正在編輯的商品索引
let editingField = null;    // 正在編輯的欄位
let modalType = null;
let kpTarget = null;


  // ====== 更快的 IP 取得（含 sessionStorage 快取）======
async function getIP() {
    const cache = sessionStorage.getItem("myIP");
    if (cache) return cache;

    try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        sessionStorage.setItem("myIP", data.ip);
        return data.ip;
    } catch {
        return "";
    }
}

function updateLoginTime() {
  const now = new Date();
  document.getElementById("loginTime").innerText = `登入時間：${now.toLocaleString("zh-TW",{hour12:false})}`;
}

async function login() {
  const loginBtn = document.getElementById("loginBtn");
  loginBtn.innerText = "登入中...";
  loginBtn.disabled = true;

  const store = document.getElementById("storeInput").value;
  const pwd = document.getElementById("passwordInput").value;
  const userIP = await getIP();

  try {
    const res = await fetch(`${API_URL}?action=login&store=${store}&pwd=${pwd}&ip=${userIP}`);
    const data = await res.json();

    if (data.status === "success") {
      POS_STORE = data.storeCode;

      // 隱藏登入頁，顯示 POS
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("posApp").style.display = "flex";

      // 顯示門市資訊
      document.getElementById("storeInfo").innerText = `${data.storeName}（${data.storeCode}）`;

      // 更新並每秒刷新登入時間
      updateLoginTime();
      setInterval(updateLoginTime, 1000);
      
      // 取得商品資料
      fetchProducts();
      fetchSalesList();
      setTimeout(() => {
    const cashBtn = document.querySelector('#paymentButtons .payBtn[data-pay="現金"]');
    if (cashBtn) cashBtn.click();
}, 0);

    } else {
      document.getElementById("loginMsg").innerText = data.message;
      loginBtn.innerText = "登入";
      loginBtn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    document.getElementById("loginMsg").innerText = "登入失敗，請稍後再試";
    loginBtn.innerText = "登入";
    loginBtn.disabled = false;
  }
}

// ===== 更新登入時間 =====
function updateLoginTime() {
  const now = new Date();
  const timeStr = now.toLocaleString("zh-TW", { hour12: false });
  document.getElementById("loginTime").innerText = `登入時間：${timeStr}`;
}

document.getElementById("logoutBtn").onclick = logout;

async function logout() {
    const logoutBtn = document.getElementById("logoutBtn");

    // 點擊後才改文字
    logoutBtn.disabled = true;
    logoutBtn.innerText = "登出中...";
    logoutBtn.classList.add("active");

    const now = new Date();
    const logoutTime = now.toLocaleString("zh-TW", { hour12: false });

    try {
        await fetch(`${API_URL}?action=logout&store=${POS_STORE}&time=${encodeURIComponent(logoutTime)}`);
    } catch (err) {
        console.error(err);
    } finally {
        // 隱藏 POS 主頁，顯示登入頁
        document.getElementById("posApp").style.display = "none";
        document.getElementById("loginPage").style.display = "flex";

        // 清空登入欄位
        document.getElementById("storeInput").value = "";
        document.getElementById("passwordInput").value = "";
        document.getElementById("loginMsg").innerText = "";

        // 重置登入按鈕
        const loginBtn = document.getElementById("loginBtn");
        loginBtn.innerText = "登入";
        loginBtn.disabled = false;

        // 清除 POS_STORE
        POS_STORE = "";

        // 恢復登出按鈕狀態
        logoutBtn.disabled = false;
        logoutBtn.innerText = "登出"; // 固定回「登出」
        logoutBtn.classList.remove("active");
    }
}

// 綁定按鈕事件
document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);


// ===== 取得商品 =====
async function fetchProducts() {
    const res = await fetch(API_URL + "?action=products");
    products = await res.json();
    categories = [...new Set(products.map(x => x["類別"]))];
    renderCategories();
    if (categories.length > 0) renderProducts(categories[0]);
}

async function fetchSalesList() {
  try {
    const res = await fetch(`${API_URL}?action=salesList&storeCode=${POS_STORE}`);
    const data = await res.json();

    if (data.status !== "success") return;

    const listEl = document.getElementById("salesList");
    listEl.innerHTML = "";

    data.list.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      listEl.appendChild(opt);
    });

    // ⭐ 預設帶入登入者
    document.getElementById("salesInput").value = data.defaultUser || "";
  } catch (err) {
    console.error("載入業代失敗", err);
  }
}    
// ===== 渲染分類 =====
function renderCategories() {
    const box = document.getElementById("posCategories");
    box.querySelectorAll("button.cat-btn").forEach(b => b.remove());

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.classList.add("cat-btn");
        btn.textContent = cat;
        btn.onclick = () => {
            document.querySelectorAll("#posCategories button.cat-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderProducts(cat);
        };
        box.appendChild(btn);
    });

    const firstBtn = box.querySelector("button.cat-btn");
    if (firstBtn) firstBtn.classList.add("active");
}

// ===== 搜尋商品 =====
document.getElementById("searchBox").oninput = function () {
    renderProducts(null, this.value.trim().toLowerCase());
};

  function parseNumber(str) {
    return Number(str.replace(/,/g, ""));
}

/*********************************
 * 存酒 Modal 控制用
 *********************************/
let pendingStoreProduct = null;

/*********************************
 * ===== 渲染商品（唯一版本）=====
 *********************************/
function renderProducts(category = null, search = "") {
    const box = document.getElementById("posProducts");
    box.innerHTML = "";

    products
        .filter(p => {
            if (category && p["類別"] !== category) return false;
            if (search && !p["商品名稱"].toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        })
        .forEach(p => {
            console.log(
  "DEBUG 商品：",
  p["商品名稱"],
  "| 是否存酒 =",
  JSON.stringify(p["是否存酒"]),
  "| 全物件 =",
  p
);

            
            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
                <h4>${p["商品名稱"]}</h4>
                <p>${p["售價"]} 元 / ${p["單位"]}</p>
            `;

            card.onclick = () => {
                if (p["是否存酒"] === "Y") {
                    openStoreWineModal(p);
                } else {
                    addPOSItem(p, false);
                }
            };

            box.appendChild(card);
        });
}

/*********************************
 * ===== 存酒 Modal =====
 *********************************/
function openStoreWineModal(product) {
    pendingStoreProduct = product;
    document.getElementById("storeWineTitle").innerText =
        `【${product["商品名稱"]}】`;
    document.getElementById("storeWineModal").style.display = "flex";
}

function confirmStoreWine(isStore) {
    if (!pendingStoreProduct) return;
    addPOSItem(pendingStoreProduct, isStore);
    pendingStoreProduct = null;
    document.getElementById("storeWineModal").style.display = "none";
}

/*********************************
 * ===== 加入購物車（支援存酒）=====
 *********************************/
function addPOSItem(p, forceStore = false) { 
    let qtyAdd = 1;
    let pricePerUnit = Number(p["售價"]);
    let unit = p["單位"];
    if (unit === "半斤") { 
        qtyAdd = 0.5; 
        pricePerUnit *= 2; 
        unit = "斤"; 
    }

    // 計算存酒日期
    const now = new Date();
    let expireDate = null;
    if (forceStore) {
        const months = p["存酒期限(月)"] ? Number(p["存酒期限(月)"]) : 2;
        const d = new Date(now);
        d.setMonth(d.getMonth() + months);
        expireDate = d.toLocaleDateString("zh-TW");
    }

    // 查詢購物車內是否已存在相同商品（同存酒狀態）
    let exist = posCart.find(x => x.name === p["商品名稱"] && x.isStored === forceStore);

    if (exist) {
        exist.quantity += qtyAdd;
    } else {
        posCart.push({
            name: p["商品名稱"],
            quantity: qtyAdd,
            price: pricePerUnit,
            unit: unit,
            discount: null,
         // ⭐ 判斷是不是開瓶費（用你後台的名稱）
          isCorkage: p["商品名稱"] === "開瓶費",

            // ⭐ 存酒相關
            isStored: forceStore,
            storeMonths: Number(p["存酒期限(月)"]) || 0,
            storeDate: forceStore ? now.toLocaleDateString("zh-TW") : null,
            expireDate: forceStore ? expireDate : null
        });
    }

    renderCart();
}


/*********************************
 * ===== 初始化付款方式 =====
 *********************************/
function initPOSButtons() {
    const buttons = document.querySelectorAll("#paymentButtons .payBtn");
    buttons.forEach(btn => {
        btn.addEventListener("click", function () {

            // 取消所有 active
            buttons.forEach(b => b.classList.remove("active"));

            // 設定 active
            this.classList.add("active");

            // 寫入隱藏欄位
            const pay = this.getAttribute("data-pay");
            document.getElementById("posPayment").value = pay;

            const cashPanel = document.getElementById("cashPanel");
            const cashInput = document.getElementById("cashInput");
            const changeOut = document.getElementById("changeOut");

            if (pay === "現金") {
                cashPanel.style.display = "block";
            } else {
                cashPanel.style.display = "none";
                cashInput.value = "";
                changeOut.innerText = "0";
            }

            renderCart(); // 更新總額/找零
        });
    });
}

document.addEventListener("DOMContentLoaded", initPOSButtons);


/*********************************
 * ===== 渲染購物車（原邏輯保留）=====
 *********************************/
function renderCart() {
    const box = document.getElementById("posCart");
    box.innerHTML = "";
    let totalBeforeTax = 0;
    let totalForMinConsume = 0; // ⭐ 只算非開瓶費
    posCart.forEach((item, i) => {
        let sub = item.quantity * item.price;

        if (item.discount) {
            switch (item.discount.type) {
                case "第二件減10":
                    sub -= Math.floor(item.quantity / 2) * 10;
                    break;
                case "買二送一":
                    sub -= Math.floor(item.quantity / 3) * item.price;
                    break;
                case "買一送一":
                    sub -= Math.floor(item.quantity / 2) * item.price;
                    break;
                case "第二件6折":
                    sub -= Math.floor(item.quantity / 2) * item.price * 0.4;
                    break;
                default:
                    sub *= item.discount.rate || 1;
                    break;
            }
        }

        totalBeforeTax += sub;
        if (!item.isCorkage) {
        totalForMinConsume += sub;
        }

        const row = document.createElement("div");
        row.className = "cartRow";
        row.innerHTML = `
            <span class="name" onclick="openPromoModal(posCart[${i}])">
              ${item.name}
              ${item.isStored ? "<b style='color:#27ae60;'>🧊存酒</b>" : ""}
            </span>
            <span class="qty" onclick="openEditModal(${i},'quantity')">
              ${item.quantity.toFixed(0)} ${item.unit}
            </span>
            <span class="price" onclick="openEditModal(${i},'price')">${item.price}</span>
            <span class="subtotal">${formatNumber(Math.round(sub))}</span>
            <span class="remove">
              <button onclick="removeItem(${i})">刪</button>
            </span>
        `;
        box.appendChild(row);
    });

    // ===== 計算稅額 =====
    let beforeTax = Math.round(totalBeforeTax);
    let tax = currentTax === "應稅" ? Math.round(beforeTax * 0.05) : 0;
    let afterTax = beforeTax + tax;

    // ===== 計算折扣/低消 =====
    let discountValue =      Number(document.getElementById("discount").value) || 0;
    let actualAmount = afterTax - discountValue;

// ⭐ 低消只看「非開瓶費」
let minConsume = getMinConsumeTotal();
let baseAmount = Math.max(totalForMinConsume, minConsume);

// ⭐ 開瓶費（從總額扣掉商品）
let corkageAmount = totalBeforeTax - totalForMinConsume;

// ⭐ 最終應收
let receivable = baseAmount + corkageAmount;

    // ===== 更新 UI =====
    document.getElementById("beforeTax").innerText = formatNumber(beforeTax);
    document.getElementById("taxAmount").innerText = formatNumber(tax);
    document.getElementById("afterTax").innerText = formatNumber(afterTax);

    const posTotalEl = document.getElementById("posTotal");
    posTotalEl.dataset.value = receivable;
    posTotalEl.innerText = formatNumber(receivable);

    updateChange(); // 更新找零（現金場景）

    // ===== 低消顯示 =====
    const alertEl = document.getElementById("minConsumeAlert");
    const checkoutBtn = document.getElementById("posCheckout");
    if (actualAmount < minConsume && minConsume > 0) {
        if (alertEl) alertEl.style.display = "block";
        posTotalEl.style.color = "#c0392b";
        checkoutBtn.classList.add("minAlert");
    } else {
        if (alertEl) alertEl.style.display = "none";
        posTotalEl.style.color = "#2c3e50";
        checkoutBtn.classList.remove("minAlert");
    }
}


function updateChange() {
    const paymentMethod = document.getElementById("posPayment").value;
    const cash = Number(document.getElementById("cashInput").value) || 0;

    const totalEl = document.getElementById("posTotal");
    const receivable = Number(totalEl.dataset.value || totalEl.innerText.replace(/,/g, "")) || 0;

    const change = paymentMethod === "現金"
        ? Math.max(cash - receivable, 0)
        : 0;

    document.getElementById("changeOut").innerText = formatNumber(change);
}

// 取得查詢存酒按鈕
  const checkWineBtn = document.getElementById('checkWineBtn');

  // 點擊事件：開啟新視窗
  checkWineBtn.addEventListener('click', () => {
    window.open('https://excdl.github.io/wine/', '_blank');
  });

// ===== 千分位格式化 =====
function formatNumber(num) {
    return num.toLocaleString("zh-TW");
}

// ===== 監聽折扣與現金輸入變動，立即更新找零 =====
document.getElementById("discount").addEventListener("input", renderCart);
document.getElementById("cashInput").addEventListener("input", updateChange);


async function updateTodaySales() {
  const now = new Date();
  const formatDate = now.getFullYear() + "/" +
                     String(now.getMonth() + 1).padStart(2, "0") + "/" +
                     String(now.getDate()).padStart(2, "0");

  try {
    const res = await fetch(`${API_URL}?action=todaySales&storeCode=${POS_STORE}&date=${formatDate}`);
    const data = await res.json();

    if(data.status === "success") {
    document.getElementById("todaySalesDisplay").innerHTML =
    `<b>今日營業概況</b>
—————————————
總額：${data.total.toFixed(0)} 元
現金：${data.cash.toFixed(0)} 元
刷卡：${data.credit.toFixed(0)} 元
Line Pay：${data.linePay.toFixed(0)} 元`;

    } else {
      console.error("取得今日營業額失敗：", data.message);
    }
  } catch (err) {
    console.error("更新今日營業額時發生錯誤：", err);
  }
}

// 每 10 秒自動刷新一次
setInterval(updateTodaySales, 30000);

// 頁面載入立即更新一次
updateTodaySales();

// 交班按鈕
document.getElementById("shiftEndBtn").onclick = async function() {
  if (posCart.length > 0 && !confirm("購物車尚有未結帳商品，是否仍交班？")) return;

  const now = new Date();
  const formatDate = now.getFullYear() + "/" +
                     String(now.getMonth() + 1).padStart(2, "0") + "/" +
                     String(now.getDate()).padStart(2, "0");
  const formatTime = String(now.getHours()).padStart(2, "0") + ":" +
                     String(now.getMinutes()).padStart(2, "0") + ":" +
                     String(now.getSeconds()).padStart(2, "0");

  const payload = {
    storeCode: POS_STORE,
    storeName: document.getElementById("storeInfo").innerText.split("（")[0],
    shiftDate: formatDate,
    shiftEndTime: formatTime
  };

  const res = await fetch(`${API_URL}?action=shiftEnd`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  alert(`交班成功！
本班總營業額：${data.total} 元
現金：${data.cash} 元
刷卡：${data.credit} 元
Line Pay：${data.linePay} 元`);

  posCart = [];
  renderCart();
  updateTodaySales(); // 交班後立即更新今日營業額
};

// 點擊按鈕也更新
document.getElementById("dailySalesBtn").onclick = updateTodaySales;

// 初始載入頁面時也更新
updateTodaySales();


// ===== 刪除商品 =====
function removeItem(i) { posCart.splice(i, 1); renderCart(); }

// ===== 編輯數量/折扣/收現 =====
document.getElementById("discount").onclick = () => {
  openPOSKeypad("discount", document.getElementById("discount").value);
};

document.getElementById("cashInput").onclick = () => {
  openPOSKeypad("cash", document.getElementById("cashInput").value);
};

/* ===========================================================
   【打開 小鍵盤 / 大鍵盤 編輯 Modal】
=========================================================== */
function openEditModal(index, field) {
    editIndex = index;
    editingField = field;
    modalType = "edit";

    const modal = document.getElementById("editModal");
    const promoDiv = document.getElementById("promoButtons");
    const numpad = document.getElementById("numpad");
    const modalActions = document.querySelector("#editModal .modalActions");
    const modalInput = document.getElementById("modalInput");

    // 共用初始化
    promoDiv.style.display = 'none';
    document.getElementById("editCloseBtn").style.display = 'none';

    // ====== 大鍵盤模式（折扣 or 收現金）======
    if (field === 'discount' || field === 'cash') {
        kpTarget = field;
        document.getElementById("posKeypadTitle").innerText =
            field === "discount" ? "輸入折扣" : "收現金";

        document.getElementById("posKeypadInput").value =
            field === "discount"
                ? document.getElementById("discount").value
                : document.getElementById("cashInput").value || "";

        document.getElementById("posKeypadModal").style.display = "flex";
        return;
    }

    // ====== 小鍵盤模式 ======
    numpad.style.display = 'grid';
    modalInput.style.display = 'block';
    modalInput.readOnly = false;
    modalActions.style.display = 'flex';

    modalInput.value = posCart[index]?.[field] ?? "";
    document.getElementById("modalProductName").innerText = "輸入";
    document.getElementById("modalProductName").style.color = "#fff";
    modal.style.display = "flex";
}

/* ===========================================================
   【優惠方案 Modal】
=========================================================== */
function openPromoModal(item) {
    modalType = 'promo';
    editIndex = null;

    const modal = document.getElementById("editModal");
    const promoDiv = document.getElementById("promoButtons");

    document.getElementById("numpad").style.display = 'none';
    document.getElementById("modalInput").style.display = 'none';
    promoDiv.style.display = 'grid';
    promoDiv.innerHTML = '';
    document.querySelector("#editModal .modalActions").style.display = 'none';
    document.getElementById("editCloseBtn").style.display = 'block';

    const promoList = [
        { name: '95折', rate: 0.95 },
        { name: '9折', rate: 0.9 },
        { name: '85折', rate: 0.85 },
        { name: '8折', rate: 0.8 },
        { name: '7折', rate: 0.7 },
        { name: '6折', rate: 0.6 },
        { name: '買一送一', type: '買一送一' },
        { name: '買二送一', type: '買二送一' },
        { name: '第二件減10', type: '第二件減10' },
        { name: '第二件6折', type: '第二件6折' }
    ];

    promoList.forEach(p => {
        const btn = document.createElement("button");
        btn.innerText = p.name;
        btn.onclick = () => {
            let idx = posCart.findIndex(x => x.name === item.name);
            if (idx === -1) addPOSItem(item);

            idx = posCart.findIndex(x => x.name === item.name);
            if (idx !== -1) {
                posCart[idx].discount = p.type
                    ? { type: p.type }
                    : { rate: p.rate, type: "折扣" };
            }

            closeModal();
            renderCart();
        };
        promoDiv.appendChild(btn);
    });

    document.getElementById("modalProductName").innerText = item.name;
    modal.style.display = "flex";
}

/* ===========================================================
   【小鍵盤操作】
=========================================================== */
function np(v) {
    const input = document.getElementById("modalInput");
    input.value += v;
}

function backspace() {
    const input = document.getElementById("modalInput");
    input.value = input.value.slice(0, -1);
}

function confirmEdit() {
    const val = document.getElementById("modalInput").value;

    if (editIndex !== null && editingField === 'quantity' && posCart[editIndex].unit === '斤') {
        const [j = 0, l = 0, q = 0] = val.split('.').map(Number);
        posCart[editIndex].quantity = j + l / 16 + q / 160;
    } else if (editIndex !== null) {
        posCart[editIndex][editingField] = Number(val);
    }

    closeModal();
    renderCart();
}

/* ===========================================================
   【關閉 Modal（統一）】
=========================================================== */
function closeModal() {
    document.getElementById("editModal").style.display = 'none';
    document.getElementById("posKeypadModal").style.display = 'none';

    // 恢復預設 UI
    document.querySelector("#editModal .modalActions").style.display = 'flex';
    document.getElementById("modalInput").style.display = 'block';
    document.getElementById("modalInput").readOnly = false;
    document.getElementById("numpad").style.display = 'grid';
    document.getElementById("promoButtons").style.display = 'none';
    document.getElementById("editCloseBtn").style.display = 'none';
}

/* ===========================================================
   【POS 大鍵盤輸入 / 刪除 / 確認（統一版本）】
=========================================================== */
function openPOSKeypad(type, value = "0") {
    kpTarget = type;
    document.getElementById("posKeypadTitle").innerText =
        type === "discount" ? "折扣金額" : "收現金";

    document.getElementById("posKeypadInput").value = value;
    document.getElementById("posKeypadModal").style.display = "flex";
}

function kpInput(v) {
    const input = document.getElementById("posKeypadInput");
    if (input.value === "0") input.value = "";
    input.value += v;
}

function kpBack() {
    const input = document.getElementById("posKeypadInput");
    input.value = input.value.slice(0, -1);
    if (!input.value) input.value = "0";
}

function kpConfirm() {
    const v = document.getElementById("posKeypadInput").value;

    if (kpTarget === "discount") {
        document.getElementById("discount").value = v;
        renderCart();
    }

    if (kpTarget === "cash") {
        document.getElementById("cashInput").value = v;
        updateChange();
    }

    document.getElementById("posKeypadModal").style.display = "none";
}
let allowMinConsumeCheckout = false;
function getMinConsumeTotal() {
  const people = Number(document.getElementById("peopleCount")?.value) || 0;
  const perMin = Number(document.getElementById("minConsumeInput")?.value) || 0;
  return people * perMin;
}

// 低消變動時，立即重算
document.getElementById("minConsumeInput").addEventListener("input", () => {
  renderCart();
});


function showMinConsumeConfirm(actual,min){
  document.getElementById("minConsumeConfirmText").innerHTML =
    `實際消費 ${formatNumber(actual)} 元<br>
     低消 ${formatNumber(min)} 元<br>
     需補差 <b style="color:#c0392b">${formatNumber(min-actual)}</b> 元`;
  document.getElementById("minConsumeConfirm").style.display="flex";
}
function cancelMinConsumeCheckout(){
  allowMinConsumeCheckout=false;
  document.getElementById("minConsumeConfirm").style.display="none";
}
function confirmMinConsumeCheckout(){
  allowMinConsumeCheckout=true;
  document.getElementById("minConsumeConfirm").style.display="none";
  document.getElementById("posCheckout").click();
}

  
function setTax(t) {
    currentTax = t;
    document.getElementById("taxIncluded").classList.toggle('active', t === "應稅");
    document.getElementById("taxExempt").classList.toggle('active', t === "免稅");
    renderCart();
}

  // 頁面載入時預設免稅
window.addEventListener("DOMContentLoaded", () => {
    setTax("免稅");

    document.getElementById("peopleCount")
      ?.addEventListener("input", renderCart);

    document.getElementById("minConsumeInput")
      ?.addEventListener("input", renderCart);
});;


function formatDiscountRate(rate) {
    let d = rate * 100;          // 0.9 → 90
    let s = d.toString();        // "90"

    // 90 → 9, 80 → 8, 70 → 7...
    if (d % 10 === 0) {
        s = (d / 10).toString();
    }
    return s + "折";
}
  
  
function calcDiscountedSubtotal(item) {
    let sub = item.quantity * item.price;
    if (item.discount) {
        switch (item.discount.type) {
            case "第二件減10":
                sub -= Math.floor(item.quantity / 2) * 10;
                break;
            case "買二送一":
                sub -= Math.floor(item.quantity / 3) * item.price;
                break;
            case "買一送一":
                sub -= Math.floor(item.quantity / 2) * item.price;
                break;
            case "第二件6折":
                sub -= Math.floor(item.quantity / 2) * item.price * 0.4;
                break;
            case "折扣":      // 例如 95折、9折
                sub *= item.discount.rate;
                break;
        }
    }
    return Math.round(sub);
}

 async function sendCheckoutToSheet() {
    const now = new Date();

    // ===== payload 基本資料 =====
    const payload = {
        orderDate: now.toLocaleDateString("zh-TW"),
        orderTime: now.toLocaleTimeString("zh-TW", { hour12: false }),
        checkoutDateTime: now.toLocaleString("zh-TW", { hour12: false }),

        storeName: document.getElementById("storeInfo").innerText.split("（")[0],
        storeCode: POS_STORE,

        salesName: document.getElementById("salesInput")?.value || "",
        peopleCount: Number(document.getElementById("peopleCount")?.value) || 0,

        taxStatus: currentTax,
        totalAmount: parseNumber(document.getElementById("posTotal").innerText),
        taxAmount: parseNumber(document.getElementById("taxAmount").innerText),
        paymentMethod: document.getElementById("posPayment").value,
        discount: Number(document.getElementById("discount").value) || 0,
        cashReceive: Number(document.getElementById("cashInput").value) || 0,
        change: Number(document.getElementById("changeOut").innerText) || 0,

        // 購物車商品
        items: posCart.map(it => {
            const discountedSubtotal = calcDiscountedSubtotal(it);

            let promoText = "";
            if (it.discount) {
                promoText = it.discount.type === "折扣"
                    ? formatDiscountRate(it.discount.rate)
                    : it.discount.type;
            }

            return {
                category: products.find(p => p["商品名稱"] === it.name)?.["類別"] || "",
                name: it.name,
                quantity: it.quantity,
                price: it.price,
                subtotal: discountedSubtotal,
                promo: promoText
            };
        })
    };

    // ===== 自動產生存酒資料 =====
      function addMonths(date, months) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d.toLocaleDateString("zh-TW");
    }

    const storedItems = posCart
        .filter(it => it.isStored)
        .map(it => {
            const product = products.find(p => p["商品名稱"] === it.name);
            const nowDate = new Date();
            return {
                customerName: document.getElementById("customerName").value,
                customerPhone: document.getElementById("customerPhone").value,
                storeCode: payload.storeCode,
                storeName: payload.storeName,
                productName: it.name,
                totalQty: it.quantity,
                remainQty: it.quantity,
                unit: it.unit,
                storeDate: nowDate.toLocaleDateString("zh-TW"),
                expireDate: product && product["存酒期限(月)"] 
                    ? addMonths(nowDate, Number(product["存酒期限(月)"]))
                    : addMonths(nowDate, 2)
            };
        });

    payload.storedItems = storedItems;

    // ===== 送出至 GAS =====
    await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    });
}


// ===== 印表機狀態檢查（不影響結帳）=====
async function printerIsReady() {
    try {
        const printers = await qz.printers.find();
        return (printers && printers.length > 0);
    } catch (e) {
        return false;
    }
}

// ===== 結帳：先入帳 → 再嘗試列印到自動抓取的印表機 =====
document.getElementById("posCheckout").onclick = async function () {

    const checkoutBtn = document.getElementById("posCheckout");

    // 防止連續點擊
    if (checkoutBtn.disabled) return;

    const originalText = checkoutBtn.innerText;
    checkoutBtn.disabled = true;
    checkoutBtn.innerText = "結帳中...";

    // ===== 新增付款方式檢查 =====
    const paymentMethod = document.getElementById("posPayment").value;
    if (!paymentMethod) {
        alert("請先選擇付款方式！");
        checkoutBtn.innerText = originalText; // 恢復按鈕文字
        checkoutBtn.disabled = false; // 恢復按鈕可點擊
        return; // 停止結帳流程
    }

    let actual = parseNumber(document.getElementById("afterTax").innerText) - (Number(document.getElementById("discount").value) || 0);
    let min = getMinConsumeTotal();

    // 如果消費金額不足，顯示最低消費提示框
    if (actual < min && !allowMinConsumeCheckout) {
        // 顯示消費金額不足的提示框
        const message = `您的消費金額為 ${actual} 元，低於最低消費額 ${min} 元，是否確認結帳？`;
        if (confirm(message)) {
            // 用戶選擇確認結帳，即使未達最低消費，強制使用最低消費金額
            allowMinConsumeCheckout = true; // 設置允許最低消費結帳
            document.getElementById("afterTax").innerText = min; // 強制將消費金額設為最低消費金額
            startCheckoutFlow(checkoutBtn, originalText); // 直接進行結帳流程
        } else {
            // 用戶選擇取消結帳，恢復結帳按鈕
            checkoutBtn.innerText = originalText;
            checkoutBtn.disabled = false;
        }
        return; // 停止結帳流程
    }

    allowMinConsumeCheckout = false; // 預設不允許最低消費結帳

    if (posCart.length === 0) {
        alert("購物車是空的。");
        checkoutBtn.innerText = originalText; // 恢復按鈕文字
        checkoutBtn.disabled = false; // 恢復按鈕可點擊
        return;
    }

    // 如果沒有進入最低消費檢查，則直接繼續結帳流程
    startCheckoutFlow(checkoutBtn, originalText);
};

// 處理結帳流程的函式
async function startCheckoutFlow(checkoutBtn, originalText) {
    try {
        // Step 1：結帳寫入試算表
        await sendCheckoutToSheet();
        setTimeout(updateTodaySales, 0);

        // ===== 小票資料準備 =====
        const PRINTER_PROFILE = {
            "58": { charsPerLine: 32, nameWidth: 14, qtyWidth: 6, priceWidth: 6, subWidth: 6 },
            "80": { charsPerLine: 42, nameWidth: 20, qtyWidth: 6, priceWidth: 8, subWidth: 8 }
        };

        const receiptPayload = {
            storeName: "生鮮 POS",
            datetime: new Date().toLocaleString(),
            payment: document.getElementById("posPayment").value,
            openCashDrawer: true,
            items: posCart.map(item => {
                let subtotal = item.quantity * item.price;
                let discountText = "";
                let discountAmount = 0;
                if (item.discount) {
                    switch (item.discount.type) {
                        case "第二件減10":
                            discountAmount = Math.floor(item.quantity / 2) * 10;
                            subtotal -= discountAmount;
                            discountText = "第二件減10";
                            break;
                        case "買二送一":
                            discountAmount = Math.floor(item.quantity / 3) * item.price;
                            subtotal -= discountAmount;
                            discountText = "買二送一";
                            break;
                        case "買一送一":
                            discountAmount = Math.floor(item.quantity / 2) * item.price;
                            subtotal -= discountAmount;
                            discountText = "買一送一";
                            break;
                        case "第二件6折":
                            discountAmount = Math.floor(item.quantity / 2) * item.price * 0.4;
                            subtotal -= discountAmount;
                            discountText = "第二件6折";
                            break;
                        default:
                            subtotal *= item.discount.rate || 1;
                            discountAmount = item.price * item.quantity * (1 - (item.discount.rate || 1));
                            discountText = `折扣${(item.discount.rate || 1) * 100}%`;
                            break;
                    }
                }
                return { name: item.name, qty: item.quantity, price: item.price, subtotal, discountText, discountAmount };
            }),
            summary: {
                discount: document.getElementById("discount").value || 0,
                tax: document.getElementById("taxAmount")?.innerText || 0,
                total: document.getElementById("posTotal")?.innerText || 0
            }
        };

        // 開始列印流程（這部分與原來相同）
        if (window.qz) {
            setTimeout(async () => {
                try {
                    const printers = await qz.printers.find(); // 只抓一次

                    await Promise.all(
                        printers.map(async (printerName) => {
                            let selectedSize = /80/.test(printerName) ? "80" : "58";
                            const profile = PRINTER_PROFILE[selectedSize];

                            const receiptText = buildReceiptText(receiptPayload, profile);

                            const esc = [
                                '\x1B\x40',             // 初始化
                                '\x1B\x61\x01',         // 置中
                                "生鮮 POS 小票\n",
                                '\x1B\x61\x00',         // 靠左
                                receiptText + "\n",
                                '\x1B\x64\x02',         // 捲紙
                                '\x1B\x70\x00\x3C\xFF', // 開錢櫃
                                '\x1D\x56\x42\x03'      // 切紙
                            ];

                            const config = qz.configs.create(printerName);
                            await qz.print(config, [
                                { type: 'raw', format: 'command', data: esc.join('') }
                            ]);

                            console.log(`✅ 列印完成：${printerName}`);
                        })
                    );
                } catch (err) {
                    console.error("列印失敗", err);
                    alert("⚠️ 結帳成功，但列印失敗，請檢查印表機");
                }
            }, 0);
        } else if (window.webkit?.messageHandlers?.posPrint) {
            window.webkit.messageHandlers.posPrint.postMessage(receiptPayload);
        }

        // ⭐ 結帳提示（不等列印）
        alert("結帳完成，已送出列印");

        // ===== 結帳後清空所有欄位 =====
        posCart = []; // 清空購物車

        // 清空折扣
        if (document.getElementById("discount")) document.getElementById("discount").value = "";

        // 清空收現金與找零
        if (document.getElementById("cashInput")) document.getElementById("cashInput").value = "";
        if (document.getElementById("changeOut")) document.getElementById("changeOut").innerText = "0";

        // 重置人數回到1
        document.getElementById("peopleCount").value = "0";

        // ⭐ 清空存酒人員姓名與手機
        if (document.getElementById("customerName")) document.getElementById("customerName").value = "";
        if (document.getElementById("customerPhone")) document.getElementById("customerPhone").value = "";

        // ⭐⭐ 重設業代為登入預設值
        fetchSalesList(); // 不等

        // 重新渲染購物車（清空後）
        if (typeof renderCart === "function") renderCart();

        // ⭐⭐⭐ 結帳完成後，收款方式回到「現金」
        document.querySelector('#paymentButtons .payBtn[data-pay="現金"]')?.click();

        // 完成後，恢復結帳按鈕狀態
        checkoutBtn.innerText = originalText;
        checkoutBtn.disabled = false;

    } catch (error) {
        console.error("結帳過程中發生錯誤：", error);
        alert("結帳失敗，請重試。");

        // 確保按鈕在錯誤後仍然可以重新點擊
        checkoutBtn.innerText = originalText;
        checkoutBtn.disabled = false;
    }
};

  


