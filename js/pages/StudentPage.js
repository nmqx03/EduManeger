// STUDENT MANAGEMENT PAGE
// ─────────────────────────────────────────────────────────────────

function StudentPage({ classes, setClasses, user, passcodeUnlocked, setPasscodeUnlocked }) {
  const [step, setStep] = useState(0);
  const [selClassId, setSelClassId] = useState(null);

  // Class Add/Edit State
  const [showAddClass, setShowAddClass] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [showConfirmRename, setShowConfirmRename] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [editingClassName, setEditingClassName] = useState("");
  const [editingClassId, setEditingClassId] = useState(null);

  // Unified PasscodeGate state
  const [passcodeGate, setPasscodeGate] = useState(null); // { title, message, onConfirm }

  // Class action menu (edit icon dropdown)
  const [classMenuId, setClassMenuId] = useState(null); // id of class whose menu is open
  const classMenuRef = useRef(null);

  useEffect(() => {
    if (!classMenuId) return;
    const handler = (e) => {
      if (classMenuRef.current && classMenuRef.current.contains(e.target)) return;
      setClassMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [classMenuId]);
  
  // States for View 1 (Student List)
  const [searchQuery, setSearchQuery] = useState("");
  const STUDENTS_PER_PAGE = 50;
  const [stuPage, setStuPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" or "edit"
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({});

  // State for View 2 (Student Detail)
  const [viewStudentDetail, setViewStudentDetail] = useState(null);

  // Time filters for stats
  const [viewYear, setViewYear] = useState(new Date().getFullYear().toString());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  const activeClass = useMemo(() => { setStuPage(1); return classes.find(c => c.id === selClassId); }, [classes, selClassId]);

  // Reset trang khi tìm kiếm
  React.useEffect(() => { setStuPage(1); }, [searchQuery]);

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


  // States cho xóa học sinh có passcode — dùng PasscodeGate chung
  const handleDelete = (studentId) => {
    setPasscodeGate({
      title: "Xóa học sinh",
      message: "Bạn chắc muốn xóa học sinh này? Hành động không thể hoàn tác.",
      onConfirm: () => {
        const updated = classes.map(c => {
          if (c.id !== selClassId) return c;
          return {
            ...c,
            students: c.students.filter(s => s.id !== studentId),
            sessions: (c.sessions || []).map(ses => ({
              ...ses,
              attendance: (ses.attendance || []).filter(id => id !== studentId),
              attendanceKem: (ses.attendanceKem || []).filter(id => id !== studentId)
            }))
          };
        });
        setClasses(updated);
        setPasscodeGate(null);
        // Nếu đang xem chi tiết học sinh vừa xóa → quay về danh sách
        if (viewStudentDetail && viewStudentDetail.id === studentId) {
          setViewStudentDetail(null);
          setStep(1);
        }
      }
    });
  };

  const openAddModal = () => {
      setModalMode("add");
      setFormData({ name: "", pricePerSession: 0, hasKem: false, kemPrice: 0, parentName: "", parentPhone: "", note: "", birthYear: "" });
      setShowModal(true);
  };

  const openEditModal = (student) => {
    const doOpen = () => {
      setModalMode("edit");
      setEditingStudent(student);
      setFormData({
          name: student.name,
          pricePerSession: student.pricePerSession,
          hasKem: !!student.hasKem,
          kemPrice: student.kemPrice || 0,
          parentName: student.parentName || "",
          parentPhone: student.parentPhone || "",
          note: student.note || "",
          birthYear: student.birthYear || "",
          inactive: !!student.inactive,
          inactiveMonth: student.inactiveMonth || null,
          inactiveYear: student.inactiveYear || null,
      });
      setShowModal(true);
    };

    if (passcodeUnlocked) { doOpen(); return; }

    setPasscodeGate({
      title: "Sửa thông tin học sinh",
      message: `Nhập passcode để sửa thông tin của "${student.name}"`,
      onConfirm: () => { setPasscodeGate(null); doOpen(); }
    });
  };

  const handleSave = () => {
      if (!formData.name.trim()) return;
      const price = parseInt(String(formData.pricePerSession).replace(/\D/g, "")) || 0;
      const kemPrice = parseInt(String(formData.kemPrice).replace(/\D/g, "")) || 0;

      const updated = classes.map(c => {
          if (c.id !== selClassId) return c;
          
          if (modalMode === "add") {
              // Tạo mã học viên: STT 2 chữ số + tên lớp, VD: 01E2019
              const nextNum = (c.students || []).length + 1;
              const studentCode = String(nextNum).padStart(2, '0') + c.name.replace(/\s+/g, '');

              const newStudent = {
                  id: Date.now().toString(),
                  studentCode,
                  name: formData.name.trim(),
                  pricePerSession: price,
                  hasKem: formData.hasKem,
                  kemPrice: formData.hasKem ? kemPrice : 0,
                  parentName: (formData.parentName || "").trim(),
                  parentPhone: (formData.parentPhone || "").trim(),
                  note: (formData.note || "").trim(),
                  birthYear: (formData.birthYear || "").trim(),
                  days: []
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
                      kemPrice: formData.hasKem ? kemPrice : 0,
                      parentName: (formData.parentName || "").trim(),
                      parentPhone: (formData.parentPhone || "").trim(),
                      note: (formData.note || "").trim(),
                      birthYear: (formData.birthYear || "").trim(),
                      inactive: !!formData.inactive,
                      inactiveMonth: formData.inactive ? (formData.inactiveMonth || new Date().getMonth()+1) : null,
                      inactiveYear: formData.inactive ? (formData.inactiveYear || new Date().getFullYear()) : null
                  })
              };
          }
      });
      
      setClasses(updated);
      setShowModal(false);
  };

  const addNewClass = () => {
    if (!newClassName.trim()) return;
    const name = newClassName.trim();
    const duplicate = classes.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) { alert(`❌ Tên lớp "${name}" đã tồn tại. Vui lòng chọn tên khác.`); return; }
    const cls = { id: Date.now().toString(), name, students: [], sessions: [] };
    setClasses([...classes, cls]);
    setNewClassName(""); setShowAddClass(false);
  };

  const handleRenameClass = () => {
    if (!editingClassName.trim()) return;
    const name = editingClassName.trim();
    const duplicate = classes.some(c => c.id !== editingClassId && c.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) { alert(`❌ Tên lớp "${name}" đã tồn tại. Vui lòng chọn tên khác.`); return; }
    // Kiểm tra có học sinh không → hiện cảnh báo mã thay đổi
    const cls = classes.find(c => c.id === editingClassId);
    if (cls && (cls.students || []).length > 0) {
      setShowConfirmRename(true);
    } else {
      doRenameClass(name);
    }
  };

  const doRenameClass = (name) => {
    const newShort = (name || editingClassName.trim()).replace(/\s+/g, '');
    const updated = classes.map(c => {
      if (c.id !== editingClassId) return c;
      // Cập nhật tên lớp + cấp lại mã học viên cho tất cả học sinh
      const updatedStudents = (c.students || []).map((s, idx) => ({
        ...s,
        studentCode: String(idx + 1).padStart(2, '0') + newShort
      }));
      return { ...c, name: name || editingClassName.trim(), students: updatedStudents };
    });
    setClasses(updated);
    setShowEditClass(false);
    setShowConfirmRename(false);
    setEditingClassId(null);
  };

  const openDeleteModal = (cls) => {
    setPasscodeGate({
      title: "Xóa lớp học",
      message: `Xóa lớp "${cls.name}"? Toàn bộ học sinh và điểm danh sẽ bị xóa vĩnh viễn.`,
      onConfirm: () => {
        const updated = classes.filter(c => c.id !== cls.id);
        setClasses(updated);
        setPasscodeGate(null);
      }
    });
  };

  // VIEW 0: LIST CLASSES (Added "Add Class" here)
  if (step === 0) {
    return (
      <div className="page-content">
        <div className="page-topbar">
          <div className="page-topbar-title">Danh Sách Học Sinh - Chọn Lớp</div>
          <button className="btn-add-primary" onClick={() => setShowAddClass(true)}>+ Thêm lớp</button>
        </div>
        {classes.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏫</div><div>Chưa có lớp nào</div></div> : null}
        <DraggableNavGrid
          items={classes}
          onReorder={next => { setClasses(next); }}
          renderItem={(c) => (
            <div style={{position:'relative'}}>
              <NavCard
                label={c.name}
                sub={`${(c.students || []).length} học sinh`}
                icon={<Icon name="school" />}
                onClick={() => { setSelClassId(c.id); setStep(1); }}
                onEdit={() => setClassMenuId(classMenuId === c.id ? null : c.id)}
              />
              {classMenuId === c.id && (
                <div ref={classMenuRef} style={{
                  position:'absolute', top:'100%', right:8, zIndex:50, marginTop:4,
                  background:'#fff', borderRadius:10, border:'1px solid #eff6ff',
                  boxShadow:'0 8px 24px rgba(79,127,255,0.18)', overflow:'hidden', minWidth:150
                }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => {
                    setEditingClassId(c.id); setEditingClassName(c.name);
                    setShowEditClass(true); setClassMenuId(null);
                  }} style={{
                    width:'100%', padding:'10px 16px', border:'none', background:'transparent',
                    display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                    fontSize:13, fontWeight:600, color:'#374151', textAlign:'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='#fff5f8'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <Icon name="edit" size={15}/> Đổi tên lớp
                  </button>
                  <div style={{height:1, background:'#eff6ff'}}/>
                  <button onClick={() => {
                    openDeleteModal(c); setClassMenuId(null);
                  }} style={{
                    width:'100%', padding:'10px 16px', border:'none', background:'transparent',
                    display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                    fontSize:13, fontWeight:600, color:'#ef4444', textAlign:'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <Icon name="trash" size={15}/> Xóa lớp
                  </button>
                </div>
              )}
            </div>
          )}
        />
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
        
        {/* Modal Rename Class */}
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

        {/* Modal xác nhận đổi tên — cảnh báo mã học viên thay đổi */}
        {showConfirmRename && (()=>{
          const cls = classes.find(c => c.id === editingClassId);
          const newShort = editingClassName.trim().replace(/\s+/g, '');
          const sampleOld = cls?.students?.[0]?.studentCode || ('01' + (cls?.name || '').replace(/\s+/g,''));
          const sampleNew = '01' + newShort;
          return (
            <div className="modal-overlay" onClick={() => setShowConfirmRename(false)}>
              <div className="modal-dialog" onClick={e => e.stopPropagation()}>
                <div className="modal-dialog-header" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>
                  ⚠️ Xác nhận đổi tên lớp
                </div>
                <div className="modal-dialog-body">
                  <div style={{textAlign:'center', marginBottom:16}}>
                    <div style={{fontSize:32, marginBottom:8}}>🔄</div>
                    <div style={{fontSize:14, color:'#374151', fontWeight:600}}>
                      Mã học viên của {cls?.students?.length || 0} học sinh sẽ được cấp lại
                    </div>
                  </div>
                  {(cls?.students?.length || 0) > 0 && (
                    <div style={{background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', fontSize:13}}>
                      <div style={{marginBottom:6}}>Ví dụ mã học viên sau khi đổi:</div>
                      <div style={{display:'flex', alignItems:'center', gap:10, fontFamily:'monospace', fontWeight:700}}>
                        <span style={{color:'#ef4444', textDecoration:'line-through'}}>{sampleOld}</span>
                        <span style={{color:'#9ca3af'}}>→</span>
                        <span style={{color:'#16a34a'}}>{sampleNew}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-dialog-footer">
                  <button className="btn-cancel" onClick={() => setShowConfirmRename(false)}>Huỷ</button>
                  <button className="btn-save" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}
                    onClick={() => doRenameClass(editingClassName.trim())}>
                    Xác nhận đổi tên
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* PasscodeGate — dùng chung cho xóa lớp và học sinh */}
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
                 <select className="form-input" style={{width:110}} value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))}>
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
              <colgroup>
                <col style={{width:52}}/>
                <col style={{width:72}}/>
                <col style={{width:200}}/>
                <col style={{width:90}}/>
                <col style={{width:110}}/>
                <col style={{width:110}}/>
                <col style={{width:90}}/>
                <col style={{width:110}}/>
                <col style={{width:110}}/>
              </colgroup>
              <thead>
                <tr>
                  <th className="center" rowSpan={2} style={{verticalAlign:'middle'}}>STT</th>
                  <th className="center" rowSpan={2} style={{verticalAlign:'middle', color:'#6b7280', fontSize:11}}>MÃ HV</th>
                  <th rowSpan={2} style={{verticalAlign:'middle'}}>HỌ VÀ TÊN</th>
                  <th className="center" colSpan={3} style={{background:'#dbeafe', color:'#1d4ed8', borderBottom:'2px solid #bfdbfe'}}>HỌC CHÍNH</th>
                  <th className="center" colSpan={3} style={{background:'#ede9fe', color:'#6d28d9', borderBottom:'2px solid #ddd6fe'}}>HỌC KÈM</th>
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
                {studentsWithStats.length === 0 ? (
                    <tr><td colSpan="10" className="center" style={{padding:20, color:'#9ca3af'}}>Không tìm thấy học sinh</td></tr>
                ) : (
                    studentsWithStats.slice((stuPage-1)*STUDENTS_PER_PAGE, stuPage*STUDENTS_PER_PAGE).map((s, i) => (
                        <tr key={s.id} className="student-row" onClick={() => {
                            setViewStudentDetail(s);
                            setStep(2);
                        }}>
                          <td className="center stt-cell">{(stuPage-1)*STUDENTS_PER_PAGE + i + 1}</td>
                          <td className="center" style={{fontSize:11, color:'#9ca3af', fontWeight:600}}>{s.studentCode || '—'}</td>
                          <td className="name-cell">
                            <span>{s.name}</span>
                            {s.inactive && (
                              <span style={{marginLeft:8, fontSize:11, fontWeight:600, color:'#ef4444', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:4, padding:'1px 6px'}}>
                                Nghỉ T{s.inactiveMonth || '?'}/{s.inactiveYear || '?'}
                              </span>
                            )}
                          </td>
                          <td className="center">{s.mainCount}</td>
                          <td className="right price-cell">{fmt(s.pricePerSession)}</td>
                          <td className="right" style={{fontWeight:700, color:'#1d4ed8'}}>{fmt(s.mainFee)}</td>
                          <td className="center">{s.hasKem ? s.kemCount : "-"}</td>
                          <td className="right price-cell">{s.hasKem ? fmt(s.kemPrice) : "-"}</td>
                          <td className="right" style={{fontWeight:700, color:'#6d28d9'}}>{s.hasKem ? fmt(s.kemFee) : <span style={{color:'#94a3b8'}}>-</span>}</td>

                        </tr>
                      ))
                )}
              </tbody>
            </table>
            {/* Phân trang học sinh */}
            {studentsWithStats.length > STUDENTS_PER_PAGE && (() => {
              const totalPages = Math.ceil(studentsWithStats.length / STUDENTS_PER_PAGE);
              return (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"14px 0 4px"}}>
                  <button onClick={()=>setStuPage(p=>Math.max(1,p-1))} disabled={stuPage===1}
                    style={{padding:"4px 12px",borderRadius:6,border:"1px solid #bfdbfe",background:stuPage===1?"#f3f4f6":"#eff6ff",color:stuPage===1?"#9ca3af":"#2563eb",fontWeight:600,cursor:stuPage===1?"default":"pointer",fontSize:13}}>
                    ‹ Trước
                  </button>
                  {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                    <button key={p} onClick={()=>setStuPage(p)}
                      style={{padding:"4px 10px",borderRadius:6,border:"1px solid",
                        borderColor:p===stuPage?"#4f7fff":"#bfdbfe",
                        background:p===stuPage?"#4f7fff":"#fff",
                        color:p===stuPage?"#fff":"#2563eb",
                        fontWeight:600,cursor:"pointer",fontSize:13,minWidth:32}}>
                      {p}
                    </button>
                  ))}
                  <button onClick={()=>setStuPage(p=>Math.min(totalPages,p+1))} disabled={stuPage===totalPages}
                    style={{padding:"4px 12px",borderRadius:6,border:"1px solid #bfdbfe",background:stuPage===totalPages?"#f3f4f6":"#eff6ff",color:stuPage===totalPages?"#9ca3af":"#2563eb",fontWeight:600,cursor:stuPage===totalPages?"default":"pointer",fontSize:13}}>
                    Sau ›
                  </button>
                  <span style={{fontSize:12,color:"#9ca3af",marginLeft:4}}>{stuPage}/{totalPages} — {studentsWithStats.length} học sinh</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Modal Add/Edit Student */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-dialog-header">{modalMode === "add" ? "Thêm học sinh mới" : "Sửa thông tin"}</div>
              <div className="modal-dialog-body">
                {modalMode === "edit" && editingStudent?.studentCode && (
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:12, padding:'6px 10px', background:'#f8fafc', borderRadius:6, border:'1px solid #e2e8f0'}}>
                    Mã học viên: <b style={{color:'#4f7fff'}}>{editingStudent.studentCode}</b>
                  </div>
                )}
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

                {/* Thông tin học sinh */}
                <div style={{margin: '18px 0 10px', paddingTop: 14, borderTop: '1.5px solid #bfdbfe'}}>
                  <div style={{fontSize: 13, fontWeight: 700, color: '#4f7fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                    🎓 Thông tin học sinh
                  </div>
                  <label className="form-label">Năm sinh</label>
                  <input className="form-input" value={formData.birthYear || ""}
                    placeholder="VD: 2015"
                    maxLength={4}
                    onChange={e => setFormData(f => ({ ...f, birthYear: e.target.value.replace(/\D/g,'') }))} />
                </div>

                {/* Thông tin phụ huynh */}
                <div style={{margin: '18px 0 10px', paddingTop: 14, borderTop: '1.5px solid #bfdbfe'}}>
                  <div style={{fontSize: 13, fontWeight: 700, color: '#4f7fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                    👨‍👩‍👧 Thông tin phụ huynh
                  </div>
                  <label className="form-label">Tên phụ huynh</label>
                  <input className="form-input" value={formData.parentName || ""}
                    placeholder="VD: Nguyễn Văn A"
                    onChange={e => setFormData(f => ({ ...f, parentName: e.target.value }))} />
                  <label className="form-label" style={{ marginTop: 10 }}>Số điện thoại</label>
                  <input className="form-input" value={formData.parentPhone || ""}
                    placeholder="VD: 0912 345 678"
                    onChange={e => setFormData(f => ({ ...f, parentPhone: e.target.value }))} />
                  <label className="form-label" style={{ marginTop: 10 }}>Ghi chú</label>
                  <textarea className="form-input" value={formData.note || ""}
                    placeholder="Ghi chú thêm về học sinh..."
                    rows={3}
                    style={{resize: 'vertical', fontFamily: 'inherit'}}
                    onChange={e => setFormData(f => ({ ...f, note: e.target.value }))} />
                </div>

                {/* Trạng thái nghỉ học — chỉ hiện khi sửa */}
                {modalMode === "edit" && (
                  <div style={{marginTop:18, paddingTop:14, borderTop:'1.5px solid #bfdbfe'}}>
                    <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:10}}>
                      <input type="checkbox" checked={!!formData.inactive}
                        onChange={e => setFormData(f => ({
                          ...f,
                          inactive: e.target.checked,
                          inactiveMonth: e.target.checked ? (f.inactiveMonth || (new Date().getMonth()+1)) : null,
                          inactiveYear:  e.target.checked ? (f.inactiveYear  || new Date().getFullYear())  : null,
                        }))}
                        style={{width:16, height:16, accentColor:'#ef4444'}} />
                      <span style={{fontSize:14, fontWeight:600, color: formData.inactive ? '#ef4444' : '#374151'}}>
                        🚫 Đã nghỉ học
                      </span>
                    </label>
                    {formData.inactive && (
                      <div style={{marginLeft:26}}>
                        <div style={{fontSize:12, color:'#6b7280', marginBottom:8}}>
                          Nghỉ từ tháng — sẽ ẩn khỏi Điểm Danh &amp; Học Phí từ tháng này trở đi:
                        </div>
                        <div style={{display:'flex', gap:10, alignItems:'center'}}>
                          <select className="form-input" style={{width:120}}
                            value={formData.inactiveMonth || new Date().getMonth()+1}
                            onChange={e => setFormData(f => ({...f, inactiveMonth: parseInt(e.target.value)}))}>
                            {[...Array(12)].map((_,i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                          </select>
                          <select className="form-input" style={{width:100}}
                            value={formData.inactiveYear || new Date().getFullYear()}
                            onChange={e => setFormData(f => ({...f, inactiveYear: parseInt(e.target.value)}))}>
                            {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <div style={{fontSize:12, color:'#ef4444', marginTop:8}}>
                          Từ tháng {formData.inactiveMonth || new Date().getMonth()+1}/{formData.inactiveYear || new Date().getFullYear()} trở đi sẽ không xuất hiện.
                          Dữ liệu các tháng trước vẫn giữ nguyên.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-dialog-footer">
                <button className="btn-cancel" onClick={() => setShowModal(false)}>Huỷ</button>
                <button className="btn-save" onClick={handleSave}>{modalMode === "add" ? "Thêm" : "Lưu"}</button>
              </div>
            </div>
          </div>
        )}

        {/* PasscodeGate — xóa học sinh */}
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
  if (step === 2 && activeClass && viewStudentDetail) {
    // Always use the latest data from activeClass (in case user edited the student)
    const liveStudent = (activeClass.students || []).find(s => s.id === viewStudentDetail.id) || viewStudentDetail;
    // Filter sessions for the selected month/year
    const studentSessions = (activeClass.sessions || []).filter(ses => {
        if (!ses.date) return false;
        const [y, m] = ses.date.split("-");
        return y === viewYear && parseInt(m) === viewMonth;
    }).sort((a,b) => a.date.localeCompare(b.date)); // Sort by date ascending

    const mainCount = studentSessions.filter(ses => (ses.attendance || []).includes(liveStudent.id)).length;
    const kemCount = studentSessions.filter(ses => (ses.attendanceKem || []).includes(liveStudent.id)).length;

    return (
      <>
        <div className="page-content">
             <div className="page-topbar">
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <button className="btn-back" onClick={() => setStep(1)}>‹ Quay lại</button>
                    <div className="page-topbar-title">{liveStudent.name} - Chi tiết tháng {viewMonth}/{viewYear}</div>
                </div>
                <div style={{display:'flex', gap:8}}>
                    <button className="stu-detail-btn stu-detail-edit" onClick={() => openEditModal(liveStudent)}>
                      <Icon name="edit" size={15}/> Sửa thông tin
                    </button>
                    <button className="stu-detail-btn stu-detail-del" onClick={() => handleDelete(liveStudent.id)}>
                      <Icon name="trash" size={15}/> Xóa học sinh
                    </button>
                </div>
             </div>

             {/* Thông tin học sinh & phụ huynh */}
             <div style={{margin: '0 32px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16}}>
                {/* Card học sinh */}
                <div style={{background:'#fff', borderRadius:16, padding:'20px 24px', border:'1px solid #eff6ff', boxShadow:'0 1px 4px rgba(79,127,255,0.08)'}}>
                  <div style={{fontSize:12, fontWeight:700, color:'#4f7fff', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14}}>📚 Thông tin học phí</div>

                  {/* Nhóm HỌC CHÍNH */}
                  <div style={{background:'#eff6ff', borderRadius:10, padding:'10px 14px', marginBottom: liveStudent.hasKem ? 10 : 0}}>
                    <div style={{fontSize:11, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8}}>🎓 Học chính</div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
                        <span style={{color:'#9ca3af'}}>Số buổi</span>
                        <span style={{fontWeight:600, color:'#1f2937'}}>{mainCount} buổi</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
                        <span style={{color:'#9ca3af'}}>HP / buổi</span>
                        <span style={{fontWeight:600, color:'#1f2937'}}>{fmt(liveStudent.pricePerSession || 0)} đ</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:13, paddingTop:6, borderTop:'1px dashed #bfdbfe'}}>
                        <span style={{color:'#1d4ed8', fontWeight:600}}>Tổng HP chính</span>
                        <span style={{fontWeight:700, color:'#1d4ed8'}}>{fmt(mainCount * (liveStudent.pricePerSession || 0))} đ</span>
                      </div>
                    </div>
                  </div>

                  {/* Nhóm HỌC KÈM */}
                  {liveStudent.hasKem && (
                    <div style={{background:'#f5f3ff', borderRadius:10, padding:'10px 14px', marginBottom:10}}>
                      <div style={{fontSize:11, fontWeight:700, color:'#6d28d9', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8}}>📖 Học kèm</div>
                      <div style={{display:'flex', flexDirection:'column', gap:6}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
                          <span style={{color:'#9ca3af'}}>Số buổi</span>
                          <span style={{fontWeight:600, color:'#1f2937'}}>{kemCount} buổi</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
                          <span style={{color:'#9ca3af'}}>HP / buổi</span>
                          <span style={{fontWeight:600, color:'#1f2937'}}>{fmt(liveStudent.kemPrice || 0)} đ</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:13, paddingTop:6, borderTop:'1px dashed #ddd6fe'}}>
                          <span style={{color:'#6d28d9', fontWeight:600}}>Tổng HP kèm</span>
                          <span style={{fontWeight:700, color:'#6d28d9'}}>{fmt(kemCount * (liveStudent.kemPrice || 0))} đ</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tổng cộng */}
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:15, paddingTop:10, borderTop:'2px solid #eff6ff', marginTop:4}}>
                    <span style={{color:'#374151', fontWeight:700}}>Tổng tháng {viewMonth}</span>
                    <span style={{fontWeight:800, color:'#4f7fff', fontSize:16}}>
                      {fmt((mainCount * (liveStudent.pricePerSession || 0)) + (kemCount * (liveStudent.kemPrice || 0)))} đ
                    </span>
                  </div>
                </div>

                {/* Card thông tin học sinh */}
                <div style={{background:'#fff', borderRadius:16, padding:'20px 24px', border:'1px solid #eff6ff', boxShadow:'0 1px 4px rgba(79,127,255,0.08)'}}>
                  <div style={{fontSize:12, fontWeight:700, color:'#4f7fff', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14}}>🎓 Thông tin học sinh</div>
                  <div style={{display:'flex', flexDirection:'column', gap:10}}>
                    <div style={{display:'flex', gap:10, alignItems:'center'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:72}}>Mã HV</span>
                      <span style={{fontSize:13, fontWeight:700, color:'#4f7fff'}}>{liveStudent.studentCode || '—'}</span>
                    </div>
                    <div style={{display:'flex', gap:10, alignItems:'center'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:72}}>Họ tên</span>
                      <span style={{fontSize:14, fontWeight:700, color:'#1f2937'}}>{liveStudent.name}</span>
                    </div>
                    <div style={{display:'flex', gap:10, alignItems:'center'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:72}}>Lớp</span>
                      <span style={{fontSize:13, fontWeight:600, color:'#1f2937'}}>{activeClass.name}</span>
                    </div>
                    <div style={{display:'flex', gap:10, alignItems:'center'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:72}}>Năm sinh</span>
                      <span style={{fontSize:13, fontWeight:600, color:'#1f2937'}}>
                        {liveStudent.birthYear || <span style={{color:'#d1d5db', fontStyle:'italic'}}>Chưa có</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card phụ huynh */}
                <div style={{background:'#fff', borderRadius:16, padding:'20px 24px', border:'1px solid #eff6ff', boxShadow:'0 1px 4px rgba(79,127,255,0.08)'}}>
                  <div style={{fontSize:12, fontWeight:700, color:'#4f7fff', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14}}>👨‍👩‍👧 Thông tin phụ huynh</div>
                  <div style={{display:'flex', flexDirection:'column', gap:10}}>
                    <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:60}}>Họ tên</span>
                      <span style={{fontSize:13, fontWeight:600, color:'#1f2937', flex:1}}>
                        {liveStudent.parentName || <span style={{color:'#d1d5db', fontStyle:'italic'}}>Chưa có</span>}
                      </span>
                    </div>
                    <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:60}}>SĐT</span>
                      <span style={{fontSize:13, fontWeight:600, color:'#1f2937', flex:1}}>
                        {liveStudent.parentPhone
                          ? <a href={`tel:${liveStudent.parentPhone}`} style={{color:'#2563eb', textDecoration:'none'}}>{liveStudent.parentPhone}</a>
                          : <span style={{color:'#d1d5db', fontStyle:'italic'}}>Chưa có</span>}
                      </span>
                    </div>
                    <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                      <span style={{fontSize:13, color:'#9ca3af', minWidth:60}}>Ghi chú</span>
                      <span style={{fontSize:13, color:'#374151', flex:1, lineHeight:1.5}}>
                        {liveStudent.note || <span style={{color:'#d1d5db', fontStyle:'italic'}}>Không có</span>}
                      </span>
                    </div>
                  </div>
                </div>
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
                                    const isMain = (ses.attendance || []).includes(liveStudent.id);
                                    const isKem = (ses.attendanceKem || []).includes(liveStudent.id);
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

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-dialog-header">Sửa thông tin</div>
              <div className="modal-dialog-body">
                {editingStudent?.studentCode && (
                  <div style={{fontSize:12,color:'#6b7280',marginBottom:12,padding:'6px 10px',background:'#f8fafc',borderRadius:6,border:'1px solid #e2e8f0'}}>
                    Mã học viên: <b style={{color:'#4f7fff'}}>{editingStudent.studentCode}</b>
                  </div>
                )}
                <label className="form-label">Tên học sinh</label>
                <input className="form-input" autoFocus value={formData.name || ""}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSave()} />
                <label className="form-label" style={{marginTop:14}}>Học phí / buổi chính (VND)</label>
                <input className="form-input" type="number" value={formData.pricePerSession || ""}
                  onChange={e => setFormData(f => ({ ...f, pricePerSession: e.target.value }))} />
                <div style={{marginTop:16,display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" id="chkKemStep2" style={{width:16,height:16}} checked={!!formData.hasKem}
                    onChange={e => setFormData(f => ({ ...f, hasKem: e.target.checked }))} />
                  <label htmlFor="chkKemStep2" style={{fontSize:14,fontWeight:500,color:'#374151',cursor:'pointer'}}>Học sinh có học kèm</label>
                </div>
                {formData.hasKem && (<>
                  <label className="form-label" style={{marginTop:10}}>Học phí / buổi kèm (VND)</label>
                  <input className="form-input" type="number" value={formData.kemPrice || ""}
                    onChange={e => setFormData(f => ({ ...f, kemPrice: e.target.value }))} />
                </>)}
                <div style={{margin:'18px 0 10px',paddingTop:14,borderTop:'1.5px solid #bfdbfe'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#4f7fff',marginBottom:12}}>🎓 Thông tin học sinh</div>
                  <label className="form-label">Năm sinh</label>
                  <input className="form-input" value={formData.birthYear || ""} placeholder="VD: 2015" maxLength={4}
                    onChange={e => setFormData(f => ({ ...f, birthYear: e.target.value.replace(/\D/g,'') }))} />
                </div>
                <div style={{margin:'18px 0 10px',paddingTop:14,borderTop:'1.5px solid #bfdbfe'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#4f7fff',marginBottom:12}}>👨‍👩‍👧 Thông tin phụ huynh</div>
                  <label className="form-label">Tên phụ huynh</label>
                  <input className="form-input" value={formData.parentName || ""} placeholder="VD: Nguyễn Văn A"
                    onChange={e => setFormData(f => ({ ...f, parentName: e.target.value }))} />
                  <label className="form-label" style={{marginTop:10}}>Số điện thoại</label>
                  <input className="form-input" value={formData.parentPhone || ""} placeholder="VD: 0912 345 678"
                    onChange={e => setFormData(f => ({ ...f, parentPhone: e.target.value }))} />
                  <label className="form-label" style={{marginTop:10}}>Ghi chú</label>
                  <textarea className="form-input" value={formData.note || ""} rows={3}
                    style={{resize:'vertical',fontFamily:'inherit'}}
                    onChange={e => setFormData(f => ({ ...f, note: e.target.value }))} />
                </div>
                <div style={{marginTop:18,paddingTop:14,borderTop:'1.5px solid #bfdbfe'}}>
                  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',marginBottom:10}}>
                    <input type="checkbox" checked={!!formData.inactive}
                      onChange={e => setFormData(f => ({
                        ...f, inactive: e.target.checked,
                        inactiveMonth: e.target.checked ? (f.inactiveMonth || (new Date().getMonth()+1)) : null,
                        inactiveYear:  e.target.checked ? (f.inactiveYear  || new Date().getFullYear())  : null,
                      }))}
                      style={{width:16,height:16,accentColor:'#ef4444'}} />
                    <span style={{fontSize:14,fontWeight:600,color:formData.inactive?'#ef4444':'#374151'}}>🚫 Đã nghỉ học</span>
                  </label>
                  {formData.inactive && (
                    <div style={{marginLeft:26}}>
                      <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>Nghỉ từ tháng (ẩn từ tháng này trở đi):</div>
                      <div style={{display:'flex',gap:10}}>
                        <select className="form-input" style={{width:120}}
                          value={formData.inactiveMonth || new Date().getMonth()+1}
                          onChange={e => setFormData(f => ({...f,inactiveMonth:parseInt(e.target.value)}))}>
                          {[...Array(12)].map((_,i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                        </select>
                        <select className="form-input" style={{width:100}}
                          value={formData.inactiveYear || new Date().getFullYear()}
                          onChange={e => setFormData(f => ({...f,inactiveYear:parseInt(e.target.value)}))}>
                          {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div style={{fontSize:12,color:'#ef4444',marginTop:6}}>
                        Dữ liệu trước tháng {formData.inactiveMonth || new Date().getMonth()+1}/{formData.inactiveYear || new Date().getFullYear()} vẫn giữ nguyên.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-dialog-footer">
                <button className="btn-cancel" onClick={() => setShowModal(false)}>Huỷ</button>
                <button className="btn-save" onClick={handleSave}>Lưu</button>
              </div>
            </div>
          </div>
        )}
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
      </>
    );
  }

  return null;
}