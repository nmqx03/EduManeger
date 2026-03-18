// ATTENDANCE PAGE
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

function AttendancePage({ classes, setClasses, navigate, hashParts, user, passcodeUnlocked, setPasscodeUnlocked }) {
  // Navigation State
  const [step, setStep] = useState(0);
  const [selClassId, setSelClassId] = useState(null);
  const [selYear, setSelYear] = useState(null);
  const [selMonth, setSelMonth] = useState(null);
  const [selSessionId, setSelSessionId] = useState(null);

  // Modal States
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().slice(0, 10));

  // PasscodeGate for edit/delete session
  const [passcodeGate, setPasscodeGate] = useState(null);

  // Dropdown menu cho buổi học
  const [sessionMenuId, setSessionMenuId] = useState(null);
  const sessionMenuRef = useRef(null);

  useEffect(() => {
    if (!sessionMenuId) return;
    const handler = (e) => {
      if (sessionMenuRef.current && sessionMenuRef.current.contains(e.target)) return;
      setSessionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sessionMenuId]);
  
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

  // Sửa buổi — yêu cầu passcode
  const openEditSessionGated = (session) => {
    setPasscodeGate({
      title: "Sửa buổi học",
      message: `Xác nhận sửa buổi ngày ${fmtDate(session.date)}?`,
      onConfirm: () => { setPasscodeGate(null); openEditSession(session); }
    });
  };

  // Xóa buổi — yêu cầu passcode
  const deleteSession = (session) => {
    setPasscodeGate({
      title: "Xóa buổi học",
      message: `Xóa buổi ngày ${fmtDate(session.date)}? Toàn bộ dữ liệu điểm danh của buổi này sẽ bị xóa vĩnh viễn.`,
      onConfirm: () => {
        const updated = classes.map(c => {
          if (c.id !== selClassId) return c;
          return { ...c, sessions: c.sessions.filter(s => s.id !== session.id) };
        });
        setClasses(updated);
        setPasscodeGate(null);
      }
    });
  };

  const saveSession = () => {
    if (!newSessionDate) return;

    // Kiểm tra ngày trùng (chỉ khi thêm mới)
    if (!editingSessionId) {
      const duplicate = (activeClass?.sessions || []).some(s => s.date === newSessionDate);
      if (duplicate) { alert(`❌ Ngày ${newSessionDate} đã có buổi học. Vui lòng chọn ngày khác.`); return; }
    }

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
    
    setClasses(updated); setShowAddSession(false);
  };

  const toggleAttendance = (studentId, type) => {
    // type: 'main' | 'kem' | 'absent' — set trực tiếp, không toggle
    const updated = classes.map(c => {
      if (c.id !== selClassId) return c;
      return {
        ...c,
        sessions: c.sessions.map(ses => {
          if (ses.id !== selSessionId) return ses;
          let att    = ses.attendance    || [];
          let attKem = ses.attendanceKem || [];

          if (type === 'absent') {
            // Bỏ khỏi cả hai danh sách
            att    = att.filter(id => id !== studentId);
            attKem = attKem.filter(id => id !== studentId);
          } else if (type === 'main') {
            // Chỉ thêm vào main nếu chưa có, xóa khỏi kem
            att    = att.includes(studentId) ? att : [...att, studentId];
            attKem = attKem.filter(id => id !== studentId);
          } else if (type === 'kem') {
            // Chỉ thêm vào kem nếu chưa có, xóa khỏi main
            attKem = attKem.includes(studentId) ? attKem : [...attKem, studentId];
            att    = att.filter(id => id !== studentId);
          }
          return { ...ses, attendance: att, attendanceKem: attKem };
        })
      };
    });
    setClasses(updated);
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
        {classes.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏫</div><div>Chưa có lớp nào</div></div> : null}
        <DraggableNavGrid
          items={classes}
          onReorder={next => { setClasses(next); }}
          renderItem={(c) => (
            <NavCard label={c.name} sub={`${(c.students || []).length} học sinh`}
              icon={<Icon name="school" />} onClick={() => { setSelClassId(c.id); setStep(1); }} />
          )}
        />
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
              <div key={ses.id} style={{position:'relative'}}>
                <NavCard
                  label={fmtDate(ses.date)}
                  sub={`${presentCount}/${(activeClass.students || []).filter(s=>isStudentActive(s, selYear, selMonth)).length} có mặt`}
                  icon={<Icon name="att" />}
                  onClick={() => { setSelSessionId(ses.id); setStep(4); }}
                  onEdit={() => setSessionMenuId(sessionMenuId === ses.id ? null : ses.id)}
                />
                {sessionMenuId === ses.id && (
                  <div ref={sessionMenuRef} style={{
                    position:'absolute', top:'100%', right:8, zIndex:50, marginTop:4,
                    background:'#fff', borderRadius:10, border:'1px solid #eff6ff',
                    boxShadow:'0 8px 24px rgba(79,127,255,0.18)', overflow:'hidden', minWidth:160
                  }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setSessionMenuId(null); openEditSessionGated(ses); }} style={{
                      width:'100%', padding:'10px 16px', border:'none', background:'transparent',
                      display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                      fontSize:13, fontWeight:600, color:'#374151', textAlign:'left'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <Icon name="edit" size={15}/> Sửa ngày buổi học
                    </button>
                    <div style={{height:1, background:'#eff6ff'}}/>
                    <button onClick={() => { setSessionMenuId(null); deleteSession(ses); }} style={{
                      width:'100%', padding:'10px 16px', border:'none', background:'transparent',
                      display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                      fontSize:13, fontWeight:600, color:'#ef4444', textAlign:'left'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <Icon name="trash" size={15}/> Xóa buổi học
                    </button>
                  </div>
                )}
              </div>
             );
          })}
        </div>
        {sessionModal}
        {passcodeGate && (
          <PasscodeGate
            title={passcodeGate.title}
            message={passcodeGate.message}
            onConfirm={passcodeGate.onConfirm}
            onCancel={() => setPasscodeGate(null)}
            userUid={user && user.uid}
            passcodeUnlocked={passcodeUnlocked}
            setPasscodeUnlocked={setPasscodeUnlocked}
          />
        )}
      </div>
    );
  }

  // VIEW 4: MARKING ATTENDANCE (TABLE)
  if (step === 4) {
    if (!activeSession) return <div className="page-content"><div className="empty-state">Không tìm thấy buổi học</div><button className="btn-back" onClick={() => setStep(3)}>Quay lại</button></div>;
    
    const activeStudents = (activeClass.students || []).filter(s => isStudentActive(s, selYear, selMonth));
    const totalStudents = activeStudents.length;
    const presentMain = activeSession.attendance?.length || 0;
    const presentKem = activeSession.attendanceKem?.length || 0;
    const totalPresent = presentMain + presentKem;
    const totalAbsent = totalStudents - totalPresent;

    return (
      <div className="page-content">
        <div className="page-topbar">
          <button className="btn-back" onClick={() => setStep(3)}>‹ Chọn lại buổi</button>
          <div className="page-topbar-title">Điểm Danh — {fmtDate(activeSession.date)}</div>
        </div>

        {/* Stat Cards */}
        <div className="att-stat-row">
          <div className="att-stat-card">
            <div className="att-stat-icon" style={{background:"rgba(99,102,241,0.12)",color:"#6366f1"}}>
              <Icon name="users" size={22}/>
            </div>
            <div className="att-stat-body">
              <div className="att-stat-label">Tổng sĩ số</div>
              <div className="att-stat-val">{totalStudents}</div>
            </div>
          </div>
          <div className="att-stat-card">
            <div className="att-stat-icon" style={{background:"rgba(16,185,129,0.12)",color:"#10b981"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="att-stat-body">
              <div className="att-stat-label">Có mặt</div>
              <div className="att-stat-val" style={{color:"#10b981"}}>{totalPresent}</div>
            </div>
            <div className="att-stat-pct" style={{color:"#10b981"}}>{totalStudents > 0 ? Math.round(totalPresent/totalStudents*100) : 0}%</div>
          </div>
          <div className="att-stat-card">
            <div className="att-stat-icon" style={{background:"rgba(239,68,68,0.10)",color:"#ef4444"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div className="att-stat-body">
              <div className="att-stat-label">Vắng mặt</div>
              <div className="att-stat-val" style={{color:"#ef4444"}}>{totalAbsent}</div>
            </div>
            <div className="att-stat-pct" style={{color:"#ef4444"}}>{totalStudents > 0 ? Math.round(totalAbsent/totalStudents*100) : 0}%</div>
          </div>
        </div>

        {/* Table */}
        <div className="att-table-section">
          <div className="att-table-topbar">
            <div className="att-table-title">Danh sách điểm danh</div>
            <div className="att-table-legend">
              <span className="att-legend-dot" style={{background:"#10b981"}}/>Có mặt
              <span className="att-legend-dot" style={{background:"#8b5cf6",marginLeft:12}}/>Kèm
              <span className="att-legend-dot" style={{background:"#ef4444",marginLeft:12}}/>Vắng
            </div>
          </div>
          <div className="table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th className="att-th center">STT</th>
                  <th className="att-th">HỌ VÀ TÊN</th>
                  <th className="att-th">ĐIỂM DANH</th>
                  <th className="att-th center">CHÍNH / THÁNG</th>
                  <th className="att-th center">KÈM / THÁNG</th>
                  <th className="att-th center">TỔNG / THÁNG</th>
                </tr>
              </thead>
              <tbody>
                {activeStudents.map((s, i) => {
                  const isMain = (activeSession.attendance || []).includes(s.id);
                  const isKem  = (activeSession.attendanceKem || []).includes(s.id);
                  const stats  = getMonthlyStats(s.id);
                  const status = isMain ? "present" : isKem ? "kem" : "absent";
                  return (
                    <tr key={s.id} className={"att-row att-row-" + status}>
                      <td className="att-td center att-stt">{i + 1}</td>
                      <td className="att-td att-name">{s.name}</td>
                      <td className="att-td" onClick={e => e.stopPropagation()}>
                        <div className="att-toggle-group">
                          <button className={"att-toggle-btn" + (!isMain && !isKem ? " active absent" : "")}
                            onClick={() => toggleAttendance(s.id, "absent")}>Vắng</button>
                          <button className={"att-toggle-btn" + (isMain ? " active present" : "")}
                            onClick={() => toggleAttendance(s.id, "main")}>Có mặt</button>
                          {s.hasKem && (
                            <button className={"att-toggle-btn" + (isKem ? " active kem" : "")}
                              onClick={() => toggleAttendance(s.id, "kem")}>Kèm</button>
                          )}
                        </div>
                      </td>
                      <td className="att-td center att-count">{stats.main}</td>
                      <td className="att-td center att-count-kem">{stats.kem}</td>
                      <td className="att-td center att-count-total">{stats.total}</td>
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