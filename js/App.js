// ─────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────

// ─── ADMIN HEADER MENU ───
function AdminHeaderMenu({ user, handleLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const avatar = (user.email || "A")[0].toUpperCase();
  return (
    <div className="header-user-wrap" ref={ref}>
      <button className="header-avatar-btn" onClick={() => setOpen(o => !o)} title="Tài khoản">
        <span className="header-user-avatar">{avatar}</span>
      </button>
      {open && (
        <div className="header-dropdown">
          <div className="header-dropdown-user">
            <div className="header-dropdown-avatar">{avatar}</div>
            <div className="header-dropdown-info">
              <div className="header-dropdown-name">Super Admin</div>
              <div className="header-dropdown-email">{user.email}</div>
            </div>
          </div>
          <div className="header-dropdown-divider"/>
          <button className="header-dropdown-item danger" onClick={() => { setOpen(false); handleLogout(); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

// ─── HEADER USER DROPDOWN MENU ───
function HeaderUserMenu({ user, page, navigate, handleLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayName = user.displayName || user.email || "?";
  const avatar = displayName[0].toUpperCase();

  return (
    <div className="header-right">
      <div className="header-user-wrap" ref={ref}>
        <button className="header-avatar-btn" onClick={() => setOpen(o => !o)} title="Tài khoản">
          <span className="header-user-avatar">{avatar}</span>
        </button>
        {open && (
          <div className="header-dropdown">
            <div className="header-dropdown-user">
              <div className="header-dropdown-avatar">{avatar}</div>
              <div className="header-dropdown-info">
                <div className="header-dropdown-name">{user.displayName || "Người dùng"}</div>
                <div className="header-dropdown-email">{user.email}</div>
              </div>
            </div>
            <div className="header-dropdown-divider"/>
            <button className="header-dropdown-item" onClick={() => { setOpen(false); navigate("#/profile"); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Hồ Sơ của tôi
            </button>
            <button className="header-dropdown-item" onClick={() => { setOpen(false); navigate("#/data"); }}>
              <Icon name="database" size={15}/> Quản lý dữ liệu
            </button>
            <div className="header-dropdown-divider"/>
            <button className="header-dropdown-item danger" onClick={() => { setOpen(false); handleLogout(); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [classes, setClasses] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const { hash, navigate } = useHashRouter();
  const { parts } = parseHash(hash);

  const page = parts[0] || "home";

  // Auth state listener + whitelist check
  const prevUidRef = useRef(null);

  useEffect(() => {
    const unsub = window.auth.onAuthStateChanged(async u => {
      if (u) {
        const allowed = await isEmailAllowed(u.email);
        if (!allowed) {
          await window.auth.signOut();
          setAccessDenied(true);
          setUser(null);
          localStorage.clear();
        } else {
          setAccessDenied(false);
          // Nếu đổi sang tài khoản khác → xóa localStorage cache cũ
          if (prevUidRef.current && prevUidRef.current !== u.uid) {
            localStorage.clear();
          }
          prevUidRef.current = u.uid;
          setUser(u);
        }
      } else {
        setUser(null);
        // Xóa localStorage khi đăng xuất
        localStorage.clear();
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Load classes when user logs in — chỉ từ Firestore, không dùng cache cũ
  useEffect(() => {
    if (!user) { setClasses([]); return; }
    setDataLoading(true);
    loadClassesFromDB(user.uid).then(data => {
      const list = (data && data.length > 0) ? data : [];
      setClasses(list);
      saveClasses(list);
      setDataLoading(false);
    }).catch(() => {
      setClasses([]);
      setDataLoading(false);
    });
  }, [user]);

  const setClassesAndSave = useCallback((updater) => {
    setClasses(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (user) saveClassesToDB(user.uid, next);
      else saveClasses(next);
      return next;
    });
  }, [user]);

  const handleLogout = () => {
    localStorage.clear();
    setPasscodeUnlocked(false);
    window.auth.signOut();
    navigate("#/");
  };

  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,background:"#eff6ff"}}>
      <div className="spin"><Icon name="database" size={36}/></div>
      <div style={{fontWeight:600,color:"#4f7fff",fontSize:16}}>Đang khởi động...</div>
    </div>
  );

  if (!user) return <LoginPage accessDenied={accessDenied} />;

  const isAdmin = user && user.email && user.email.toLowerCase() === SUPER_ADMIN;

  if (isAdmin) return (
    <div className="app-shell">
      <main className="main-content">
        <div className="header-bar">
          <div className="header-left">
            <div className="header-logo-btn" style={{cursor:'default'}}>
              <img src="images/favicon-96x96.png" alt="Logo" className="header-logo-img" />
            </div>
            <span className="header-title">Quản Lý Tài Khoản</span>
          </div>
          <div className="header-user-wrap" style={{position:'relative'}}>
            <AdminHeaderMenu user={user} handleLogout={handleLogout} />
          </div>
        </div>
        <AdminPage user={user} />
      </main>
    </div>
  );

  const titles = {
    home:"", attendance:"Điểm Danh", tuition:"Học Phí",
    students:"Học Sinh", data:"Dữ Liệu", timetable:"Thời Khóa Biểu",
    profile:"Hồ Sơ"
  };

  return (
    <div className="app-shell">
      <main className="main-content">
        <div className="header-bar">
          <div className="header-left">
            <button className="header-home-btn header-logo-btn" onClick={() => navigate("#/")} title="Trang chủ">
              <img src="images/favicon-96x96.png" alt="Trang chủ" className="header-logo-img" />
            </button>
            <span className="header-title">{titles[page] || "EduManagement"}</span>
          </div>
          <HeaderUserMenu user={user} page={page} navigate={navigate} handleLogout={handleLogout} />
        </div>

        {page === "home"       && <HomePage onNavigate={p => navigate(`#/${p}`)} />}
        {page === "attendance" && <AttendancePage classes={classes} setClasses={setClassesAndSave} navigate={navigate} hashParts={parts} user={user} passcodeUnlocked={passcodeUnlocked} setPasscodeUnlocked={setPasscodeUnlocked} />}
        {page === "tuition"    && <TuitionPage classes={classes} user={user} navigate={navigate} hashParts={parts} />}
        {page === "students"   && <StudentPage classes={classes} setClasses={setClassesAndSave} user={user} passcodeUnlocked={passcodeUnlocked} setPasscodeUnlocked={setPasscodeUnlocked} />}
        {page === "data"       && <DataPage classes={classes} setClasses={setClassesAndSave} user={user} />}
        {page === "timetable"  && <TimetablePage classes={classes} user={user} />}
        {page === "profile"    && <ProfilePage user={user} passcodeUnlocked={passcodeUnlocked} setPasscodeUnlocked={setPasscodeUnlocked} />}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);