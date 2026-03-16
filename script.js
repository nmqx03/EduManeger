// =================================================================
// BUNDLE.JS — Toàn bộ ứng dụng gộp lại theo thứ tự đúng
// =================================================================

const { useState, useCallback, useEffect, useMemo, useRef } = React;

// ─────────────────────────────────────────────────────────────────
// UTILS — Hàm hỗ trợ & localStorage
// ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n && n !== 0) return "0";
  return Number(n).toLocaleString("vi-VN");
}

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const LS_CLASS = "diemdanh_classes_v2";
// Key mới hỗ trợ lưu theo tháng/năm: hocphi_paid_v3_{classId}_{year}_{month}
const LS_PAID_PREFIX  = "hocphi_paid_v3_";

function loadClasses() {
  try { return JSON.parse(localStorage.getItem(LS_CLASS)) || []; } catch { return []; }
}
function saveClasses(cls) {
  try { localStorage.setItem(LS_CLASS, JSON.stringify(cls)); } catch {}
}

function loadPaid(classId, year, month) {
  const key = `${LS_PAID_PREFIX}${classId}_${year}_${month}`;
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function savePaid(classId, year, month, map) {
  const key = `${LS_PAID_PREFIX}${classId}_${year}_${month}`;
  try { localStorage.setItem(key, JSON.stringify(map)); } catch {}
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTS — Các component dùng chung
// ─────────────────────────────────────────────────────────────────

// Sử dụng <use href="#icon-id" /> để tham chiếu SVG từ index.html
function Icon({ name, size = 24 }) {
    return (
        <svg width={size} height={size}>
            <use href={`#icon-${name}`} />
        </svg>
    );
}

function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function NavCard({ label, sub, icon, onClick, onEdit }) {
  return (
    <div className="nav-card" onClick={onClick}>
      <div className="nav-card-icon">{icon}</div>
      <div className="nav-card-info">
        <div className="nav-card-label">{label}</div>
        {sub && <div className="nav-card-sub">{sub}</div>}
      </div>
      {onEdit && (
        <button className="nav-card-action" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
           <Icon name="edit" size={18} />
        </button>
      )}
      <div className="nav-card-arrow">→</div>
    </div>
  );
}

function CopyIcon({ state }) {
  if (state === "copied") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <use href="#icon-check" />
    </svg>
  );
  if (state === "loading") return (
     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a0b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
     </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff77a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <use href="#icon-copy" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// RECEIPT
// ─────────────────────────────────────────────────────────────────
function ReceiptMarkup({ student, bankInfo, qrCodeUrl, id, context }) {
  const timeTitle = `Tháng ${context?.month}/${context?.year}`;
  const hasKem = student.hasKem && student.kemSessions > 0;
  
  return (
    <div className="receipt" id={id || undefined}>
      <div className="receipt-header">
        <img src="images/logo2.png" alt="Logo" className="receipt-logo"
          onError={(e) => { e.target.style.display = "none"; }} />
        <div className="receipt-addr">Số điện thoại: 0981.802.098 - Mrs.Trang</div>
        <div className="receipt-title">Thông Báo Học Phí</div>
        <div className="receipt-subtitle">{timeTitle}</div>
      </div>
      
      <div className="receipt-body-wrap">
        {/* --- Thông tin chi tiết --- */}
        <div className="receipt-info">
            {/* Hàng 1: Tên học sinh và Lớp */}
            <div className="info-item">
              <span className="info-label">Tên Học Sinh:</span>
              <span className="info-value big-name">{student.name}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Lớp:</span>
              <span className="info-value">{student.cls || "—"}</span>
            </div>
            
            {!hasKem ? (
              // --- TRƯỜNG HỢP KHÔNG HỌC KÈM ---
              <>
                 <div className="receipt-divider"></div>
                 <div className="info-item">
                   <span className="info-label">Số Buổi Học:</span>
                   <span className="info-value">{student.sessions || 0} buổi</span>
                 </div>
                 <div className="info-item">
                   <span className="info-label">Học Phí / Buổi:</span>
                   <span className="info-value">{fmt(student.pricePerSession)} đ</span>
                 </div>
              </>
            ) : (
              // --- TRƯỜNG HỢP CÓ HỌC KÈM ---
              <>
                 <div className="receipt-divider"></div>
                 {/* Học Chính */}
                 <div className="info-item">
                   <span className="info-label">Số Buổi Chính:</span>
                   <span className="info-value">{student.sessions || 0} buổi</span>
                 </div>
                 <div className="info-item">
                   <span className="info-label">Đơn Giá Chính:</span>
                   <span className="info-value">{fmt(student.pricePerSession)} đ</span>
                 </div>
                 
                 <div className="receipt-divider dashed"></div>
                 
                 {/* Học Kèm */}
                 <div className="info-item">
                   <span className="info-label">Số Buổi Kèm:</span>
                   <span className="info-value">{student.kemSessions || 0} buổi</span>
                 </div>
                 <div className="info-item">
                   <span className="info-label">Đơn Giá Kèm:</span>
                   <span className="info-value">{fmt(student.kemPrice)} đ</span>
                 </div>
              </>
            )}
        </div>

        {/* --- Phần Tổng Tiền --- */}
        <div className="receipt-total-section">
            {hasKem && (
              <>
                <div className="sub-total-row">
                    <span>Học phí chính:</span>
                    <span>{fmt(student.baseFee)} VND</span>
                </div>
                <div className="sub-total-row">
                    <span>Học phí kèm:</span>
                    <span>{fmt(student.kemFee)} VND</span>
                </div>
                <div className="receipt-divider"></div>
              </>
            )}
            
            <div className="receipt-total-row">
              <div className="receipt-total-label">TỔNG HỌC PHÍ</div>
              <div className="receipt-total-value">{fmt(student.fee)} VND</div>
            </div>
        </div>

        {/* --- Bank & QR --- */}
        {bankInfo && (
            <div className="receipt-bank">
            <div className="receipt-bank-title">Thông tin thanh toán</div>
            <div className="receipt-bank-row"><span>Ngân hàng</span><span>{bankInfo.bank || "—"}</span></div>
            <div className="receipt-bank-row"><span>Số TK</span><span>{bankInfo.account || "—"}</span></div>
            <div className="receipt-bank-row"><span>Chủ TK</span><span>{bankInfo.owner || "—"}</span></div>
            </div>
        )}
        
        {qrCodeUrl && (
            <div className="receipt-qr">
            <img src={qrCodeUrl} alt="QR Code" className="receipt-qr-image"
                onError={(e) => { e.target.style.display = "none"; }} />
            </div>
        )}
      </div>

      <div className="receipt-footer">Cảm ơn quý phụ huynh!</div>
    </div>
  );
}

function renderReceiptToCanvas(student, bankInfo, qrCodeUrl, context) {
  return new Promise((resolve, reject) => {
    // 1. Tạo container ẩn
    const wrap = document.createElement("div");
    // Đặt ở vị trí cố định nhưng ngoài màn hình
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:1080px;pointer-events:none;z-index:-1;";
    document.body.appendChild(wrap);
    
    // 2. Render React Component vào container
    const tmpRoot = ReactDOM.createRoot(wrap);
    tmpRoot.render(React.createElement(ReceiptMarkup, { student, bankInfo, qrCodeUrl, context }));

    // 3. Chờ DOM cập nhật
    const capture = () => {
      const el = wrap.querySelector(".receipt");
      if (!el) { cleanup(); reject(new Error("Receipt not found")); return; }
      
      // html2canvas config tối ưu hơn chút
      window.html2canvas(el, { 
          scale: 2, // Giữ nguyên chất lượng 2x
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: "#fff", 
          logging: false // Tắt log để nhanh hơn chút
      })
        .then(canvas => { cleanup(); resolve(canvas); })
        .catch(err  => { cleanup(); reject(err); });
    };

    const cleanup = () => { tmpRoot.unmount(); document.body.removeChild(wrap); };
    
    // Đợi 1 tick để React render xong, sau đó đợi thêm chút để ảnh load (nếu cần)
    setTimeout(() => { requestAnimationFrame(() => setTimeout(capture, 100)); }, 200);
  });
}

// ─────────────────────────────────────────────────────────────────
// DATA MANAGEMENT PAGE (IMPORT/EXPORT)
// ─────────────────────────────────────────────────────────────────

function DataPage({ classes, setClasses }) {
    const [tab, setTab] = useState("export"); // 'export' | 'import'
    
    // Export State
    const [exportClassId, setExportClassId] = useState("");
    const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
    const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);

    // Import State
    const [importStep, setImportStep] = useState(0); // 0: Select Class, 1: Upload, 2: Map, 3: Success
    const [targetClassId, setTargetClassId] = useState("new");
    const [newClassName, setNewClassName] = useState("");
    const [wb, setWb] = useState(null);
    const [sheetName, setSheetName] = useState("");
    
    // Mapping config - Simplified
    const [config, setConfig] = useState({
        nameRange: "B5:B30",
        priceRange: "C5:C30",
    });

    const handleExport = () => {
        if (!exportClassId) { alert("Vui lòng chọn lớp!"); return; }
        const cls = classes.find(c => c.id === exportClassId);
        if (!cls) return;

        const y = parseInt(exportYear);
        const m = parseInt(exportMonth);

        // Header Structure based on request
        const header = [
            "STT", "Họ Tên", "Lớp", 
            ...Array.from({length: 31}, (_, i) => i + 1), // Columns 1-31
            "Số buổi Chính", "HP Chính/Buổi", "Tiền Học Chính", // Main Summary
            "Số buổi Kèm", "HP Kèm/Buổi", "Tiền Học Kèm",       // Kem Summary
            "TỔNG HỌC PHÍ", "Trạng Thái", "Ghi Chú"             // Grand Total
        ];
        
        const rows = [header];

        // Filter sessions for the selected Month/Year
        const monthlySessions = (cls.sessions || []).filter(s => {
             if (!s.date) return false;
             const d = new Date(s.date);
             return d.getFullYear() === y && (d.getMonth() + 1) === m;
        });

        // Map day -> session for grid filling
        const sessionMap = {}; 
        monthlySessions.forEach(ses => {
            const d = new Date(ses.date).getDate();
            sessionMap[d] = ses; 
        });

        // Load Paid Data
        const paidData = loadPaid(cls.id, exportYear, exportMonth);

        // Build Rows
        (cls.students || []).forEach((s, idx) => {
            const row = [];
            row.push(idx + 1); // STT
            row.push(s.name); // Họ Tên
            row.push(cls.name); // Lớp

            let countMain = 0;
            let countKem = 0;

            // Fill days 1 to 31
            for (let day = 1; day <= 31; day++) {
                const ses = sessionMap[day];
                if (ses) {
                    const isMain = (ses.attendance || []).includes(s.id);
                    const isKem = (ses.attendanceKem || []).includes(s.id);
                    
                    if (isMain) {
                        row.push("x");
                        countMain++;
                    } else if (isKem) {
                        row.push("k");
                        countKem++;
                    } else {
                        row.push("");
                    }
                } else {
                    row.push("");
                }
            }

            // --- MAIN STATS ---
            const priceMain = s.pricePerSession || 0;
            const totalMain = countMain * priceMain;
            row.push(countMain);
            row.push(priceMain);
            row.push(totalMain);

            // --- KEM STATS ---
            const priceKem = s.kemPrice || 0;
            const totalKem = countKem * priceKem;
            row.push(countKem);
            row.push(priceKem);
            row.push(totalKem);

            // --- TOTAL ---
            row.push(totalMain + totalKem);
            row.push(paidData[s.id] ? "Đã thu" : "Chưa thu"); // Trạng Thái
            row.push(""); // Ghi Chú

            rows.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // Optional: Set column widths
        const wscols = [
            {wch: 5}, {wch: 25}, {wch: 10}, // Info
            ...Array(31).fill({wch: 3}),    // Days
            {wch: 12}, {wch: 15}, {wch: 15}, // Main
            {wch: 12}, {wch: 15}, {wch: 15}, // Kem
            {wch: 15}, {wch: 15}, {wch: 20}  // Total
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `T${m}-${y}`);
        XLSX.writeFile(wb, `HocPhi_${cls.name}_T${m}_${y}.xlsx`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                setWb(workbook);
                setSheetName(workbook.SheetNames[0]);
                setImportStep(2);
            } catch (err) {
                alert("Lỗi đọc file Excel: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Helper to decode range string (e.g., "A1:B2") into indices
    const decodeRange = (rangeStr) => {
        try {
            const range = XLSX.utils.decode_range(rangeStr);
            return range;
        } catch { return null; }
    };

    const getCellValue = (ws, r, c) => {
        const cell = ws[XLSX.utils.encode_cell({r, c})];
        return cell ? cell.v : undefined;
    };

    const handleProcessImport = () => {
        if (!wb) return;
        const ws = wb.Sheets[sheetName];
        if (!ws) return;

        const rName = decodeRange(config.nameRange);
        if (!rName) { alert("Vùng họ tên không hợp lệ"); return; }
        
        const rPrice = config.priceRange ? decodeRange(config.priceRange) : null;
        
        const newStudents = [];

        for (let r = rName.s.r; r <= rName.e.r; r++) {
            const c = rName.s.c; 
            const nameVal = getCellValue(ws, r, c);
            if (nameVal) {
                const sid = Date.now().toString() + Math.random().toString().slice(2,5);
                let price = 0;
                if (rPrice && r >= rPrice.s.r && r <= rPrice.e.r) {
                    const pVal = getCellValue(ws, r, rPrice.s.c);
                    if (pVal) price = parseInt(String(pVal).replace(/\D/g, "")) || 0;
                }
                newStudents.push({
                    id: sid,
                    name: String(nameVal).trim(),
                    pricePerSession: price,
                    hasKem: false,
                    kemPrice: 0,
                    days: []
                });
            }
        }

        if (newStudents.length === 0) { alert("Không tìm thấy học sinh nào trong vùng đã chọn."); return; }

        let updatedClasses;
        let finalClassName = "";

        if (targetClassId === "new") {
            if (!newClassName.trim()) { alert("Vui lòng nhập tên lớp mới"); return; }
            finalClassName = newClassName.trim();
            const newClass = {
                id: Date.now().toString(),
                name: finalClassName,
                students: newStudents,
                sessions: [] 
            };
            updatedClasses = [...classes, newClass];
        } else {
            updatedClasses = classes.map(cls => {
                if (cls.id !== targetClassId) return cls;
                finalClassName = cls.name;
                const mergedStudents = [...(cls.students || []), ...newStudents];
                return { ...cls, students: mergedStudents };
            });
        }

        setClasses(updatedClasses);
        saveClasses(updatedClasses);
        alert(`Đã nhập thành công ${newStudents.length} học sinh vào lớp "${finalClassName}"!`);
        setImportStep(0);
        setWb(null);
    };

    return (
        <div className="page-content">
             <div className="page-topbar">
                 <div className="page-topbar-title">Quản Lý Dữ Liệu</div>
             </div>

             <div className="data-tabs">
                 <button className={`data-tab-btn ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>
                    <Icon name="download" /> Xuất Excel
                 </button>
                 <button className={`data-tab-btn ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
                    <Icon name="upload" /> Nhập Excel
                 </button>
             </div>

             {tab === 'export' && (
                 <div className="data-container">
                     <div className="form-card">
                         <h3>Xuất dữ liệu lớp học</h3>
                         <p style={{color:'#6b7280', fontSize:14, marginBottom:16}}>Chọn lớp và tháng để xuất bảng điểm danh chi tiết.</p>
                         
                         <label className="form-label">Chọn lớp</label>
                         <select className="form-input" value={exportClassId} onChange={e => setExportClassId(e.target.value)}>
                             <option value="">-- Chọn lớp --</option>
                             {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>

                         <div className="form-grid-2" style={{marginTop: 15}}>
                             <div>
                                <label className="form-label">Tháng</label>
                                <select className="form-input" value={exportMonth} onChange={e => setExportMonth(e.target.value)}>
                                    {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="form-label">Năm</label>
                                <select className="form-input" value={exportYear} onChange={e => setExportYear(e.target.value)}>
                                    {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                             </div>
                         </div>

                         <button className="btn-save" style={{marginTop: 20, width: '100%', height: 44, fontSize: 15}} onClick={handleExport}>
                             Tải xuống (.xlsx)
                         </button>
                     </div>
                 </div>
             )}

             {tab === 'import' && (
                 <div className="data-container">
                     {importStep === 0 && (
                         <div className="form-card">
                            <h3>Bước 1: Chọn nơi lưu dữ liệu</h3>
                            <label className="form-label">Nhập vào lớp</label>
                            <select className="form-input" value={targetClassId} onChange={e => setTargetClassId(e.target.value)}>
                                <option value="new">+ Tạo lớp mới</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            
                            {targetClassId === "new" && (
                                <div style={{marginTop: 10}}>
                                    <label className="form-label">Tên lớp mới</label>
                                    <input className="form-input" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="VD: Toán 9A" />
                                </div>
                            )}

                            <button className="btn-save" style={{marginTop: 20, width: '100%'}} onClick={() => {
                                if (targetClassId === 'new' && !newClassName) { alert("Nhập tên lớp!"); return; }
                                setImportStep(1);
                            }}>Tiếp tục</button>
                         </div>
                     )}

                     {importStep === 1 && (
                         <div className="form-card">
                             <h3>Bước 2: Chọn file Excel</h3>
                             <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="form-input" style={{padding: 10}} />
                             <button className="btn-back" style={{marginTop: 10}} onClick={() => setImportStep(0)}>Quay lại</button>
                         </div>
                     )}

                     {importStep === 2 && (
                         <div className="form-card" style={{maxWidth: 600}}>
                             <h3>Bước 3: Cấu hình vùng dữ liệu</h3>
                             <p style={{fontSize:13, color:'#6b7280', marginBottom:15}}>Nhập toạ độ vùng (VD: B5:B20) trong Sheet: <b>{sheetName}</b></p>

                             <div className="form-grid-2">
                                <div>
                                    <label className="form-label">Vùng Họ Tên (Bắt buộc)</label>
                                    <input className="form-input" value={config.nameRange} onChange={e => setConfig({...config, nameRange: e.target.value})} placeholder="VD: B5:B30" />
                                </div>
                                <div>
                                    <label className="form-label">Vùng Học Phí (Tuỳ chọn)</label>
                                    <input className="form-input" value={config.priceRange} onChange={e => setConfig({...config, priceRange: e.target.value})} placeholder="VD: C5:C30" />
                                </div>
                             </div>
                             
                             <div className="help-text" style={{marginTop: 10, fontSize: 12, color: '#6b7280', fontStyle:'italic'}}>
                                * Vùng học phí nên tương ứng số dòng với vùng họ tên. Nếu để trống học phí sẽ là 0.
                             </div>

                             <div style={{display:'flex', gap:10, marginTop:20}}>
                                <button className="btn-back" onClick={() => { setWb(null); setImportStep(1); }}>Chọn file khác</button>
                                <button className="btn-save" style={{flex:1}} onClick={handleProcessImport}>Xử lý & Nhập</button>
                             </div>
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// HOMEPAGE
// ─────────────────────────────────────────────────────────────────

function HomePage({ onNavigate }) {
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero-icon">
          <img src="images/logo2.png" alt="Logo" style={{ maxWidth: 240, height: "auto" }} onError={(e) => { e.target.style.display = "none"; }} />
        </div>
        <h1 className="home-title">Quản Lý Lớp Học</h1>
        <p className="home-sub">Điểm danh học sinh & tạo phiếu thông báo học phí tự động</p>
      </div>
      <div className="home-cards">
        <button className="home-card" onClick={() => onNavigate("attendance")}>
          <div className="home-card-icon hc-blue"><Icon name="notebook" size={32} /></div>
          <div className="home-card-body">
            <div className="home-card-title">Điểm Danh</div>
            <div className="home-card-desc">Quản lý lớp, điểm danh theo buổi</div>
          </div>
          <div className="home-card-arrow">→</div>
        </button>
        <button className="home-card" onClick={() => onNavigate("tuition")}>
          <div className="home-card-icon hc-pink"><Icon name="money" size={32} /></div>
          <div className="home-card-body">
            <div className="home-card-title">Học Phí</div>
            <div className="home-card-desc">Tính học phí theo tháng, năm</div>
          </div>
          <div className="home-card-arrow">→</div>
        </button>
        <button className="home-card" onClick={() => onNavigate("students")}>
          <div className="home-card-icon hc-purple"><Icon name="users" size={32} /></div>
          <div className="home-card-body">
            <div className="home-card-title">Danh sách học sinh</div>
            <div className="home-card-desc">Quản lý danh sách học sinh theo lớp</div>
          </div>
          <div className="home-card-arrow">→</div>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ATTENDANCE PAGE
// ─────────────────────────────────────────────────────────────────

function AttendancePage({ classes, setClasses }) {
  // Navigation State
  const [step, setStep] = useState(0); // 0: Class, 1: Year, 2: Month, 3: SessionList, 4: SessionDetail
  const [selClassId, setSelClassId] = useState(null);
  const [selYear, setSelYear] = useState(null);
  const [selMonth, setSelMonth] = useState(null);
  const [selSessionId, setSelSessionId] = useState(null);

  // Modal States
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null); // If set, we are editing
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  // Helpers
  const activeClass = useMemo(() => classes.find(c => c.id === selClassId), [classes, selClassId]);
  
  const availableYears = useMemo(() => {
    if (!activeClass || !activeClass.sessions) return [];
    const s = new Set();
    activeClass.sessions.forEach(ses => { if (ses.date) s.add(ses.date.slice(0, 4)); });
    if (s.size === 0) s.add(new Date().getFullYear().toString());
    return [...s].sort().reverse();
  }, [activeClass]);

  const availableMonths = useMemo(() => {
    if (!activeClass || !selYear || !activeClass.sessions) return [];
    const s = new Set();
    activeClass.sessions.forEach(ses => {
      if (ses.date && ses.date.startsWith(selYear)) s.add(parseInt(ses.date.slice(5, 7)));
    });
    // Sort descending (Newest first)
    return [...s].sort((a, b) => b - a);
  }, [activeClass, selYear]);

  // Sort Sessions: Newest first
  const filteredSessions = useMemo(() => {
    if (!activeClass || !selYear || !selMonth || !activeClass.sessions) return [];
    return activeClass.sessions.filter(ses => {
      if (!ses.date) return false;
      const [y, m] = ses.date.split("-");
      return y === selYear && parseInt(m) === selMonth;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [activeClass, selYear, selMonth]);

  const activeSession = useMemo(() => activeClass?.sessions?.find(s => s.id === selSessionId), [activeClass, selSessionId]);

  // Actions
  const openAddSession = () => {
    setEditingSessionId(null);
    setNewSessionDate(new Date().toISOString().slice(0, 10));
    setShowAddSession(true);
  };

  const openEditSession = (session) => {
    setEditingSessionId(session.id);
    setNewSessionDate(session.date);
    setShowAddSession(true);
  };

  const saveSession = () => {
    if (!newSessionDate) return;

    let updated;
    if (editingSessionId) {
        // Edit Mode
        updated = classes.map(c => {
            if (c.id !== selClassId) return c;
            return {
                ...c,
                sessions: c.sessions.map(s => s.id === editingSessionId ? { ...s, date: newSessionDate } : s)
            };
        });
    } else {
        // Add Mode
        const session = { id: Date.now().toString(), date: newSessionDate, attendance: [], attendanceKem: [] };
        updated = classes.map(c => c.id === selClassId ? { ...c, sessions: [...c.sessions, session] } : c);
    }
    
    setClasses(updated); saveClasses(updated); setShowAddSession(false);
  };

  const toggleAttendance = (studentId, type) => {
    // type: 'main' or 'kem'
    const updated = classes.map(c => {
      if (c.id !== selClassId) return c;
      return {
        ...c,
        sessions: c.sessions.map(ses => {
          if (ses.id !== selSessionId) return ses;
          let att = ses.attendance || [];
          let attKem = ses.attendanceKem || [];
          
          if (type === 'main') {
            if (att.includes(studentId)) {
              att = att.filter(id => id !== studentId); // toggle off
            } else {
              att = [...att, studentId]; // toggle on
              attKem = attKem.filter(id => id !== studentId); // exclusive
            }
          } else if (type === 'kem') {
            if (attKem.includes(studentId)) {
              attKem = attKem.filter(id => id !== studentId); // toggle off
            } else {
              attKem = [...attKem, studentId]; // toggle on
              att = att.filter(id => id !== studentId); // exclusive
            }
          }
          return { ...ses, attendance: att, attendanceKem: attKem };
        })
      };
    });
    setClasses(updated); saveClasses(updated);
  };

  const getMonthlyStats = (studentId) => {
    if (!activeClass || !selYear || !selMonth) return { main: 0, kem: 0, total: 0 };
    const monthSessions = (activeClass.sessions || []).filter(ses => {
        if (!ses.date) return false;
        const [y, m] = ses.date.split("-");
        return y === selYear && parseInt(m) === selMonth;
    });
    let main = 0, kem = 0;
    monthSessions.forEach(ses => {
        if ((ses.attendance || []).includes(studentId)) main++;
        if ((ses.attendanceKem || []).includes(studentId)) kem++;
    });
    return { main, kem, total: main + kem };
  };

  // Shared Session Modal (Add & Edit)
  const sessionModal = showAddSession && (
    <div className="modal-overlay" onClick={() => setShowAddSession(false)}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-dialog-header">{editingSessionId ? "Sửa buổi học" : "Thêm buổi học"}</div>
        <div className="modal-dialog-body">
          <label className="form-label">Ngày học</label>
          <input className="form-input" type="date" value={newSessionDate} onChange={e => setNewSessionDate(e.target.value)} onKeyDown={e => e.key === "Enter" && saveSession()} />
        </div>
        <div className="modal-dialog-footer">
          <button className="btn-cancel" onClick={() => setShowAddSession(false)}>Huỷ</button>
          <button className="btn-save" onClick={saveSession}>{editingSessionId ? "Lưu" : "Thêm"}</button>
        </div>
      </div>
    </div>
  );

  // ── RENDER ──

  // VIEW 0: LIST CLASSES (No "Add Class" here anymore)
  if (step === 0) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <div className="page-topbar-title">Chọn Lớp Để Điểm Danh</div>
        </div>
        <div className="nav-grid">
          {classes.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏫</div><div>Chưa có lớp nào</div></div> : null}
          {classes.map(c => (
            <NavCard key={c.id} label={c.name} sub={`${(c.students || []).length} học sinh`} 
              icon={<Icon name="school" />} onClick={() => { setSelClassId(c.id); setStep(1); }} />
          ))}
        </div>
      </div>
    );
  }

  // VIEW 1: SELECT YEAR
  if (step === 1) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(0)}>‹ Chọn lại lớp</button>
          <div className="page-topbar-title">{activeClass?.name} - Chọn Năm</div>
          <button className="btn-add-primary" onClick={openAddSession}>+ Thêm buổi</button>
        </div>
        <div className="nav-grid">
          {availableYears.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📅</div><div>Chưa có dữ liệu năm</div></div> : null}
          {availableYears.map(y => (
            <NavCard key={y} label={`Năm ${y}`} icon={<Icon name="calendar" />} onClick={() => { setSelYear(y); setStep(2); }} />
          ))}
        </div>
        {sessionModal}
      </div>
    );
  }

  // VIEW 2: SELECT MONTH (Added Add Session Button)
  if (step === 2) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(1)}>‹ Chọn lại năm</button>
          <div className="page-topbar-title">Năm {selYear} - Chọn Tháng</div>
          <button className="btn-add-primary" onClick={openAddSession}>+ Thêm buổi</button>
        </div>
        <div className="nav-grid">
          {availableMonths.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🗓️</div><div>Năm này chưa có buổi học nào</div></div> : null}
          {availableMonths.map(m => (
            <NavCard key={m} label={`Tháng ${m}`} icon={<Icon name="month" />} onClick={() => { setSelMonth(m); setStep(3); }} />
          ))}
        </div>
        {sessionModal}
      </div>
    );
  }

  // VIEW 3: SELECT SESSION (Added Add Session Button & Edit Feature)
  if (step === 3) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(2)}>‹ Chọn lại tháng</button>
          <div className="page-topbar-title">Tháng {selMonth}/{selYear} - Chọn Buổi</div>
          <button className="btn-add-primary" onClick={openAddSession}>+ Thêm buổi</button>
        </div>
        <div className="nav-grid">
          {filteredSessions.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📅</div><div>Chưa có buổi học nào</div></div> : null}
          {filteredSessions.map((ses, idx) => {
             const presentCount = (ses.attendance?.length || 0) + (ses.attendanceKem?.length || 0);
             return (
              <NavCard 
                key={ses.id} 
                label={fmtDate(ses.date)} 
                sub={`${presentCount}/${(activeClass.students || []).length} có mặt`}
                icon={<Icon name="att" />} 
                onClick={() => { setSelSessionId(ses.id); setStep(4); }}
                onEdit={() => openEditSession(ses)}
              />
             );
          })}
        </div>
        {sessionModal}
      </div>
    );
  }

  // VIEW 4: MARKING ATTENDANCE (TABLE)
  if (step === 4) {
    if (!activeSession) return <div className="page-content"><div className="empty-state">Không tìm thấy buổi học</div><button className="btn-back" onClick={() => setStep(3)}>Quay lại</button></div>;
    
    const totalStudents = (activeClass.students || []).length;
    const presentMain = activeSession.attendance?.length || 0;
    const presentKem = activeSession.attendanceKem?.length || 0;
    const totalPresent = presentMain + presentKem;
    const totalAbsent = totalStudents - totalPresent;

    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(3)}>‹ Chọn lại buổi</button>
          <div className="page-topbar-title">Điểm Danh Ngày {fmtDate(activeSession.date)}</div>
        </div>

        {/* Start Cards */}
        <div className="stats-grid">
          <StatCard iconBg="rgba(139,92,246,0.1)" icon={<Icon name="users" size={20} />} label="Tổng sĩ số" value={totalStudents} sub="Học sinh" />
          <StatCard iconBg="rgba(22,163,74,0.1)" icon={<Icon name="check" size={20} />} label="Có mặt" value={totalPresent} sub="Học sinh" />
          <StatCard iconBg="rgba(239,68,68,0.1)" icon="❌" label="Vắng mặt" value={totalAbsent} sub="Học sinh" />
        </div>

        {/* Table */}
        <div className="table-section">
          <div className="table-header-row">
            <div className="table-title">Danh sách học sinh</div>
          </div>
          <div className="table-wrap">
            <table className="students-table">
              <thead>
                <tr>
                  <th className="center">STT</th>
                  <th>HỌ VÀ TÊN</th>
                  <th className="center">TRẠNG THÁI</th>
                  <th className="center">CHÍNH / THÁNG</th>
                  <th className="center">KÈM / THÁNG</th>
                  <th className="center">TỔNG / THÁNG</th>
                </tr>
              </thead>
              <tbody>
                {activeClass.students.map((s, i) => {
                  const isMain = (activeSession.attendance || []).includes(s.id);
                  const isKem = (activeSession.attendanceKem || []).includes(s.id);
                  const stats = getMonthlyStats(s.id);
                  return (
                    <tr key={s.id} className="student-row" style={{cursor: 'default'}}>
                      <td className="center stt-cell">{i + 1}</td>
                      <td className="name-cell">{s.name}</td>
                      <td className="center" onClick={e => e.stopPropagation()}>
                        <div className="att-toggle-group">
                          <button className={`att-toggle-btn ${!isMain && !isKem ? "active absent" : ""}`}
                            onClick={() => {
                                // If currently Main or Kem, we toggle off.
                                if (isMain) toggleAttendance(s.id, 'main');
                                if (isKem) toggleAttendance(s.id, 'kem');
                            }}>Vắng</button>
                          <button className={`att-toggle-btn ${isMain ? "active present" : ""}`}
                            onClick={() => toggleAttendance(s.id, 'main')}>Có mặt</button>
                          {s.hasKem && (
                            <button className={`att-toggle-btn ${isKem ? "active kem" : ""}`}
                              onClick={() => toggleAttendance(s.id, 'kem')}>Kèm</button>
                          )}
                        </div>
                      </td>
                      <td className="center">{stats.main}</td>
                      <td className="center">{stats.kem}</td>
                      <td className="center bold">{stats.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// TUITION PAGE
// ─────────────────────────────────────────────────────────────────

function TuitionPage({ classes }) {
  // Navigation State
  const [step, setStep] = useState(0); // 0: Year, 1: Month, 2: Class, 3: Table
  const [selYear, setSelYear] = useState(null);
  const [selMonth, setSelMonth] = useState(null);
  const [selClassId, setSelClassId] = useState(null);

  // States
  const [paidStudents, setPaidStudents] = useState({});
  const [selected, setSelected] = useState(null); // for receipt preview
  const [preview, setPreview] = useState(false);
  const [copyState, setCopyState] = useState({});
  const [toast, setToast] = useState(null);

  // Filters & ZIP
  const [filter, setFilter] = useState("all"); // 'all', 'paid', 'unpaid'
  const [isZipping, setIsZipping] = useState(false);

  const bankInfo = { bank: "Vietinbank", account: "0981802098", owner: "HOANG THU TRANG" };
  const qrCodeUrl = "images/qr1.png";

  const availableYears = useMemo(() => {
    const s = new Set();
    classes.forEach(c => (c.sessions || []).forEach(ses => { if (ses.date) s.add(ses.date.slice(0, 4)); }));
    if (s.size === 0) s.add(new Date().getFullYear().toString());
    return [...s].sort().reverse();
  }, [classes]);

  // Logic: Only show months that have data across any class for the selected year
  // AND Sort descending (Newest first)
  const availableMonths = useMemo(() => {
    if (!selYear) return [];
    const s = new Set();
    classes.forEach(c => {
        (c.sessions || []).forEach(ses => {
            if (ses.date && ses.date.startsWith(selYear)) {
                s.add(parseInt(ses.date.split("-")[1]));
            }
        });
    });
    return [...s].sort((a, b) => b - a);
  }, [classes, selYear]);

  const activeClass = useMemo(() => classes.find(c => c.id === selClassId), [classes, selClassId]);

  // Load/Save Paid Status
  useEffect(() => {
    if (selClassId && selYear && selMonth) {
      setPaidStudents(loadPaid(selClassId, selYear, selMonth));
    }
  }, [selClassId, selYear, selMonth]);

  useEffect(() => {
    if (selClassId && selYear && selMonth) {
      savePaid(selClassId, selYear, selMonth, paidStudents);
    }
  }, [paidStudents]);

  // Calculations
  const students = useMemo(() => {
    if (!activeClass || !selYear || !selMonth) return [];
    
    // Filter sessions for the selected Year/Month
    const validSessions = (activeClass.sessions || []).filter(ses => {
      if (!ses.date) return false;
      const [y, m] = ses.date.split("-");
      return y === selYear && parseInt(m) === selMonth;
    });

    return (activeClass.students || []).map((s, idx) => {
      const sessions = validSessions.filter(ses => (ses.attendance || []).includes(s.id)).length;
      const kemSessions = s.hasKem ? validSessions.filter(ses => (ses.attendanceKem || []).includes(s.id)).length : 0;
      const baseFee = sessions * (s.pricePerSession || 0);
      const kemFee = kemSessions * (s.kemPrice || 0);
      return {
        ...s,
        stt: idx + 1,
        cls: activeClass.name,
        sessions,
        pricePerSession: s.pricePerSession || 0,
        baseFee,
        kemSessions,
        kemFee,
        fee: baseFee + kemFee
      };
    });
  }, [activeClass, selYear, selMonth]);

  const paidList = useMemo(() => students.filter(s => paidStudents[s.id]), [students, paidStudents]);
  const unpaidList = useMemo(() => students.filter(s => !paidStudents[s.id]), [students, paidStudents]);

  // Apply Filter
  const filteredStudents = useMemo(() => {
      if (filter === "paid") return paidList;
      if (filter === "unpaid") return unpaidList;
      return students;
  }, [filter, students, paidList, unpaidList]);
  
  const totalFee = students.reduce((a, s) => a + s.fee, 0);
  const collectedFee = paidList.reduce((a, s) => a + s.fee, 0);
  const uncollectedFee = unpaidList.reduce((a, s) => a + s.fee, 0);

  const togglePaid = (id) => {
    setPaidStudents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyOneRow = (e, student) => {
    e.stopPropagation();
    const key = student.id;
    if (copyState[key] === "loading") return;

    // Set loading immediately
    setCopyState(prev => ({ ...prev, [key]: "loading" }));

    // Defer processing to next tick so UI updates first
    setTimeout(async () => {
        try {
            const context = { year: selYear, month: selMonth };
            const canvas = await renderReceiptToCanvas(student, bankInfo, qrCodeUrl, context);
            canvas.toBlob(async (blob) => {
                await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
                setCopyState(prev => ({ ...prev, [key]: "copied" }));
                setTimeout(() => setCopyState(prev => ({ ...prev, [key]: "idle" })), 2000);
            }, "image/png");
        } catch {
            setCopyState(prev => ({ ...prev, [key]: "idle" }));
            alert("Không thể copy ảnh.");
        }
    }, 10);
  };

  const downloadReceipt = async () => {
      if (!selected) return;
      const context = { year: selYear, month: selMonth };
      const canvas = await renderReceiptToCanvas(selected, bankInfo, qrCodeUrl, context);
      const link = document.createElement('a');
      link.download = `HocPhi_${selected.name}_${selMonth}_${selYear}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
  };

  const downloadZip = async (list, prefix) => {
    if (!list || list.length === 0) {
        alert("Danh sách trống!");
        return;
    }
    if (!window.JSZip) {
        alert("Thư viện JSZip chưa tải xong, vui lòng thử lại sau giây lát.");
        return;
    }
    
    setIsZipping(true);
    const zip = new JSZip();
    const folder = zip.folder(`PhieuHocPhi_${prefix}_T${selMonth}_${selYear}`);
    
    // Process sequentially to avoid browser crash
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        try {
            const context = { year: selYear, month: selMonth };
            const canvas = await renderReceiptToCanvas(s, bankInfo, qrCodeUrl, context);
            
            // Canvas to Blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
            folder.file(`${s.name}.png`, blob);
        } catch (e) {
            console.error("Error generating receipt for", s.name, e);
        }
    }
    
    zip.generateAsync({ type: "blob" }).then(content => {
        if (window.saveAs) {
            window.saveAs(content, `HocPhi_${prefix}_T${selMonth}_${selYear}.zip`);
        } else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = `HocPhi_${prefix}_T${selMonth}_${selYear}.zip`;
            a.click();
        }
        setIsZipping(false);
    });
  };

  const PINK   = "rgba(255,119,160,0.12)";
  const GREEN  = "rgba(22,163,74,0.1)";
  const RED    = "rgba(239,68,68,0.1)";
  const PURPLE = "rgba(139,92,246,0.1)";

  // RENDER

  // VIEW 0: YEAR
  if (step === 0) {
    return (
      <div className="page-content">
        <div className="page-topbar"><div className="page-topbar-title">Học Phí - Chọn Năm</div></div>
        <div className="nav-grid">
          {availableYears.map(y => (
            <NavCard key={y} label={`Năm ${y}`} icon={<Icon name="calendar" />} onClick={() => { setSelYear(y); setStep(1); }} />
          ))}
        </div>
      </div>
    );
  }

  // VIEW 1: MONTH
  if (step === 1) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(0)}>‹ Chọn lại năm</button>
          <div className="page-topbar-title">Năm {selYear} - Chọn Tháng</div>
        </div>
        <div className="nav-grid">
          {availableMonths.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🗓️</div><div>Chưa có dữ liệu cho năm này</div></div> : null}
          {availableMonths.map(m => (
            <NavCard key={m} label={`Tháng ${m}`} icon={<Icon name="month" />} onClick={() => { setSelMonth(m); setStep(2); }} />
          ))}
        </div>
      </div>
    );
  }

  // VIEW 2: CLASS
  if (step === 2) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(1)}>‹ Chọn lại tháng</button>
          <div className="page-topbar-title">T{selMonth}/{selYear} - Chọn Lớp</div>
        </div>
        <div className="nav-grid">
          {classes.map(c => (
            <NavCard key={c.id} label={c.name} sub={`${(c.students || []).length} học sinh`} icon={<Icon name="school" />} 
              onClick={() => { setSelClassId(c.id); setStep(3); }} />
          ))}
        </div>
      </div>
    );
  }

  // VIEW 3: TABLE
  if (step === 3 && activeClass) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(2)}>‹ Chọn lại lớp</button>
          <div className="page-topbar-title">Học Phí - {activeClass.name} (T{selMonth}/{selYear})</div>
        </div>

        <div className="stats-grid">
          <StatCard iconBg={PINK} icon={<Icon name="money" />}
            label="Tổng cần thu" value={`${fmt(totalFee)} đ`} sub={`${students.length} học sinh`} />
          <StatCard iconBg={GREEN} icon={<Icon name="check" />}
            label="Đã thu được" value={`${fmt(collectedFee)} đ`} sub={`${paidList.length} học sinh`} />
          <StatCard iconBg={RED} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Chưa thu" value={`${fmt(uncollectedFee)} đ`} sub={`${unpaidList.length} học sinh`} />
          <StatCard iconBg={PURPLE} icon={<Icon name="users" />}
            label="Sĩ số lớp" value={students.length} sub="Học sinh" />
        </div>

        {/* --- Toolbar: Filter & Download --- */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px 16px', flexWrap: 'wrap', gap: 10}}>
            <div style={{display:'flex', gap: 10, alignItems: 'center'}}>
                <span style={{fontSize: 13, fontWeight: 600, color: '#6b7280'}}>Lọc trạng thái:</span>
                <select className="form-input" style={{width: 140}} value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="all">Tất cả</option>
                    <option value="paid">Đã đóng</option>
                    <option value="unpaid">Chưa đóng</option>
                </select>
            </div>
            
            <div style={{display:'flex', gap: 8}}>
                <button className="btn-back" style={{fontSize: 12}} onClick={() => downloadZip(students, 'TatCa')} disabled={isZipping}>
                    📦 Tải ZIP Tất Cả
                </button>
                <button className="btn-back" style={{fontSize: 12}} onClick={() => downloadZip(unpaidList, 'ChuaDong')} disabled={isZipping}>
                    📦 Tải ZIP Chưa Đóng
                </button>
                <button className="btn-back" style={{fontSize: 12}} onClick={() => downloadZip(paidList, 'DaDong')} disabled={isZipping}>
                    📦 Tải ZIP Đã Đóng
                </button>
            </div>
        </div>

        <div className="table-section">
          <div className="table-header-row">
            <div className="table-title">Danh sách học phí ({filteredStudents.length})</div>
          </div>
          <div className="table-wrap">
            <table className="students-table">
              <thead>
                <tr>
                  <th className="center">STT</th>
                  <th className="center">TRẠNG THÁI</th>
                  <th>HỌ VÀ TÊN</th>
                  <th className="center">SỐ BUỔI<br/>CHÍNH</th>
                  <th className="right">HP 1 BUỔI<br/>CHÍNH</th>
                  <th className="right">TỔNG HP<br/>CHÍNH</th>
                  <th className="center">SỐ BUỔI<br/>KÈM</th>
                  <th className="right">HP 1 BUỔI<br/>KÈM</th>
                  <th className="right">TỔNG HP<br/>KÈM</th>
                  <th className="center">COPY</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                    <tr><td colSpan="9" className="center" style={{padding:20, color:'#9ca3af'}}>Không tìm thấy học sinh</td></tr>
                ) : (
                    filteredStudents.map((s, i) => {
                    const isPaid = paidStudents[s.id];
                    const cs = copyState[s.id] || "idle";
                    return (
                        <tr key={s.id} className="student-row" onClick={() => { setSelected(s); setPreview(true); }}>
                        <td className="center stt-cell">{i + 1}</td>
                        <td className="center" onClick={e => e.stopPropagation()}>
                            <button className={`status-badge ${isPaid ? "paid" : "unpaid"}`} onClick={() => togglePaid(s.id)}>
                            <span className="status-dot"></span>{isPaid ? "Đã thu" : "Chưa thu"}
                            </button>
                        </td>
                        <td className="name-cell">{s.name}</td>
                        <td className="center">{s.sessions}</td>
                        <td className="right price-cell">{fmt(s.pricePerSession)}</td>
                        <td className="right" style={{fontWeight:600, color:'#1f2937'}}>{fmt(s.baseFee)}</td>
                        <td className="center">{s.kemSessions > 0 ? s.kemSessions : "-"}</td>
                        <td className="right price-cell">{s.kemFee > 0 ? fmt(s.kemPrice) : "-"}</td>
                        <td className="right" style={{fontWeight:600, color:'#1f2937'}}>{s.kemFee > 0 ? fmt(s.kemFee) : "-"}</td>
                        <td className="center" onClick={e => copyOneRow(e, s)}>
                            <button className={`copy-btn ${cs === "loading" ? "loading" : cs === "copied" ? "copied" : ""}`}>
                            {cs !== "loading" && <CopyIcon state={cs} />}
                            </button>
                        </td>
                        </tr>
                    );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loading Overlay for ZIP */}
        {isZipping && (
            <div className="modal-overlay">
                <div style={{background: 'white', padding: '20px 40px', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <div className="spin" style={{marginBottom: 15}}><Icon name="copy" size={32} /></div>
                    <div style={{fontWeight: 600}}>Đang tạo file ZIP...</div>
                    <div style={{fontSize: 13, color: '#6b7280', marginTop: 4}}>Vui lòng không tắt trình duyệt</div>
                </div>
            </div>
        )}

        {/* Receipt Modal */}
        {preview && selected && (
          <div className="modal-overlay" onClick={() => setPreview(false)}>
            <div className="modal-wrap" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Phiếu – {selected.name}</h3>
                    <button className="modal-close" onClick={() => setPreview(false)}>×</button>
                </div>
                {/* Scaled Preview Section */}
                <div className="receipt-preview-container">
                    <div className="receipt-scale-wrapper">
                        <ReceiptMarkup 
                            student={selected} bankInfo={bankInfo} qrCodeUrl={qrCodeUrl}
                            context={{year: selYear, month: selMonth}}
                        />
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="btn-dark" onClick={downloadReceipt}>⬇️ Tải ảnh</button>
                    <button className="btn-dark" onClick={async () => {
                        const canvas = await renderReceiptToCanvas(selected, bankInfo, qrCodeUrl, {year: selYear, month: selMonth});
                        canvas.toBlob(blob => { navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).then(() => alert("Copied!")); });
                    }}>📋 Copy</button>
                </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// STUDENT MANAGEMENT PAGE
// ─────────────────────────────────────────────────────────────────

function StudentPage({ classes, setClasses }) {
  const [step, setStep] = useState(0); // 0: Class List, 1: Student List, 2: Student Detail
  const [selClassId, setSelClassId] = useState(null);

  // Class Add/Edit State
  const [showAddClass, setShowAddClass] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [editingClassName, setEditingClassName] = useState("");
  const [editingClassId, setEditingClassId] = useState(null);
  
  // States for View 1 (Student List)
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" or "edit"
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({});

  // State for View 2 (Student Detail)
  const [viewStudentDetail, setViewStudentDetail] = useState(null);

  // Time filters for stats
  const [viewYear, setViewYear] = useState(new Date().getFullYear().toString());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  const activeClass = useMemo(() => classes.find(c => c.id === selClassId), [classes, selClassId]);

  const filteredStudents = useMemo(() => {
    if (!activeClass || !activeClass.students) return [];
    if (!searchQuery.trim()) return activeClass.students;
    const q = searchQuery.toLowerCase();
    return activeClass.students.filter(s => s.name.toLowerCase().includes(q));
  }, [activeClass, searchQuery]);

  // Calculate detailed stats for the selected Month/Year
  const studentsWithStats = useMemo(() => {
    if (!activeClass) return [];
    const sessions = (activeClass.sessions || []).filter(ses => {
        if (!ses.date) return false;
        const [y, m] = ses.date.split("-");
        return y === viewYear && parseInt(m) === viewMonth;
    });

    return filteredStudents.map(s => {
        const mainCount = sessions.filter(ses => (ses.attendance || []).includes(s.id)).length;
        const kemCount = s.hasKem ? sessions.filter(ses => (ses.attendanceKem || []).includes(s.id)).length : 0;
        const mainFee = mainCount * (s.pricePerSession || 0);
        const kemFee = kemCount * (s.kemPrice || 0);
        return {
            ...s,
            mainCount,
            kemCount,
            mainFee,
            kemFee,
            totalFee: mainFee + kemFee
        };
    });
  }, [filteredStudents, activeClass, viewYear, viewMonth]);


  const handleDelete = (studentId) => {
    if (!confirm("Bạn có chắc muốn xoá học sinh này?")) return;
    const updated = classes.map(c => {
        if (c.id !== selClassId) return c;
        return { ...c, students: c.students.filter(s => s.id !== studentId) };
    });
    setClasses(updated); saveClasses(updated);
  };

  const openAddModal = () => {
      setModalMode("add");
      setFormData({ name: "", pricePerSession: 0, hasKem: false, kemPrice: 0 });
      setShowModal(true);
  };

  const openEditModal = (student) => {
      setModalMode("edit");
      setEditingStudent(student);
      setFormData({
          name: student.name,
          pricePerSession: student.pricePerSession,
          hasKem: !!student.hasKem,
          kemPrice: student.kemPrice || 0
      });
      setShowModal(true);
  };

  const handleSave = () => {
      if (!formData.name.trim()) return;
      const price = parseInt(String(formData.pricePerSession).replace(/\D/g, "")) || 0;
      const kemPrice = parseInt(String(formData.kemPrice).replace(/\D/g, "")) || 0;

      const updated = classes.map(c => {
          if (c.id !== selClassId) return c;
          
          if (modalMode === "add") {
              const newStudent = {
                  id: Date.now().toString(),
                  name: formData.name.trim(),
                  pricePerSession: price,
                  hasKem: formData.hasKem,
                  kemPrice: formData.hasKem ? kemPrice : 0,
                  days: [] // Default empty schedule
              };
              return { ...c, students: [...(c.students || []), newStudent] };
          } else {
              return {
                  ...c,
                  students: (c.students || []).map(s => s.id !== editingStudent.id ? s : {
                      ...s,
                      name: formData.name.trim(),
                      pricePerSession: price,
                      hasKem: formData.hasKem,
                      kemPrice: formData.hasKem ? kemPrice : 0
                  })
              };
          }
      });
      
      setClasses(updated);
      saveClasses(updated);
      setShowModal(false);
  };

  const addNewClass = () => {
    if (!newClassName.trim()) return;
    const cls = { id: Date.now().toString(), name: newClassName.trim(), students: [], sessions: [] };
    const updated = [...classes, cls];
    setClasses(updated); saveClasses(updated);
    setNewClassName(""); setShowAddClass(false);
  };

  const handleRenameClass = () => {
      if (!editingClassName.trim()) return;
      const targetId = editingClassId;
      const updated = classes.map(c => c.id === targetId ? { ...c, name: editingClassName.trim() } : c);
      setClasses(updated); saveClasses(updated);
      setShowEditClass(false);
      setEditingClassId(null);
  }

  // VIEW 0: LIST CLASSES (Added "Add Class" here)
  if (step === 0) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <div className="page-topbar-title">Danh Sách Học Sinh - Chọn Lớp</div>
          <button className="btn-add-primary" onClick={() => setShowAddClass(true)}>+ Thêm lớp</button>
        </div>
        <div className="nav-grid">
          {classes.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏫</div><div>Chưa có lớp nào</div></div> : null}
          {classes.map(c => (
            <NavCard 
                key={c.id} 
                label={c.name} 
                sub={`${(c.students || []).length} học sinh`} 
                icon={<Icon name="school" />} 
                onClick={() => { setSelClassId(c.id); setStep(1); }} 
                onEdit={() => {
                    setEditingClassId(c.id);
                    setEditingClassName(c.name);
                    setShowEditClass(true);
                }}
            />
          ))}
        </div>
        {showAddClass && (
          <div className="modal-overlay" onClick={() => setShowAddClass(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-dialog-header">Thêm lớp học mới</div>
              <div className="modal-dialog-body">
                <label className="form-label">Tên lớp</label>
                <input className="form-input" autoFocus value={newClassName} onChange={e => setNewClassName(e.target.value)} onKeyDown={e => e.key === "Enter" && addNewClass()} />
              </div>
              <div className="modal-dialog-footer">
                <button className="btn-cancel" onClick={() => setShowAddClass(false)}>Huỷ</button>
                <button className="btn-save" onClick={addNewClass}>Tạo lớp</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal Rename Class (Moved here for editing from list) */}
        {showEditClass && (
          <div className="modal-overlay" onClick={() => setShowEditClass(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-dialog-header">Đổi tên lớp</div>
              <div className="modal-dialog-body">
                <label className="form-label">Tên lớp mới</label>
                <input className="form-input" autoFocus value={editingClassName} 
                    onChange={e => setEditingClassName(e.target.value)} 
                    onKeyDown={e => e.key === "Enter" && handleRenameClass()} />
              </div>
              <div className="modal-dialog-footer">
                <button className="btn-cancel" onClick={() => setShowEditClass(false)}>Huỷ</button>
                <button className="btn-save" onClick={handleRenameClass}>Lưu</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW 1: STUDENT LIST
  if (step === 1 && activeClass) {
    // Generate Year/Month options
    const yearOptions = [];
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 2; i--) yearOptions.push(i.toString());
    
    return (
      <div className="page-content">
        <div className="page-topbar">
           <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <button className="btn-back" onClick={() => { setStep(0); setSearchQuery(""); }}>‹ Chọn lại lớp</button>
                <div className="page-topbar-title">{activeClass.name} - Học sinh</div>
           </div>
           <button className="btn-add-primary" onClick={openAddModal}>
              <span style={{marginRight:5}}>+</span>Thêm học sinh
           </button>
        </div>

        <div style={{display:'flex', gap: 16, alignItems:'center', padding: '0 32px 16px', flexWrap:'wrap'}}>
             <div className="search-bar-wrap" style={{margin:0, flex:1, minWidth:250}}>
                <div className="search-icon"><Icon name="search" size={18}/></div>
                <input className="search-input" placeholder="Tìm kiếm tên học sinh..." 
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
                 <span style={{fontSize:13, color:'#6b7280', fontWeight:600}}>Xem thống kê:</span>
                 <select className="form-input" style={{width:80}} value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))}>
                    {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                 </select>
                 <select className="form-input" style={{width:90}} value={viewYear} onChange={e => setViewYear(e.target.value)}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
            </div>
        </div>

        <div className="table-section">
          <div className="table-header-row">
             <div className="table-title">Danh sách & Học phí (Tháng {viewMonth}/{viewYear})</div>
          </div>
          <div className="table-wrap">
            <table className="students-table">
              <thead>
                <tr>
                  <th className="center">STT</th>
                  <th>HỌ VÀ TÊN</th>
                  <th className="center">SỐ BUỔI<br/>CHÍNH</th>
                  <th className="right">HP 1 BUỔI<br/>CHÍNH</th>
                  <th className="right">TỔNG HP<br/>CHÍNH</th>
                  <th className="center">SỐ BUỔI<br/>KÈM</th>
                  <th className="right">HP 1 BUỔI<br/>KÈM</th>
                  <th className="right">TỔNG HP<br/>KÈM</th>
                  <th className="center">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {studentsWithStats.length === 0 ? (
                    <tr><td colSpan="9" className="center" style={{padding:20, color:'#9ca3af'}}>Không tìm thấy học sinh</td></tr>
                ) : (
                    studentsWithStats.map((s, i) => (
                        <tr key={s.id} className="student-row" onClick={() => {
                            setViewStudentDetail(s);
                            setStep(2);
                        }}>
                          <td className="center stt-cell">{i + 1}</td>
                          <td className="name-cell">{s.name}</td>
                          
                          <td className="center">{s.mainCount}</td>
                          <td className="right price-cell">{fmt(s.pricePerSession)}</td>
                          <td className="right" style={{fontWeight:600, color:'#1f2937'}}>{fmt(s.mainFee)}</td>

                          <td className="center">{s.hasKem ? s.kemCount : "-"}</td>
                          <td className="right price-cell">{s.hasKem ? fmt(s.kemPrice) : "-"}</td>
                          <td className="right" style={{fontWeight:600, color:'#1f2937'}}>{s.hasKem ? fmt(s.kemFee) : "-"}</td>
                          
                          <td className="center">
                             <div className="action-btn-group">
                                <button className="action-btn edit" title="Sửa" onClick={(e) => { e.stopPropagation(); openEditModal(s); }}>
                                    <Icon name="edit" size={16} />
                                </button>
                                <button className="action-btn delete" title="Xóa" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}>
                                    <Icon name="trash" size={16} />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Add/Edit Student */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-dialog-header">{modalMode === "add" ? "Thêm học sinh mới" : "Sửa thông tin"}</div>
              <div className="modal-dialog-body">
                <label className="form-label">Tên học sinh</label>
                <input className="form-input" autoFocus value={formData.name || ""}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} 
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  />
                <label className="form-label" style={{ marginTop: 14 }}>Học phí / buổi chính (VND)</label>
                <input className="form-input" type="number" value={formData.pricePerSession || ""}
                  onChange={e => setFormData(f => ({ ...f, pricePerSession: e.target.value }))} />
                
                <div style={{marginTop: 16, display:'flex', alignItems:'center', gap:8}}>
                    <input type="checkbox" id="chkKem" style={{width:16, height:16}} checked={!!formData.hasKem}
                        onChange={e => setFormData(f => ({ ...f, hasKem: e.target.checked }))} />
                    <label htmlFor="chkKem" style={{fontSize:14, fontWeight:500, color:'#374151', cursor:'pointer'}}>Học sinh có học kèm</label>
                </div>

                {formData.hasKem && (
                  <>
                    <label className="form-label" style={{ marginTop: 10 }}>Học phí / buổi kèm (VND)</label>
                    <input className="form-input" type="number" value={formData.kemPrice || ""}
                      onChange={e => setFormData(f => ({ ...f, kemPrice: e.target.value }))} />
                  </>
                )}
              </div>
              <div className="modal-dialog-footer">
                <button className="btn-cancel" onClick={() => setShowModal(false)}>Huỷ</button>
                <button className="btn-save" onClick={handleSave}>{modalMode === "add" ? "Thêm" : "Lưu"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW 2: STUDENT DETAIL (Monthly Attendance)
  if (step === 2 && activeClass && viewStudentDetail) {
    // Filter sessions for the selected month/year
    const studentSessions = (activeClass.sessions || []).filter(ses => {
        if (!ses.date) return false;
        const [y, m] = ses.date.split("-");
        return y === viewYear && parseInt(m) === viewMonth;
    }).sort((a,b) => a.date.localeCompare(b.date)); // Sort by date ascending

    const mainCount = studentSessions.filter(ses => (ses.attendance || []).includes(viewStudentDetail.id)).length;
    const kemCount = studentSessions.filter(ses => (ses.attendanceKem || []).includes(viewStudentDetail.id)).length;

    return (
        <div className="page-content">
             <div className="page-topbar">
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <button className="btn-back" onClick={() => setStep(1)}>‹ Quay lại</button>
                    <div className="page-topbar-title">{viewStudentDetail.name} - Chi tiết tháng {viewMonth}/{viewYear}</div>
                </div>
             </div>

             <div className="stats-grid">
                <StatCard iconBg="rgba(22,163,74,0.1)" icon={<Icon name="check" />} label="Số buổi học chính" value={mainCount} />
                {viewStudentDetail.hasKem && (
                    <StatCard iconBg="rgba(139,92,246,0.1)" icon={<Icon name="notebook" />} label="Số buổi học kèm" value={kemCount} />
                )}
             </div>

             <div className="table-section">
                <div className="table-header-row">
                    <div className="table-title">Lịch sử điểm danh tháng {viewMonth}</div>
                </div>
                <div className="table-wrap">
                    <table className="students-table">
                        <thead>
                            <tr>
                                <th className="center">STT</th>
                                <th>NGÀY HỌC</th>
                                <th className="center">TRẠNG THÁI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentSessions.length === 0 ? (
                                <tr><td colSpan="3" className="center" style={{padding:20, color:'#9ca3af'}}>Tháng này chưa có buổi học nào</td></tr>
                            ) : (
                                studentSessions.map((ses, idx) => {
                                    const isMain = (ses.attendance || []).includes(viewStudentDetail.id);
                                    const isKem = (ses.attendanceKem || []).includes(viewStudentDetail.id);
                                    let status = <span style={{color:'#ef4444', fontWeight:500}}>Vắng</span>;
                                    if (isMain) status = <span className="status-badge paid" style={{cursor:'default'}}>Học chính</span>;
                                    else if (isKem) status = <span className="status-badge" style={{background:'#f3e8ff', color:'#7c3aed', border:'1px solid #d8b4fe', cursor:'default'}}>Học kèm</span>;

                                    return (
                                        <tr key={ses.id} className="student-row" style={{cursor:'default'}}>
                                            <td className="center stt-cell">{idx + 1}</td>
                                            <td className="name-cell">{fmtDate(ses.date)}</td>
                                            <td className="center">{status}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
        </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────

function App() {
  const [page, setPage] = useState("home");
  const [classes, setClasses] = useState(() => loadClasses());

  return (
    <div className="app-shell">
      <main className="main-content">
        <div className="header-bar">
          <div className="header-left">
            <button className="header-home-btn" onClick={() => setPage("home")} title="Trang chủ">
                <Icon name="home" size={20} />
            </button>
            <span className="header-title">
              {page === "home" && "Trang Chủ"}
              {page === "attendance" && "Điểm Danh"}
              {page === "tuition" && "Học Phí"}
              {page === "students" && "Học Sinh"}
              {page === "data" && "Dữ Liệu"}
            </span>
          </div>
          {/* Added Entry Point for Data Import/Export */}
          <button className="header-home-btn" style={{width: 'auto', padding: '0 12px', fontSize: 13, gap: 6, fontWeight: 500}} onClick={() => setPage("data")}>
             <Icon name="database" size={18} /> Dữ Liệu
          </button>
        </div>

        {page === "home" && <HomePage onNavigate={setPage} />}
        {page === "attendance" && <AttendancePage classes={classes} setClasses={setClasses} />}
        {page === "tuition" && <TuitionPage classes={classes} />}
        {page === "students" && <StudentPage classes={classes} setClasses={setClasses} />}
        {page === "data" && <DataPage classes={classes} setClasses={setClasses} />}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);