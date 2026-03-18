// TIMETABLE PAGE
// ─────────────────────────────────────────────────────────────────

function TimetablePage({ classes, user }) {
  const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  const SESSIONS = [
    { id: "sang",  label: "Sáng" },
    { id: "chieu", label: "Chiều" },
    { id: "toi",   label: "Tối" },
  ];

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [studentPanel, setStudentPanel] = useState(null);
  const panelRef = useRef(null);

  const [formDay, setFormDay] = useState(0);
  const [formSession, setFormSession] = useState("sang");
  const [formClassId, setFormClassId] = useState("");
  const [formStart, setFormStart] = useState("07:00");
  const [formEnd, setFormEnd] = useState("09:00");

  useEffect(() => {
    if (!user) return;
    loadTimetableFromDB(user.uid).then(data => {
      setEntries(data || []);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!studentPanel) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setStudentPanel(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [studentPanel]);

  const saveEntries = (next) => {
    setEntries(next);
    if (user) saveTimetableToDB(user.uid, next);
  };

  const openAdd = (dayIdx, sessionId) => {
    setEditingEntry(null);
    setFormDay(dayIdx);
    setFormSession(sessionId);
    setFormClassId(classes[0]?.id || "");
    setFormStart("07:00");
    setFormEnd("09:00");
    setShowModal(true);
  };

  const openEdit = (e, entry) => {
    e.stopPropagation();
    setStudentPanel(null);
    setEditingEntry(entry);
    setFormDay(entry.day);
    setFormSession(entry.session);
    setFormClassId(entry.classId);
    setFormStart(entry.start || "07:00");
    setFormEnd(entry.end || "09:00");
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formClassId) return;
    const cls = classes.find(c => c.id === formClassId);
    if (!cls) return;
    if (editingEntry) {
      saveEntries(entries.map(e => e.id === editingEntry.id
        ? { ...e, day: formDay, session: formSession, classId: formClassId, className: cls.name, start: formStart, end: formEnd }
        : e
      ));
    } else {
      saveEntries([...entries, {
        id: Date.now().toString(),
        day: formDay, session: formSession,
        classId: formClassId, className: cls.name,
        start: formStart, end: formEnd,
      }]);
    }
    setShowModal(false);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    setStudentPanel(null);
    saveEntries(entries.filter(e => e.id !== id));
  };

  const openStudentPanel = (e, entry) => {
    e.stopPropagation();
    if (studentPanel?.entry?.id === entry.id) { setStudentPanel(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setStudentPanel({ entry, rect });
  };

  const getEntries = (dayIdx, sessionId) =>
    entries.filter(e => e.day === dayIdx && e.session === sessionId);

  // Mỗi lớp 1 màu duy nhất — dùng index trong danh sách classes (ổn định theo thứ tự)
  const CLASS_COLORS = [
    { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' }, // xanh dương
    { bg: '#fdf4ff', border: '#d8b4fe', text: '#7e22ce' }, // tím
    { bg: '#fff7ed', border: '#fb923c', text: '#c2410c' }, // cam
    { bg: '#f0fdf4', border: '#4ade80', text: '#166534' }, // xanh lá
    { bg: '#fef9c3', border: '#facc15', text: '#854d0e' }, // vàng
    { bg: '#fff1f2', border: '#fb7185', text: '#be123c' }, // đỏ hồng
    { bg: '#f0f9ff', border: '#38bdf8', text: '#0369a1' }, // cyan
    { bg: '#fdf2f8', border: '#f0abfc', text: '#86198f' }, // hồng tím
    { bg: '#f7fee7', border: '#a3e635', text: '#3f6212' }, // xanh vàng
    { bg: '#fff5f5', border: '#fc8181', text: '#c53030' }, // đỏ nhạt
  ];

  // Map classId → color index cố định (dựa theo thứ tự trong classes)
  const classColorMap = useMemo(() => {
    const map = {};
    classes.forEach((c, i) => { map[c.id] = i % CLASS_COLORS.length; });
    return map;
  }, [classes]);

  const getEntryColor = (classId) => CLASS_COLORS[classColorMap[classId] ?? 0];

  if (loading) return (
    <div className="page-content">
      <div className="empty-state">
        <div className="spin" style={{display:'inline-block',marginBottom:16}}><Icon name="calendar" size={36}/></div>
        <div>Đang tải...</div>
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-topbar">
        <div className="page-topbar-title">Thời Khóa Biểu</div>
      </div>

      <div style={{padding:'0 28px 32px', overflowX:'auto'}}>
        <table className="tkb-table">
          <thead>
            <tr>
              <th className="tkb-th-session"></th>
              {DAYS.map((d, i) => (
                <th key={i} className="tkb-th-day">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map(ses => (
              <tr key={ses.id}>
                <td className={`tkb-session-label${ses.id==='toi'?' tkb-session-toi':''}`}>
                  {ses.label}
                </td>
                {DAYS.map((_, dayIdx) => {
                  const dayEntries = getEntries(dayIdx, ses.id);
                  return (
                    <td key={dayIdx} className={`tkb-cell${ses.id==='toi'?' tkb-cell-toi':''}`}>
                      {dayEntries.map(entry => {
                        const color = getEntryColor(entry.classId);
                        return (
                          <div key={entry.id} className="tkb-entry"
                            style={{background:color.bg, border:`1.5px solid ${color.border}`, cursor:'pointer', marginBottom:4}}
                            onClick={e => openStudentPanel(e, entry)}>
                            <div className="tkb-entry-name" style={{color:color.text, fontWeight:700}}>{entry.className}</div>
                            {(entry.start || entry.end) && (
                              <div className="tkb-entry-time" style={{color:color.text, opacity:0.7}}>{entry.start} – {entry.end}</div>
                            )}
                            <div className="tkb-entry-actions">
                              <button className="tkb-btn-edit" onClick={e => openEdit(e, entry)}>
                                <Icon name="edit" size={11}/>
                              </button>
                              <button className="tkb-btn-del" onClick={e => handleDelete(e, entry.id)}>
                                <Icon name="trash" size={11}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button className="tkb-add-btn" onClick={() => openAdd(dayIdx, ses.id)} title="Thêm lớp">+</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student panel popup */}
      {studentPanel && (() => {
        const cls = classes.find(c => c.id === studentPanel.entry.classId);
        const students = (cls?.students || []).filter(s => !s.inactive);
        const color = getEntryColor(studentPanel.entry.classId);
        const rect = studentPanel.rect;
        const top = rect.bottom + window.scrollY + 8;
        const left = Math.max(8, Math.min(rect.left + window.scrollX, document.documentElement.clientWidth - 268));
        return (
          <div ref={panelRef} className="tkb-student-panel" style={{top, left}}>
            <div className="tkb-panel-header" style={{background:color.bg, borderBottom:`2px solid ${color.border}`}}>
              <div className="tkb-panel-title" style={{color:color.text}}>{studentPanel.entry.className}</div>
              <div className="tkb-panel-meta">{studentPanel.entry.start} – {studentPanel.entry.end} · {students.length} học sinh</div>
            </div>
            <div className="tkb-panel-list">
              {students.length === 0
                ? <div style={{padding:'16px',color:'#94a3b8',textAlign:'center',fontSize:13}}>Chưa có học sinh</div>
                : students.map((s, i) => (
                  <div key={s.id} className="tkb-panel-student">
                    <span className="tkb-panel-stt" style={{color:color.text}}>{i+1}</span>
                    <span className="tkb-panel-name">{s.name}</span>
                  </div>
                ))
              }
            </div>
          </div>
        );
      })()}

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-dialog-header">
              {editingEntry ? "Sửa lịch học" : "Thêm lịch học"}
            </div>
            <div className="modal-dialog-body">
              <label className="form-label">Thứ</label>
              <select className="form-input" value={formDay} onChange={e => setFormDay(Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <label className="form-label" style={{marginTop:12}}>Buổi</label>
              <select className="form-input" value={formSession} onChange={e => setFormSession(e.target.value)}>
                {SESSIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <label className="form-label" style={{marginTop:12}}>Lớp học</label>
              <select className="form-input" value={formClassId} onChange={e => setFormClassId(e.target.value)}>
                {classes.length === 0
                  ? <option value="">Chưa có lớp nào</option>
                  : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                }
              </select>
              <div style={{display:'flex', gap:12, marginTop:12}}>
                <div style={{flex:1}}>
                  <TimePicker label="Giờ bắt đầu" value={formStart} onChange={setFormStart} />
                </div>
                <div style={{flex:1}}>
                  <TimePicker label="Giờ kết thúc" value={formEnd} onChange={setFormEnd} />
                </div>
              </div>
            </div>
            <div className="modal-dialog-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="btn-save" onClick={handleSave}>
                {editingEntry ? "Lưu" : "Thêm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}