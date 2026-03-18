// TUITION PAGE
// ─────────────────────────────────────────────────────────────────

// Component riêng để scale receipt đúng cách với useEffect
function ReceiptModal({ selected, bankInfo, qrCodeUrl, profile, selYear, selMonth, onClose, onDownload, onCopy }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const doScale = () => {
      if (!containerRef.current || !wrapperRef.current) return;
      const containerW = containerRef.current.clientWidth - 32;
      if (containerW <= 0) return;
      const scale = Math.min(containerW / 1080, 0.5);
      wrapperRef.current.style.transform = `scale(${scale})`;
      wrapperRef.current.style.height = Math.round(1920 * scale) + 'px';
    };
    // Chạy sau khi DOM render
    const t1 = setTimeout(doScale, 50);
    const t2 = setTimeout(doScale, 200); // lần 2 để đảm bảo ảnh load xong
    window.addEventListener('resize', doScale);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', doScale); };
  }, [selected]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-wrap" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Phiếu – {selected.name}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="receipt-preview-container" ref={containerRef}>
          <div className="receipt-scale-wrapper" ref={wrapperRef}>
            <ReceiptMarkup
              student={selected} bankInfo={bankInfo} qrCodeUrl={qrCodeUrl} profile={profile}
              context={{year: selYear, month: selMonth}}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-dark" onClick={onDownload}>⬇️ Tải ảnh</button>
          <button className="btn-dark" onClick={onCopy}>📋 Copy</button>
        </div>
      </div>
    </div>
  );
}

function TuitionPage({ classes, user }) {
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
  const [profile, setProfile] = useState(() => loadProfile()); // profile, sync từ Firestore

  // Filters & ZIP
  const [filter, setFilter] = useState("all"); // 'all', 'paid', 'unpaid'
  const [isZipping, setIsZipping] = useState(false);

  // Load profile từ Firestore khi mount — đảm bảo thông tin receipt luôn mới nhất
  useEffect(() => {
    if (!user) return;
    loadProfileFromDB(user.uid).then(p => { if (p) setProfile(p); });
  }, [user]);

  const bankInfo = useMemo(() => ({
    bank: profile.bank || "",
    account: profile.account || "",
    owner: profile.owner || ""
  }), [profile]);
  const qrCodeUrl = useMemo(() => profile.qrDataUrl || "", [profile]);

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

  // Load Paid Status — Firestore là nguồn chính, localStorage fallback khi offline
  useEffect(() => {
    if (!selClassId || !selYear || !selMonth) return;
    setPaidStudents({});
    if (user) {
      loadPaidFromDB(user.uid, String(selClassId), String(selYear), String(selMonth)).then(data => {
        console.log("[Paid] Loaded from Firestore:", data);
        setPaidStudents(data && Object.keys(data).length > 0 ? data : loadPaid(selClassId, selYear, selMonth));
      });
    } else {
      setPaidStudents(loadPaid(selClassId, selYear, selMonth));
    }
  }, [selClassId, selYear, selMonth]);

  // Calculations
  const students = useMemo(() => {
    if (!activeClass || !selYear || !selMonth) return [];
    
    // Filter sessions for the selected Year/Month
    const validSessions = (activeClass.sessions || []).filter(ses => {
      if (!ses.date) return false;
      const [y, m] = ses.date.split("-");
      return y === selYear && parseInt(m) === selMonth;
    });

    return (activeClass.students || []).filter(s => !s.inactive).map((s, idx) => {
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
    setPaidStudents(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (user) {
        console.log("[Paid] Saving to Firestore:", user.uid, selClassId, selYear, selMonth, next);
        savePaidToDB(user.uid, String(selClassId), String(selYear), String(selMonth), next)
          .then(() => console.log("[Paid] Saved OK"))
          .catch(e => console.error("[Paid] Save error:", e));
      } else {
        savePaid(selClassId, selYear, selMonth, next);
      }
      return next;
    });
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
            const canvas = await renderReceiptToCanvas(student, bankInfo, qrCodeUrl, context, profile);
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
      const canvas = await renderReceiptToCanvas(selected, bankInfo, qrCodeUrl, context, profile);
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
            const canvas = await renderReceiptToCanvas(s, bankInfo, qrCodeUrl, context, profile);
            
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

  const PINK   = "rgba(79,127,255,0.12)";
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
                  <th className="center" rowSpan={2} style={{verticalAlign:'middle'}}>STT</th>
                  <th className="center" rowSpan={2} style={{verticalAlign:'middle'}}>TRẠNG THÁI</th>
                  <th rowSpan={2} style={{verticalAlign:'middle'}}>HỌ VÀ TÊN</th>
                  <th className="center" colSpan={3} style={{background:'#dbeafe', color:'#1d4ed8', borderBottom:'2px solid #bfdbfe'}}>HỌC CHÍNH</th>
                  <th className="center" colSpan={3} style={{background:'#ede9fe', color:'#6d28d9', borderBottom:'2px solid #ddd6fe'}}>HỌC KÈM</th>
                  <th className="center" rowSpan={2} style={{verticalAlign:'middle'}}>COPY</th>
                </tr>
                <tr>
                  <th className="center" style={{background:'#eff6ff'}}>SỐ BUỔI</th>
                  <th className="right" style={{background:'#eff6ff'}}>HP / BUỔI</th>
                  <th className="right" style={{background:'#eff6ff'}}>TỔNG HP</th>
                  <th className="center" style={{background:'#f5f3ff'}}>SỐ BUỔI</th>
                  <th className="right" style={{background:'#f5f3ff'}}>HP / BUỔI</th>
                  <th className="right" style={{background:'#f5f3ff'}}>TỔNG HP</th>
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
          <ReceiptModal
            selected={selected}
            bankInfo={bankInfo}
            qrCodeUrl={qrCodeUrl}
            profile={profile}
            selYear={selYear}
            selMonth={selMonth}
            onClose={() => setPreview(false)}
            onDownload={downloadReceipt}
            onCopy={async () => {
              const canvas = await renderReceiptToCanvas(selected, bankInfo, qrCodeUrl, {year: selYear, month: selMonth}, profile);
              canvas.toBlob(blob => {
                navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).then(() => alert("Copied!"));
              });
            }}
          />
        )}
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────