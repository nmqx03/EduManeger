// RECEIPT
// ─────────────────────────────────────────────────────────────────
function ReceiptMarkup({ student, bankInfo, qrCodeUrl, id, context, profile: profileProp }) {
  const timeTitle = `Tháng ${context?.month}/${context?.year}`;
  const hasKem = student.hasKem && student.kemSessions > 0;
  const profile = profileProp || loadProfile(); // dùng prop nếu có, fallback localStorage
  const addrText = profile.phone || profile.teacherName
    ? `Số điện thoại: ${profile.phone || ""}${profile.teacherName ? ' - ' + profile.teacherName : ''}`
    : "";
  const logoSrc = profile.logoDataUrl || "images/logo2.png";

  return (
    <div className="receipt" id={id || undefined}>
      <div className="receipt-header">
        <img src={logoSrc} alt="Logo" className="receipt-logo"
          onError={(e) => { e.target.style.display = "none"; }} />
        <div className="receipt-addr">{addrText}</div>
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
                   <span className="info-label">Học Phí / Buổi:</span>
                   <span className="info-value">{fmt(student.pricePerSession)} đ</span>
                 </div>
                 
                 <div className="receipt-divider dashed"></div>
                 
                 {/* Học Kèm */}
                 <div className="info-item">
                   <span className="info-label">Số Buổi Kèm:</span>
                   <span className="info-value">{student.kemSessions || 0} buổi</span>
                 </div>
                 <div className="info-item">
                   <span className="info-label">Học Phí / Buổi:</span>
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
              <div className="receipt-total-label">TỔNG HỌC PHÍ:</div>
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

function renderReceiptToCanvas(student, bankInfo, qrCodeUrl, context, profile) {
  return new Promise((resolve, reject) => {
    const wrap = document.createElement("div");
    // Dùng position:absolute thay fixed để tránh html2canvas tính sai offset khi trang đang scroll
    wrap.style.cssText = "position:absolute;left:-9999px;top:0;width:1080px;pointer-events:none;z-index:-1;visibility:hidden;";
    document.body.appendChild(wrap);
    
    const tmpRoot = ReactDOM.createRoot(wrap);
    tmpRoot.render(React.createElement(ReceiptMarkup, { student, bankInfo, qrCodeUrl, context, profile }));

    const capture = () => {
      const el = wrap.querySelector(".receipt");
      if (!el) { cleanup(); reject(new Error("Receipt not found")); return; }
      
      window.html2canvas(el, { 
          scale: 2,
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: "#fff", 
          logging: false,
          // Quan trọng: truyền scroll offset để html2canvas không bị lệch
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1080,
          x: 0,
          y: 0,
      })
        .then(canvas => { cleanup(); resolve(canvas); })
        .catch(err  => { cleanup(); reject(err); });
    };

    const cleanup = () => { tmpRoot.unmount(); document.body.removeChild(wrap); };
    
    setTimeout(() => { requestAnimationFrame(() => setTimeout(capture, 150)); }, 200);
  });
}