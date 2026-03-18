// ─────────────────────────────────────────────────────────────────
// ADMIN PAGE — Quản lý tài khoản
// ─────────────────────────────────────────────────────────────────

function AdminPage({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form thêm tài khoản
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Reveal password
  const [revealedIds, setRevealedIds] = useState({});
  const [adminVerified, setAdminVerified] = useState(false);

  // Auth gate modal — dùng cho xem pwd / sửa / xóa
  const [authGate, setAuthGate] = useState(null); // { title, onVerified }
  const [authPwd, setAuthPwd] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Edit modal
  const [editingAcc, setEditingAcc] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPwd, setEditPwd] = useState("");
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState("");

  const ACCOUNTS_PER_PAGE = 20;
  const [accPage, setAccPage] = useState(1);

  const isAdmin = user && user.email && user.email.toLowerCase() === SUPER_ADMIN;

  useEffect(() => {
    if (!isAdmin) return;
    loadAllowedEmails().then(list => { setAccounts(list); setLoading(false); });
  }, []);

  // ── Xác thực admin password ──
  const requireAuth = (title, onVerified) => {
    if (adminVerified) { onVerified(); return; }
    setAuthGate({ title, onVerified });
    setAuthPwd(""); setAuthErr("");
  };

  const handleAuthSubmit = async () => {
    if (!authPwd) { setAuthErr("Vui lòng nhập mật khẩu"); return; }
    setAuthLoading(true); setAuthErr("");
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, authPwd);
      await window.auth.currentUser.reauthenticateWithCredential(credential);
      setAdminVerified(true);
      const cb = authGate.onVerified;
      setAuthGate(null); setAuthPwd("");
      cb();
    } catch {
      setAuthErr("Mật khẩu không đúng");
    }
    setAuthLoading(false);
  };

  // ── Thêm tài khoản ──
  const handleAdd = async () => {
    const em = newEmail.trim().toLowerCase();
    const pw = newPassword.trim();
    if (!em || !pw) { setFormError("Vui lòng nhập đầy đủ email và mật khẩu"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setFormError("Email không hợp lệ"); return; }
    if (pw.length < 6) { setFormError("Mật khẩu phải có ít nhất 6 ký tự"); return; }
    if (accounts.find(a => a.email === em)) { setFormError("Email này đã tồn tại"); return; }
    setAdding(true); setFormError(""); setFormSuccess("");
    try {
      const result = await adminCreateUser(em, pw);
      await addUserAccount(em, pw, user.email, result.localId, result.idToken);
      setAccounts(prev => [...prev, { email: em, pwd: obfuscate(pw), uid: result.localId, addedBy: user.email, addedAt: new Date().toISOString() }]);
      setNewEmail(""); setNewPassword("");
      setFormSuccess(`✅ Đã tạo tài khoản ${em}`);
      setTimeout(() => setFormSuccess(""), 4000);
    } catch(e) {
      const msgs = { "EMAIL_EXISTS": "Email đã có tài khoản Firebase", "INVALID_EMAIL": "Email không hợp lệ" };
      setFormError(msgs[e.message] || "Lỗi: " + e.message);
    }
    setAdding(false);
  };

  // ── Xóa tài khoản (yêu cầu xác thực) ──
  const handleRemove = (acc) => {
    if (acc.email === SUPER_ADMIN) { alert("Không thể xóa tài khoản admin chính!"); return; }
    requireAuth(`Xác nhận xóa tài khoản "${acc.email}"`, async () => {
      try {
        await removeAllowedEmail(acc.email);
        if (acc.uid && acc.pwd) {
          try {
            const apiKey = "AIzaSyApsLv_N7Je30jz6CRxKX8PmsHyEY5Z4h0";
            const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: acc.email, password: deobfuscate(acc.pwd || ""), returnSecureToken: true })
            });
            const signInData = await signInRes.json();
            if (signInData.idToken) {
              await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: signInData.idToken })
              });
            }
          } catch(e2) { console.warn("Could not delete Firebase Auth user:", e2); }
        }
        setAccounts(prev => prev.filter(a => a.email !== acc.email));
        setFormSuccess(`✅ Đã xóa tài khoản ${acc.email}`);
        setTimeout(() => setFormSuccess(""), 3000);
      } catch(e) { setFormError("Lỗi khi xóa: " + e.message); }
    });
  };

  // ── Mở modal sửa (yêu cầu xác thực) ──
  const openEdit = (acc) => {
    requireAuth(`Xác nhận sửa tài khoản "${acc.email}"`, () => {
      setEditingAcc(acc);
      setEditEmail(acc.email);
      setEditPwd(deobfuscate(acc.pwd || ""));
      setEditErr(""); setShowEditPwd(false);
    });
  };

  // ── Lưu sửa tài khoản ──
  const handleEditSave = async () => {
    const newEm = editEmail.trim().toLowerCase();
    const newPw = editPwd.trim();
    if (!newEm || !newPw) { setEditErr("Vui lòng điền đầy đủ"); return; }
    if (newPw.length < 6) { setEditErr("Mật khẩu phải ít nhất 6 ký tự"); return; }
    setEditLoading(true); setEditErr("");
    try {
      const apiKey = "AIzaSyApsLv_N7Je30jz6CRxKX8PmsHyEY5Z4h0";
      // Đăng nhập lại bằng mật khẩu cũ để lấy idToken
      const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editingAcc.email, password: deobfuscate(editingAcc.pwd || ""), returnSecureToken: true })
      });
      const signInData = await signInRes.json();
      if (!signInData.idToken) throw new Error("Không thể đăng nhập tài khoản này");

      // Cập nhật mật khẩu
      const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: signInData.idToken, password: newPw, returnSecureToken: true })
      });
      const updateData = await updateRes.json();
      if (updateData.error) throw new Error(updateData.error.message);

      // Cập nhật Firestore
      const id = editingAcc.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
      await window.db.collection("allowedEmails").doc(id).update({
        pwd: obfuscate(newPw),
        updatedAt: new Date().toISOString()
      });

      setAccounts(prev => prev.map(a => a.email === editingAcc.email
        ? { ...a, pwd: obfuscate(newPw) }
        : a
      ));
      setEditingAcc(null);
      setFormSuccess(`✅ Đã cập nhật mật khẩu cho ${editingAcc.email}`);
      setTimeout(() => setFormSuccess(""), 4000);
    } catch(e) {
      setEditErr("Lỗi: " + e.message);
    }
    setEditLoading(false);
  };

  // ── Xem/ẩn mật khẩu ──
  const handleReveal = (acc) => {
    if (revealedIds[acc.email]) { setRevealedIds(p => ({...p, [acc.email]: false})); return; }
    requireAuth(`Xem mật khẩu của "${acc.email}"`, () => {
      setRevealedIds(p => ({...p, [acc.email]: true}));
    });
  };

  if (!isAdmin) return (
    <div className="page-content">
      <div style={{textAlign:"center",padding:80}}>
        <div style={{fontSize:48,marginBottom:16}}>🚫</div>
        <div style={{fontSize:18,fontWeight:700,color:"#ef4444"}}>Không có quyền truy cập</div>
      </div>
    </div>
  );

  const totalPages = Math.ceil(accounts.length / ACCOUNTS_PER_PAGE);
  const pageAccounts = accounts.slice((accPage-1)*ACCOUNTS_PER_PAGE, accPage*ACCOUNTS_PER_PAGE);

  return (
    <div className="page-content">
      <div className="page-topbar">
        <div className="page-topbar-title">🔐 Quản Lý Tài Khoản</div>
        <div style={{fontSize:13,color:"#64748b"}}>{accounts.length + 1} tài khoản</div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"0 28px"}}>

        {/* Form thêm */}
        <div className="form-card">
          <h3>➕ Thêm tài khoản mới</h3>
          <p style={{color:"#64748b",fontSize:13,marginBottom:16}}>Tài khoản được tạo ở đây mới có thể đăng nhập vào hệ thống.</p>
          <div style={{marginBottom:12}}>
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="email@example.com"
              value={newEmail} onChange={e=>{setNewEmail(e.target.value);setFormError("");}} />
          </div>
          <div style={{marginBottom:16}}>
            <label className="form-label">Mật khẩu</label>
            <div style={{position:"relative"}}>
              <input className="form-input" type={showNewPwd?"text":"password"} placeholder="Tối thiểu 6 ký tự"
                value={newPassword} onChange={e=>{setNewPassword(e.target.value);setFormError("");}}
                onKeyDown={e=>e.key==="Enter"&&handleAdd()} style={{paddingRight:44}} />
              <button type="button" onClick={()=>setShowNewPwd(v=>!v)} style={{
                position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:18,padding:0
              }}>{showNewPwd?"🙈":"👁️"}</button>
            </div>
          </div>
          {formError && <div style={{color:"#ef4444",fontSize:13,marginBottom:10,padding:"7px 12px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>⚠️ {formError}</div>}
          {formSuccess && <div style={{fontSize:13,marginBottom:10,padding:"7px 12px",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0"}}>{formSuccess}</div>}
          <button className="btn-save" style={{width:"100%",height:44,fontSize:14}} onClick={handleAdd} disabled={adding}>
            {adding ? "⏳ Đang tạo..." : "+ Thêm tài khoản"}
          </button>
        </div>

        {/* Danh sách */}
        <div className="form-card">
          <h3>📋 Danh sách tài khoản ({loading ? "..." : accounts.length + 1})</h3>
          <p style={{color:"#64748b",fontSize:13,marginBottom:16}}>Nhấn 👁️ để xem mật khẩu · ✏️ sửa · 🗑️ xóa — đều cần xác minh mật khẩu.</p>

          {/* Super admin row */}
          <div className="admin-acc-row">
            <div className="admin-acc-info">
              <div className="admin-acc-avatar">A</div>
              <div>
                <div className="admin-acc-email">{SUPER_ADMIN}</div>
                <div className="admin-acc-meta">Super Admin</div>
              </div>
            </div>
            <div className="admin-acc-actions">
              <span style={{fontSize:12,background:"#eff6ff",color:"#3b6ff0",padding:"4px 12px",borderRadius:999,fontWeight:700,border:"1px solid #c7d9ff"}}>Admin</span>
            </div>
          </div>

          {loading ? (
            <div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>Đang tải...</div>
          ) : accounts.length === 0 ? (
            <div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>Chưa có tài khoản nào</div>
          ) : (
            <>
              {pageAccounts.map(acc => {
                const isRevealed = revealedIds[acc.email];
                const decodedPwd = isRevealed ? deobfuscate(acc.pwd || "") : null;
                const avatar = acc.email[0].toUpperCase();
                return (
                  <div key={acc.email} className="admin-acc-row">
                    <div className="admin-acc-info">
                      <div className="admin-acc-avatar">{avatar}</div>
                      <div style={{minWidth:0}}>
                        <div className="admin-acc-email">{acc.email}</div>
                        <div className="admin-acc-meta">
                          Thêm bởi {acc.addedBy} · {acc.addedAt ? new Date(acc.addedAt).toLocaleDateString("vi-VN") : ""}
                        </div>
                      </div>
                    </div>
                    <div className="admin-acc-actions">
                      {/* Pwd chip */}
                      <div className="admin-pwd-chip">
                        <span className="admin-pwd-text">{isRevealed ? decodedPwd : "••••••••"}</span>
                        <button className="admin-pwd-eye" onClick={() => handleReveal(acc)} title={isRevealed?"Ẩn":"Xem mật khẩu"}>
                          {isRevealed ? "🙈" : "👁️"}
                        </button>
                      </div>
                      {/* Edit */}
                      <button className="admin-btn admin-btn-edit" onClick={() => openEdit(acc)} title="Sửa">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {/* Delete */}
                      <button className="admin-btn admin-btn-del" onClick={() => handleRemove(acc)} title="Xóa">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="stu-pagination" style={{marginTop:12}}>
                  <button className="stu-page-btn" onClick={()=>setAccPage(p=>Math.max(1,p-1))} disabled={accPage===1}>‹ Trước</button>
                  {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                    <button key={p} className={"stu-page-btn"+(p===accPage?" active":"")} onClick={()=>setAccPage(p)}>{p}</button>
                  ))}
                  <button className="stu-page-btn" onClick={()=>setAccPage(p=>Math.min(totalPages,p+1))} disabled={accPage===totalPages}>Sau ›</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── AUTH GATE MODAL ── */}
      {authGate && (
        <div className="modal-overlay" onClick={()=>{setAuthGate(null);setAuthPwd("");setAuthErr("");}}>
          <div className="modal-dialog" onClick={e=>e.stopPropagation()}>
            <div className="modal-dialog-header">🔑 Xác minh danh tính</div>
            <div className="modal-dialog-body">
              <div style={{textAlign:"center",marginBottom:18}}>
                <div style={{fontSize:36,marginBottom:8}}>🔐</div>
                <div style={{fontSize:14,color:"#374151",fontWeight:600}}>{authGate.title}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Nhập mật khẩu tài khoản admin để tiếp tục</div>
              </div>
              <label className="form-label">Mật khẩu Admin</label>
              <input className="form-input" type="password" autoFocus
                placeholder="Nhập mật khẩu đăng nhập của bạn"
                value={authPwd}
                onChange={e=>{setAuthPwd(e.target.value);setAuthErr("");}}
                onKeyDown={e=>e.key==="Enter"&&handleAuthSubmit()}
                style={{borderColor:authErr?"#ef4444":undefined}} />
              {authErr && <div style={{color:"#ef4444",fontSize:13,marginTop:6,fontWeight:600}}>❌ {authErr}</div>}
            </div>
            <div className="modal-dialog-footer">
              <button className="btn-cancel" onClick={()=>{setAuthGate(null);setAuthPwd("");setAuthErr("");}}>Huỷ</button>
              <button className="btn-save" onClick={handleAuthSubmit} disabled={authLoading}>
                {authLoading ? "Đang kiểm tra..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editingAcc && (
        <div className="modal-overlay" onClick={()=>setEditingAcc(null)}>
          <div className="modal-dialog" onClick={e=>e.stopPropagation()}>
            <div className="modal-dialog-header">✏️ Sửa tài khoản</div>
            <div className="modal-dialog-body">
              <div style={{fontSize:12,color:"#64748b",marginBottom:16,padding:"8px 12px",background:"#f8faff",borderRadius:8,border:"1px solid #e2e8f0"}}>
                Tài khoản: <b style={{color:"#3b6ff0"}}>{editingAcc.email}</b>
              </div>
              <label className="form-label">Mật khẩu mới</label>
              <div style={{position:"relative"}}>
                <input className="form-input" type={showEditPwd?"text":"password"}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  value={editPwd}
                  onChange={e=>{setEditPwd(e.target.value);setEditErr("");}}
                  onKeyDown={e=>e.key==="Enter"&&handleEditSave()}
                  style={{paddingRight:44, borderColor:editErr?"#ef4444":undefined}} />
                <button type="button" onClick={()=>setShowEditPwd(v=>!v)} style={{
                  position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:18,padding:0
                }}>{showEditPwd?"🙈":"👁️"}</button>
              </div>
              {editErr && <div style={{color:"#ef4444",fontSize:13,marginTop:8,fontWeight:600}}>⚠️ {editErr}</div>}
              <div style={{marginTop:14,padding:"10px 14px",background:"#fffbeb",borderRadius:8,border:"1px solid #fde68a",fontSize:12,color:"#92400e"}}>
                ⚠️ Sau khi đổi mật khẩu, tài khoản này cần đăng nhập lại bằng mật khẩu mới.
              </div>
            </div>
            <div className="modal-dialog-footer">
              <button className="btn-cancel" onClick={()=>setEditingAcc(null)}>Huỷ</button>
              <button className="btn-save" onClick={handleEditSave} disabled={editLoading}>
                {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}