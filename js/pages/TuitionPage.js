// TUITION PAGE
// ─────────────────────────────────────────────────────────────────

// Kiểm tra học sinh có active trong tháng/năm không
function isStudentActive(student, year, month) {
  if (!student.inactive) return true;
  const iy = student.inactiveYear;
  const im = student.inactiveMonth;
  if (!iy || !im) return false; // inactive nhưng không có ngày → ẩn hết
  const viewDate = parseInt(year) * 12 + parseInt(month);
  const inactiveDate = iy * 12 + im;
  return viewDate <= inactiveDate; // hiện tháng nghỉ, ẩn từ tháng sau
}


// Scale receipt đúng tâm
function ReceiptScalePreview({ selected, bankInfo, qrCodeUrl, profile, selYear, selMonth }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const doScale = () => {
      if (!containerRef.current || !wrapperRef.current) return;
      const containerW = containerRef.current.clientWidth;
      if (containerW <= 0) return;
      const scale = Math.min(containerW / 1080, 0.30);
      const receiptEl = wrapperRef.current.querySelector('.receipt');
      const h = receiptEl ? receiptEl.offsetHeight : 1920;
      wrapperRef.current.style.width = '1080px';
      wrapperRef.current.style.transform = `scale(${scale})`;
      wrapperRef.current.style.transformOrigin = 'top left';
      wrapperRef.current.style.marginLeft = `${(containerW - 1080 * scale) / 2}px`;
      wrapperRef.current.style.height = Math.ceil(h * scale) + 'px';
    };
    const t1 = setTimeout(doScale, 80);
    const t2 = setTimeout(doScale, 300);
    window.addEventListener('resize', doScale);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', doScale); };
  }, [selected]);

  return (
    <div ref={containerRef} style={{
      overflowY:'auto', overflowX:'hidden', background:'#f0f4ff',
      flex:1, minHeight:0, padding:'12px 0'
    }}>
      <div ref={wrapperRef} style={{display:'block'}}>
        <ReceiptMarkup
          student={selected} bankInfo={bankInfo} qrCodeUrl={qrCodeUrl} profile={profile}
          context={{year: selYear, month: selMonth}}
        />
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

    return (activeClass.students || []).filter(s => isStudentActive(s, selYear, selMonth)).map((s, idx) => {
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
    const collectedPct = totalFee > 0 ? Math.round(collectedFee / totalFee * 100) : 0;
    const uncollectedPct = 100 - collectedPct;
    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(2)}>‹ Chọn lại lớp</button>
          <div className="page-topbar-title">
            {activeClass.name}
            <span className="tui-month-tag">T{selMonth}/{selYear}</span>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="tui-stat-row">
          <div className="tui-stat-card tui-stat-total">
            <div className="tui-sc-icon" style={{background:'rgba(59,111,240,0.10)', color:'#3b6ff0'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="tui-sc-body">
              <div className="tui-sc-label">Tổng cần thu</div>
              <div className="tui-sc-val">{fmt(totalFee)} <span className="tui-sc-unit">đ</span></div>
              <div className="tui-sc-sub">{students.length} học sinh</div>
            </div>
          </div>
          <div className="tui-stat-card tui-stat-collected">
            <div className="tui-sc-icon" style={{background:'rgba(16,185,129,0.10)', color:'#10b981'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="tui-sc-body">
              <div className="tui-sc-label">Đã thu</div>
              <div className="tui-sc-val" style={{color:"#10b981"}}>{fmt(collectedFee)} <span className="tui-sc-unit">đ</span></div>
              <div className="tui-sc-sub">{paidList.length} học sinh · <b style={{color:'#10b981'}}>{collectedPct}%</b></div>
            </div>
          </div>
          <div className="tui-stat-card tui-stat-uncollected">
            <div className="tui-sc-icon" style={{background:'rgba(239,68,68,0.09)', color:'#ef4444'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="tui-sc-body">
              <div className="tui-sc-label">Chưa thu</div>
              <div className="tui-sc-val" style={{color:"#ef4444"}}>{fmt(uncollectedFee)} <span className="tui-sc-unit">đ</span></div>
              <div className="tui-sc-sub">{unpaidList.length} học sinh · <b style={{color:'#ef4444'}}>{uncollectedPct}%</b></div>
            </div>
          </div>
          <div className="tui-stat-card tui-stat-progress">
            <div className="tui-sc-icon" style={{background:'rgba(139,92,246,0.10)', color:'#8b5cf6'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="tui-sc-body">
              <div className="tui-sc-label">Sĩ số lớp</div>
              <div className="tui-sc-val">{students.length} <span className="tui-sc-unit">HS</span></div>
              <div className="tui-sc-progress">
                <div className="tui-sc-bar"><div className="tui-sc-fill" style={{width:collectedPct+'%'}}/></div>
                <span className="tui-sc-pct">{collectedPct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div className="tui-toolbar">
          <div className="tui-filter-group">
            <button className={"tui-filter-btn" + (filter==="all"?" active":"")} onClick={()=>setFilter("all")}>
              Tất cả <span className="tui-filter-count">{students.length}</span>
            </button>
            <button className={"tui-filter-btn tui-filter-unpaid" + (filter==="unpaid"?" active":"")} onClick={()=>setFilter("unpaid")}>
              Chưa thu <span className="tui-filter-count">{unpaidList.length}</span>
            </button>
            <button className={"tui-filter-btn tui-filter-paid" + (filter==="paid"?" active":"")} onClick={()=>setFilter("paid")}>
              Đã thu <span className="tui-filter-count">{paidList.length}</span>
            </button>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="tui-zip-btn" onClick={()=>downloadZip(students,'TatCa')} disabled={isZipping}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Tất Cả
            </button>
            <button className="tui-zip-btn tui-zip-unpaid" onClick={()=>downloadZip(unpaidList,'ChuaDong')} disabled={isZipping}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Chưa Đóng
            </button>
            <button className="tui-zip-btn tui-zip-paid" onClick={()=>downloadZip(paidList,'DaDong')} disabled={isZipping}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Đã Đóng
            </button>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="tui-table-section">
          <div className="tui-table-topbar">
            <div className="tui-table-title">
              Danh sách học phí
              <span className="stu-table-badge">{filteredStudents.length} học sinh</span>
            </div>
            {/* mini progress bar */}
            <div className="tui-mini-progress">
              <div className="tui-mini-bar">
                <div className="tui-mini-fill" style={{width:collectedPct+'%'}}/>
              </div>
              <span className="tui-mini-pct">{collectedPct}% đã thu</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="stu-table">
              <colgroup>
                <col style={{width:52}}/>
                <col/>
                <col style={{width:90}}/>
                <col style={{width:110}}/>
                <col style={{width:110}}/>
                <col style={{width:90}}/>
                <col style={{width:110}}/>
                <col style={{width:110}}/>
                <col style={{width:110}}/>
                <col style={{width:52}}/>
              </colgroup>
              <thead>
                <tr className="stu-thead-group">
                  <th rowSpan={2} className="stu-th center" style={{verticalAlign:'middle', width:52}}>STT</th>
                  <th rowSpan={2} className="stu-th" style={{verticalAlign:'middle'}}>HỌ VÀ TÊN</th>
                  <th colSpan={3} className="stu-th-group stu-th-main">
                    <span className="stu-th-group-dot stu-dot-main"/>HỌC CHÍNH
                  </th>
                  <th colSpan={3} className="stu-th-group stu-th-kem">
                    <span className="stu-th-group-dot stu-dot-kem"/>HỌC KÈM
                  </th>
                  <th rowSpan={2} className="stu-th center" style={{verticalAlign:'middle', width:110}}>TRẠNG THÁI</th>
                  <th rowSpan={2} className="stu-th center" style={{verticalAlign:'middle', width:52}}>PHIẾU</th>
                </tr>
                <tr>
                  <th className="stu-th center stu-sub-main">BUỔI</th>
                  <th className="stu-th right stu-sub-main">HP/BUỔI</th>
                  <th className="stu-th right stu-sub-main">TỔNG</th>
                  <th className="stu-th center stu-sub-kem">BUỔI</th>
                  <th className="stu-th right stu-sub-kem">HP/BUỔI</th>
                  <th className="stu-th right stu-sub-kem">TỔNG</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan="10" style={{padding:'56px 20px', textAlign:'center', color:'#94a3b8', fontSize:14}}>
                    <div style={{fontSize:40, marginBottom:12}}>🔍</div>Không có học sinh nào
                  </td></tr>
                ) : filteredStudents.map((s, i) => {
                  const isPaid = paidStudents[s.id];
                  const cs = copyState[s.id] || "idle";
                  const totalStudent = s.baseFee + s.kemFee;
                  return (
                    <tr key={s.id} className={"stu-row" + (isPaid?" tui-row-paid":" tui-row-unpaid")}
                        onClick={() => { setSelected(s); setPreview(true); }}>
                      <td className="stu-td center stu-stt">{i+1}</td>
                      <td className="stu-td">
                        <div className="stu-name">{s.name}</div>
                      </td>
                      <td className="stu-td center stu-num">{s.sessions}</td>
                      <td className="stu-td right stu-price">{fmt(s.pricePerSession)}</td>
                      <td className="stu-td right stu-fee-main">{fmt(s.baseFee)}</td>
                      <td className="stu-td center stu-num">{s.kemSessions > 0 ? s.kemSessions : <span className="stu-dash">—</span>}</td>
                      <td className="stu-td right stu-price">{s.kemFee > 0 ? fmt(s.kemPrice) : <span className="stu-dash">—</span>}</td>
                      <td className="stu-td right stu-fee-kem">{s.kemFee > 0 ? fmt(s.kemFee) : <span className="stu-dash">—</span>}</td>
                      <td className="stu-td center" onClick={e=>e.stopPropagation()}>
                        <button className={"tui-toggle" + (isPaid?" paid":"")} onClick={()=>togglePaid(s.id)}>
                          <span className="tui-toggle-track"><span className="tui-toggle-thumb"/></span>
                          <span className="tui-toggle-label">{isPaid?"Đã thu":"Chưa thu"}</span>
                        </button>
                      </td>
                      <td className="stu-td center" onClick={e=>copyOneRow(e,s)}>
                        <button className={"tui-copy-btn"+(cs==="loading"?" loading":"")+(cs==="copied"?" copied":"")}>
                          {cs==="copied"
                            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : cs==="loading"
                            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                {/* Scaled Preview */}
                <ReceiptScalePreview
                  selected={selected} bankInfo={bankInfo} qrCodeUrl={qrCodeUrl}
                  profile={profile} selYear={selYear} selMonth={selMonth}
                />
                <div className="modal-actions">
                    <button className="btn-dark" onClick={downloadReceipt}>⬇️ Tải ảnh</button>
                    <button className="btn-dark" onClick={async () => {
                        const canvas = await renderReceiptToCanvas(selected, bankInfo, qrCodeUrl, {year: selYear, month: selMonth}, profile);
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